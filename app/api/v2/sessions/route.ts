/**
 * /api/v2/sessions — Aggregated V2 session operations.
 *
 * GET  — List recent V2 sessions
 * POST — Create a new V2 session (handoff)
 */

import { handoffToV2, listV2Sessions } from "@/lib/v2/bridge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "all";
  const limit = Number.parseInt(searchParams.get("limit") ?? "10", 10);

  const result = await listV2Sessions(status, limit);

  if (result.error) {
    return Response.json(result, { status: 502 });
  }

  return Response.json(result);
}

export async function POST(request: Request) {
  let body: { prompt?: string; context?: string; model?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!body.prompt) {
    return Response.json(
      { success: false, error: "prompt is required" },
      { status: 400 }
    );
  }

  const result = await handoffToV2(body.prompt, body.context, body.model);

  if (!result.success) {
    return Response.json(result, { status: 502 });
  }

  return Response.json(result, { status: 201 });
}
