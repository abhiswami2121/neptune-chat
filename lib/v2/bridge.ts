/**
 * V2 Bidirectional Bridge — shared module for all Neptune V2 interactions.
 *
 * PRD ref: Section 3, Layer 4 — V2 Integration (Bidirectional)
 *
 * Chat → V2 (handoff):     handoffToV2()  — POST /api/sessions
 * Chat ← V2 (read state):  listV2Sessions(), getV2Session(), streamV2Progress()
 * Chat → V2 (control):     controlV2Session() — pause/resume/cancel
 */

// ── Configuration ────────────────────────────────────────────────────────

const NEPTUNE_V2_URL =
  process.env.NEPTUNE_V2_CHAT_URL || "https://neptune-v2.vercel.app";

const NEPTUNE_V2_HANDOFF_SECRET = process.env.NEPTUNE_V2_HANDOFF_SECRET || "";

const DEFAULT_TIMEOUT = 15_000;

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
  if (NEPTUNE_V2_HANDOFF_SECRET) {
    headers.Authorization = `Bearer ${NEPTUNE_V2_HANDOFF_SECRET}`;
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
 * Hand off a coding task to Neptune V2.
 * V2 spawns a session (sandbox or repo) and executes the task.
 */
export async function handoffToV2(
  prompt: string,
  context?: string,
  model?: string
): Promise<V2HandoffResult> {
  try {
    const res = await fetchWithTimeout(
      `${NEPTUNE_V2_URL}/api/sessions`,
      {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          prompt,
          context,
          model: model ?? "deepseek-v4-pro",
          source: "neptune-chat",
        }),
      },
      20_000
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        success: false,
        error: `V2 returned ${res.status}: ${body.slice(0, 200)}`,
      };
    }

    const data = await res.json();
    const sessionId = data.sessionId ?? data.id;

    return {
      success: true,
      sessionId,
      sessionUrl: data.sessionUrl ?? `${NEPTUNE_V2_URL}/sessions/${sessionId}`,
      sseUrl: data.sseUrl ?? data.streamUrl,
    };
  } catch (err) {
    return {
      success: false,
      error: `V2 handoff failed: ${err instanceof Error ? err.message : "Unknown"}`,
    };
  }
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
 * Get an SSE stream URL for a V2 session.
 * Returns the raw V2 SSE URL — callers should proxy through
 * /api/v2/sessions/[sessionId]/stream for browser consumption.
 */
export function getV2StreamUrl(sessionId: string): string {
  return `${NEPTUNE_V2_URL}/api/sessions/${sessionId}/stream`;
}

/**
 * Get the V2 SSE stream as a ReadableStream for proxying.
 * Returns null if V2 is unreachable.
 */
export async function getV2SSEStream(
  sessionId: string
): Promise<ReadableStream<Uint8Array> | null> {
  try {
    const res = await fetch(getV2StreamUrl(sessionId), {
      headers: authHeaders(),
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
