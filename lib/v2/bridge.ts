/**
 * V2 Bidirectional Bridge — shared module for all Neptune V2 interactions.
 *
 * PRD ref: Section 3, Layer 4 — V2 Integration (Bidirectional)
 *
 * Chat → V2 (handoff):     handoffToV2()  — POST /api/sessions
 * Chat ← V2 (read state):  listV2Sessions(), getV2Session(), streamV2Progress()
 * Chat → V2 (control):     controlV2Session() — pause/resume/cancel
 *
 * U1.2: handoffToV2 now includes auto-retry (1 retry with 2s backoff).
 * U1.2: All functions return structured results, never throw unhandled.
 */

// ── Configuration ────────────────────────────────────────────────────────

const NEPTUNE_V2_URL =
  process.env.NEPTUNE_V2_CHAT_URL || "https://neptune-v2.vercel.app";

const NEPTUNE_V2_HANDOFF_SECRET = process.env.NEPTUNE_V2_HANDOFF_SECRET || "";
const NEPTUNE_INTERNAL_TOKEN = process.env.NEPTUNE_INTERNAL_TOKEN || "";

const DEFAULT_TIMEOUT = 15_000;
const V2_HANDOFF_TIMEOUT = 60_000; // U1.2: 60s max for V2 handoff
const V2_CHAT_ENDPOINT = `${NEPTUNE_V2_URL}/api/chat`;

// ── Types ────────────────────────────────────────────────────────────────

export interface V2Session {
  sessionId?: string;
  id?: string;
  status?: string;
  createdAt?: string;
  created_at?: string;
  prompt?: string;
  model?: string;
  streamUrl?: string;
  sseUrl?: string;
  sessionUrl?: string;
}

export interface V2HandoffResult {
  success: boolean;
  sessionId?: string;
  sessionUrl?: string;
  sseUrl?: string;
  error?: string;
}

export interface V2SessionListResult {
  sessions: V2Session[];
  count: number;
  error?: string;
}

export interface V2SessionDetail extends V2Session {
  progress?: Array<{
    step: number;
    status: string;
    text?: string;
  }>;
  output?: string;
  error?: string;
}

export type V2ControlAction = "pause" | "resume" | "cancel";

export interface V2ControlResult {
  success: boolean;
  action: V2ControlAction;
  sessionId: string;
  error?: string;
}

// ── Shared Helpers ───────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = NEPTUNE_INTERNAL_TOKEN || NEPTUNE_V2_HANDOFF_SECRET;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Core Bridge API ──────────────────────────────────────────────────────

/**
 * Hand off a coding task to Neptune V2 via /api/chat.
 * V2 uses chatId as the session identifier; the SSE stream is consumed
 * by the calling API route.
 *
 * U1.2: Auto-retry — first failure retries once with 2s backoff.
 * Second failure returns structured error.
 */
export async function handoffToV2(
  prompt: string,
  context?: string,
  model?: string
): Promise<V2HandoffResult> {
  const chatId = `handoff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const attempt = async (): Promise<V2HandoffResult> => {
    try {
      const res = await fetchWithTimeout(
        V2_CHAT_ENDPOINT,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            messages: [
              {
                role: "user",
                content: context
                  ? `${context}\n\n---\n\n${prompt}`
                  : prompt,
              },
            ],
            chatId,
            model: model ?? "deepseek-v4-pro",
            source: "neptune-chat",
            mode: "chat",
          }),
        },
        V2_HANDOFF_TIMEOUT
      );

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return {
          success: false,
          error: `V2 returned ${res.status}: ${body.slice(0, 200)}`,
        };
      }

      // V2 returns SSE stream — read first event to confirm session started
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("text/event-stream") && res.body) {
        const reader = res.body.getReader();
        let sessionStarted = false;
        // Read first few SSE events to confirm connection
        for (let i = 0; i < 5; i++) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = new TextDecoder().decode(value);
          if (text.includes('"type":"start"') || text.includes('"type":"start-step"')) {
            sessionStarted = true;
            break;
          }
        }
        reader.cancel(); // Don't consume full stream from bridge
        if (!sessionStarted) {
          return {
            success: false,
            error: "V2 session did not start — no start event in SSE stream",
          };
        }
      }

      // Use chatId as sessionId (V2 identifies sessions by chatId)
      return {
        success: true,
        sessionId: chatId,
        sessionUrl: `${NEPTUNE_V2_URL}/chat/${chatId}`,
        sseUrl: V2_CHAT_ENDPOINT,
      };
    } catch (err) {
      return {
        success: false,
        error: `V2 handoff failed: ${err instanceof Error ? err.message : "Unknown"}`,
      };
    }
  };

  // U1.2: Auto-retry — first attempt fails, retry once with 2s backoff
  const firstAttempt = await attempt();
  if (firstAttempt.success) return firstAttempt;

  // Only retry on transient errors (timeout, network, 503, 502)
  const errorMsg = firstAttempt.error || "";
  const isRetryable =
    errorMsg.includes("timeout") ||
    errorMsg.includes("abort") ||
    errorMsg.includes("fetch") ||
    errorMsg.includes("ECONNREFUSED") ||
    errorMsg.includes("503") ||
    errorMsg.includes("502") ||
    errorMsg.includes("unreachable");

  if (!isRetryable) return firstAttempt;

  // Wait 2s then retry
  await new Promise((r) => setTimeout(r, 2000));
  return attempt();
}

/**
 * List recent Neptune V2 coding sessions.
 */
export async function listV2Sessions(
  status?: string,
  limit = 10
): Promise<V2SessionListResult> {
  try {
    const params = new URLSearchParams({
      limit: String(Math.min(limit, 25)),
    });
    if (status && status !== "all") {
      params.set("status", status);
    }

    const res = await fetchWithTimeout(
      `${NEPTUNE_V2_URL}/api/sessions/list?${params.toString()}`,
      { headers: authHeaders() },
      10_000
    );

    if (!res.ok) {
      return {
        sessions: [],
        count: 0,
        error: `V2 returned ${res.status}`,
      };
    }

    const data = await res.json();
    const sessions = data.sessions ?? data ?? [];

    return {
      sessions: Array.isArray(sessions) ? sessions : [sessions],
      count: Array.isArray(sessions) ? sessions.length : 0,
    };
  } catch (err) {
    return {
      sessions: [],
      count: 0,
      error: `V2 unreachable: ${err instanceof Error ? err.message : "Unknown"}`,
    };
  }
}

/**
 * Get detailed information about a specific V2 session.
 */
export async function getV2Session(
  sessionId: string
): Promise<V2SessionDetail> {
  try {
    const res = await fetchWithTimeout(
      `${NEPTUNE_V2_URL}/api/sessions/${sessionId}`,
      { headers: authHeaders() },
      10_000
    );

    if (!res.ok) {
      return {
        sessionId,
        error: `V2 returned ${res.status} for session ${sessionId}`,
      };
    }

    const data = await res.json();

    return {
      sessionId,
      status: data.status ?? "unknown",
      createdAt: data.createdAt ?? data.created_at,
      progress: data.progress,
      output: data.output,
      ...data,
    };
  } catch (err) {
    return {
      sessionId,
      error: `V2 unreachable: ${err instanceof Error ? err.message : "Unknown"}`,
    };
  }
}

/**
 * Get the SSE stream URL for a V2 session.
 * V2 identifies sessions by chatId; stream URL is the /api/chat endpoint.
 */
export function getV2StreamUrl(sessionId: string): string {
  return V2_CHAT_ENDPOINT;
}

/**
 * Get the V2 SSE stream as a ReadableStream for proxying.
 * Replays the session by sending the chatId and requesting continuation.
 * Returns null if V2 is unreachable.
 */
export async function getV2SSEStream(
  sessionId: string
): Promise<ReadableStream<Uint8Array> | null> {
  try {
    const res = await fetch(V2_CHAT_ENDPOINT, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        messages: [{ role: "user", content: "continue" }],
        chatId: sessionId,
        mode: "chat",
      }),
    });

    if (!res.ok || !res.body) {
      return null;
    }

    return res.body;
  } catch {
    return null;
  }
}

/**
 * Control a running V2 session (pause/resume/cancel).
 */
export async function controlV2Session(
  sessionId: string,
  action: V2ControlAction
): Promise<V2ControlResult> {
  try {
    const res = await fetchWithTimeout(
      `${NEPTUNE_V2_URL}/api/sessions/${sessionId}/control`,
      {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ action }),
      },
      10_000
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        success: false,
        action,
        sessionId,
        error: `V2 returned ${res.status}: ${body.slice(0, 200)}`,
      };
    }

    return { success: true, action, sessionId };
  } catch (err) {
    return {
      success: false,
      action,
      sessionId,
      error: `V2 control failed: ${err instanceof Error ? err.message : "Unknown"}`,
    };
  }
}

/**
 * Check if Neptune V2 is reachable.
 */
export async function pingV2(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(
      `${NEPTUNE_V2_URL}/api/health`,
      { method: "GET" },
      5000
    );
    return res.ok;
  } catch {
    return false;
  }
}
