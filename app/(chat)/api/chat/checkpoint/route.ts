/**
 * GET /api/chat/checkpoint?chatId=X — get all checkpoints for a chat
 * POST /api/chat/checkpoint — manually create a checkpoint
 *
 * Phase 10-D: Token tracking checkpoint resume flow.
 * When the auto-checkpoint fires at 95% context window, checkpoints are saved here.
 * Users can resume from a checkpoint via /c/new?from_checkpoint=X URL param.
 */
import { auth } from "@/app/(auth)/auth";
import { ChatbotError } from "@/lib/errors";
import { generateUUID } from "@/lib/utils";
import {
  generateCheckpointSummary,
  estimateMessageTokens,
  getContextWindow,
} from "@/lib/ai/token-tracker";
import { getChatById, getMessagesByChatId } from "@/lib/db/queries";

export const maxDuration = 30;

// ── GET: List checkpoints for a chat ──────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chatId");

  if (!chatId) {
    return Response.json(
      { error: "chatId query parameter is required" },
      { status: 400 }
    );
  }

  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  try {
    const chat = await getChatById({ id: chatId });
    if (!chat || chat.userId !== session.user.id) {
      return new ChatbotError("forbidden:chat").toResponse();
    }

    // Query chat_checkpoints table for this chat
    // NOTE: Table created by migration 0005 — graceful fallback if not yet migrated
    try {
      const { drizzle } = await import("drizzle-orm/postgres-js");
      const postgres = (await import("postgres")).default;
      const client = postgres(process.env.POSTGRES_URL ?? "");
      const db = drizzle(client);

      const rows = await db.execute(
        `SELECT * FROM chat_checkpoints WHERE chat_id = '${chatId}' ORDER BY created_at DESC LIMIT 20`
      );

      await client.end();

      return Response.json({
        checkpoints: rows,
        chatId,
        count: rows.length,
      });
    } catch {
      // Table doesn't exist yet (pre-migration 0005)
      return Response.json({
        checkpoints: [],
        chatId,
        count: 0,
        note: "chat_checkpoints table not yet created — run migration 0005",
      });
    }
  } catch (error) {
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }
    console.error("[checkpoint] GET failed:", error);
    return Response.json(
      { error: "Failed to fetch checkpoints" },
      { status: 500 }
    );
  }
}

// ── POST: Manually create a checkpoint ────────────────────────────────────────

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  let body: { chatId: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be JSON with chatId field" },
      { status: 400 }
    );
  }

  const { chatId, reason = "manual" } = body;
  if (!chatId) {
    return Response.json(
      { error: "chatId is required" },
      { status: 400 }
    );
  }

  try {
    const chat = await getChatById({ id: chatId });
    if (!chat || chat.userId !== session.user.id) {
      return new ChatbotError("forbidden:chat").toResponse();
    }

    const messages = await getMessagesByChatId({ id: chatId });

    if (messages.length === 0) {
      return Response.json(
        { error: "No messages in chat to checkpoint" },
        { status: 400 }
      );
    }

    const summary = generateCheckpointSummary(
      messages as unknown as Array<{ role: string; parts: unknown }>
    );

    const tokenCount = estimateMessageTokens(
      messages as unknown as Array<{ role: string; parts: unknown }>
    );

    const checkpointId = generateUUID();

    try {
      // Try to insert into chat_checkpoints table
      const { drizzle } = await import("drizzle-orm/postgres-js");
      const postgres = (await import("postgres")).default;
      const client = postgres(process.env.POSTGRES_URL ?? "");
      const db = drizzle(client);

      await db.execute(`
        INSERT INTO chat_checkpoints (
          id, chat_id, user_id, reason, token_count, usage_percent,
          conversation_summary, message_ids, model_id, context_window, created_at
        ) VALUES (
          '${checkpointId}',
          '${chatId}',
          '${session.user.id}',
          '${reason}',
          ${tokenCount},
          0,
          '${summary.replace(/'/g, "''")}',
          '${JSON.stringify(messages.map((m) => m.id)).replace(/'/g, "''")}',
          'unknown',
          ${getContextWindow("default")},
          NOW()
        )
      `);

      await client.end();

      return Response.json({
        success: true,
        checkpoint: {
          id: checkpointId,
          chatId,
          reason,
          tokenCount,
          summary,
          messageCount: messages.length,
        },
      }, { status: 201 });
    } catch {
      return Response.json(
        {
          error: "chat_checkpoints table not yet created — run migration 0005",
          checkpointPreview: {
            id: checkpointId,
            chatId,
            reason,
            tokenCount,
            summary,
          },
        },
        { status: 503 }
      );
    }
  } catch (error) {
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }
    console.error("[checkpoint] POST failed:", error);
    return Response.json(
      { error: "Failed to create checkpoint" },
      { status: 500 }
    );
  }
}
