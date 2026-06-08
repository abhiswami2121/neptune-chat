/**
 * POST /api/v2/sessions/[sessionId]/control — Control a running V2 session.
 *
 * Actions: pause, resume, cancel
 */

import { controlV2Session } from "@/lib/v2/bridge";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  let body: { action?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const validActions = ["pause", "resume", "cancel"];
  if (!body.action || !validActions.includes(body.action)) {
    return Response.json(
      {
        success: false,
        error: `Invalid action. Must be one of: ${validActions.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const result = await controlV2Session(
    sessionId,
    body.action as "pause" | "resume" | "cancel"
  );

  if (!result.success) {
    return Response.json(result, { status: 502 });
  }

  return Response.json(result);
}
