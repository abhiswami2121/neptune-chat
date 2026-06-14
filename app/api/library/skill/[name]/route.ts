/**
 * GET /api/library/skill/:name — Returns skill metadata including constraint data.
 *
 * Phase 13.A: Constraint-aware skill endpoint.
 * Returns full constraint metadata (tokens, latency, cost, deps, compat) for a skill.
 *
 * Cache: 5-min ETag.
 */
import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";
import { requireAllowlist } from "@/lib/auth/require-allowlist";

const POSTGRES_URL = process.env.POSTGRES_URL;

export const GET = requireAllowlist(async (
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) => {
  const { name } = await params;

  if (!POSTGRES_URL) {
    return NextResponse.json({ error: "DB not configured" }, { status: 500 });
  }

  const sql = postgres(POSTGRES_URL, { max: 1 });

  try {
    const decodedName = decodeURIComponent(name);

    // Try skill first, then function, then connector
    let [skill] = await sql`
      SELECT
        "name", "type", "connector_name", "description", "version",
        "context_tokens_estimated", "typical_latency_ms", "cost_per_invocation_usd",
        "dependencies", "incompatible_with", "optimal_for", "suboptimal_for",
        "created_at", "updated_at"
      FROM "library_skills"
      WHERE "name" = ${decodedName}
      LIMIT 1
    `;

    // Also fetch usage summary
    const [usage] = await sql`
      SELECT
        COUNT(*)::int as "total_loads",
        COUNT(*) FILTER (WHERE "success_marker")::int as "successful_loads",
        COUNT(*) FILTER (WHERE NOT "success_marker")::int as "failed_loads",
        COALESCE(AVG("tokens_actual")::int, 0) as "avg_tokens",
        COALESCE(AVG("latency_actual_ms")::int, 0) as "avg_latency_ms"
      FROM "library_usage_logs"
      WHERE "skill_loaded" = ${decodedName}
    `;

    return NextResponse.json({
      skill: {
        name: skill.name,
        type: skill.type,
        connector_name: skill.connector_name,
        description: skill.description,
        version: skill.version,
        constraints: {
          context_tokens_estimated: skill.context_tokens_estimated,
          typical_latency_ms: skill.typical_latency_ms,
          cost_per_invocation_usd: skill.cost_per_invocation_usd,
          dependencies: skill.dependencies || [],
          incompatible_with: skill.incompatible_with || [],
          optimal_for: skill.optimal_for || [],
          suboptimal_for: skill.suboptimal_for || [],
        },
        usage: {
          total_loads: usage?.total_loads || 0,
          successful_loads: usage?.successful_loads || 0,
          failed_loads: usage?.failed_loads || 0,
          avg_tokens: usage?.avg_tokens || 0,
          avg_latency_ms: usage?.avg_latency_ms || 0,
        },
        created_at: skill.created_at,
        updated_at: skill.updated_at,
      },
    }, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch (err) {
    console.error("[library/skill]", err);
    return NextResponse.json({ error: "Skill query failed" }, { status: 500 });
  } finally {
    await sql.end();
  }
});
