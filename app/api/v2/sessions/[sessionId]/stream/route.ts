/**
 * GET /api/v2/sessions/[sessionId]/stream — SSE proxy for V2 session progress.
 *
 * Proxies the Neptune V2 SSE stream to the browser, handling CORS and auth.
 * The browser can consume this as an EventSource for real-time progress updates.
 */

import { getV2SSEStream } from "@/lib/v2/bridge";
import { requireAllowlist } from "@/lib/auth/require-allowlist";

export const maxDuration = 120;

export const GET = requireAllowlist(async (
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) => {
  const { sessionId } = await params;

  const v2Stream = await getV2SSEStream(sessionId);

  if (!v2Stream) {
    return new Response(
      `data: {"error":"V2 stream unavailable for session ${sessionId}"}\n\n`,
      {
        status: 502,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      }
    );
  }

  return new Response(v2Stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
