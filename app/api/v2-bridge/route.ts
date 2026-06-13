/**
 * /api/v2-bridge — U2.5A.3
 *
 * Forwards requests to Neptune V2's agent-sessions API.
 * Chat → V2 bridge with NEPTUNE_INTERNAL_TOKEN auth.
 *
 * GET    /api/v2-bridge?path=agent-sessions       → V2 GET  /api/agent-sessions
 * POST   /api/v2-bridge?path=agent-sessions       → V2 POST /api/agent-sessions
 * GET    /api/v2-bridge?path=agent-sessions/:id   → V2 GET  /api/agent-sessions/:id
 * GET    /api/v2-bridge?path=agent-sessions/:id/stream → V2 GET /api/agent-sessions/:id/stream
 */

import { NextRequest, NextResponse } from "next/server";
import { secrets } from "@/secrets";
import { requireAllowlist } from "@/lib/auth/require-allowlist";

const NEPTUNE_V2_API_BASE =
  process.env.NEPTUNE_V2_API_BASE || "https://neptune-v2.vercel.app";
const NEPTUNE_INTERNAL_TOKEN = secrets.vps.internalToken;

function buildV2Url(path: string): string {
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `${NEPTUNE_V2_API_BASE}/api/${cleanPath}`;
}

async function proxyToV2(req: NextRequest, path: string) {
  const v2Url = buildV2Url(path);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (NEPTUNE_INTERNAL_TOKEN) {
    headers.Authorization = `Bearer ${NEPTUNE_INTERNAL_TOKEN}`;
  }

  // Forward query params from Chat to V2
  const v2UrlWithParams = new URL(v2Url);
  req.nextUrl.searchParams.forEach((value, key) => {
    v2UrlWithParams.searchParams.set(key, value);
  });

  try {
    const body = req.method !== "GET" ? await req.text().catch(() => undefined) : undefined;

    const res = await fetch(v2UrlWithParams.toString(), {
      method: req.method,
      headers,
      body,
    });

    // For SSE streams, return the raw response
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("text/event-stream")) {
      return new Response(res.body, {
        status: res.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[v2-bridge] Proxy error:", err);
    return NextResponse.json(
      { error: "V2 unreachable", details: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}

export const GET = requireAllowlist(async (req: NextRequest) => {
  const path = req.nextUrl.searchParams.get("path") || "agent-sessions";
  return proxyToV2(req, path);
});

export const POST = requireAllowlist(async (req: NextRequest) => {
  const path = req.nextUrl.searchParams.get("path") || "agent-sessions";
  return proxyToV2(req, path);
});

export const PATCH = requireAllowlist(async (req: NextRequest) => {
  const path = req.nextUrl.searchParams.get("path") || "agent-sessions";
  return proxyToV2(req, path);
});
