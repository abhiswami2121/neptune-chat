/**
 * POST /api/library/log-usage
 *
 * Phase 13.B: Accepts usage log events from progressive disclosure tools.
 * Internal-only endpoint — called fire-and-forget by load_playbook/load_connector/load_function.
 *
 * Body: { session_id, skill_loaded, skill_type, playbook_routed_from, success_marker, tokens_actual, latency_actual_ms }
 * Returns: 201 on success, 500 on error
 */
import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";

const POSTGRES_URL = process.env.POSTGRES_URL;

export const POST = async (request: NextRequest) => {
  // Internal auth check
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const expectedToken = process.env.NEPTUNE_INTERNAL_TOKEN;

  if (!expectedToken || token !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!POSTGRES_URL) {
    return NextResponse.json({ error: "DB not configured" }, { status: 500 });
  }

  let body: {
    session_id?: string;
    skill_loaded: string;
    skill_type?: string;
    playbook_routed_from?: string;
    success_marker?: boolean;
    tokens_actual?: number;
    latency_actual_ms?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.skill_loaded) {
    return NextResponse.json({ error: "Missing skill_loaded" }, { status: 400 });
  }

  const sql = postgres(POSTGRES_URL, { max: 1 });

  try {
    await sql`
      INSERT INTO "library_usage_logs" (
        "session_id",
        "skill_loaded",
        "skill_type",
        "playbook_routed_from",
        "success_marker",
        "tokens_actual",
        "latency_actual_ms"
      ) VALUES (
        ${body.session_id || "anonymous"},
        ${body.skill_loaded},
        ${body.skill_type || "connector"},
        ${body.playbook_routed_from || null},
        ${body.success_marker ?? true},
        ${body.tokens_actual || null},
        ${body.latency_actual_ms || null}
      )
    `;

    return NextResponse.json({ logged: true }, { status: 201 });
  } catch (err) {
    console.error("[library/log-usage]", err);
    return NextResponse.json({ error: "Log write failed" }, { status: 500 });
  } finally {
    await sql.end();
  }
};
