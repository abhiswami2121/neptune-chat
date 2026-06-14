/**
 * GET /api/cron/refinement-loop
 *
 * Phase 13.F: Weekly refinement loop — runs Sunday 02:00 UTC via Vercel cron.
 *
 * Logic:
 *   - Reads library_usage_logs for the past 7 days
 *   - Detects patterns: promotion, degradation, co-loading, archival candidates
 *   - Updates skill constraint metadata in DB
 *   - Never auto-deletes — only marks for archival review
 *   - Posts weekly digest to Slack #jarvis-admin
 *
 * Cron: vercel.json "0 2 * * 0" (Sunday 2am UTC)
 */
import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";

const POSTGRES_URL = process.env.POSTGRES_URL;

interface Pattern {
  type: "promote" | "degrade" | "co_dependency" | "archival_candidate";
  skill: string;
  playbook?: string;
  detail: string;
  action: string;
}

export const GET = async (request: NextRequest) => {
  // Verify cron secret
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const expectedToken = process.env.NEPTUNE_INTERNAL_TOKEN || process.env.CRON_SECRET;

  if (!expectedToken || token !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!POSTGRES_URL) {
    return NextResponse.json({ error: "DB not configured" }, { status: 500 });
  }

  const sql = postgres(POSTGRES_URL, { max: 1 });
  const patterns: Pattern[] = [];
  const digestLines: string[] = [
    `🔁 *Phase 13 Refinement Loop — ${new Date().toISOString().split("T")[0]}*`,
    `Analyzing usage patterns from the past 7 days...`,
  ];

  try {
    // ── 1. Promotion: >5 loads, >80% success → promote to default sequence ───
    const promotionRows = await sql`
      SELECT
        "skill_loaded",
        "playbook_routed_from",
        COUNT(*)::int as loads,
        ROUND(100.0 * COUNT(*) FILTER (WHERE "success_marker") / COUNT(*), 1) as success_rate
      FROM "library_usage_logs"
      WHERE "timestamp" > NOW() - INTERVAL '7 days'
      GROUP BY "skill_loaded", "playbook_routed_from"
      HAVING COUNT(*) > 5
        AND COUNT(*) FILTER (WHERE "success_marker")::float / COUNT(*) > 0.8
      ORDER BY loads DESC
    `;

    for (const row of promotionRows) {
      patterns.push({
        type: "promote",
        skill: row.skill_loaded,
        playbook: row.playbook_routed_from,
        detail: `${row.loads} loads, ${row.success_rate}% success`,
        action: "add to optimal_for + update playbook frontmatter",
      });

      // Update optimal_for in DB
      await sql`
        UPDATE "library_skills"
        SET "optimal_for" = (
          SELECT jsonb_agg(DISTINCT x) FROM (
            SELECT jsonb_array_elements_text(COALESCE("optimal_for", '[]'::jsonb)) AS x
            UNION
            SELECT ${row.playbook_routed_from}
          ) t
        ),
        "updated_at" = NOW()
        WHERE "name" = ${row.skill_loaded}
      `;
    }

    // ── 2. Degradation: >3 loads, <20% success → mark suboptimal ─────────────
    const degradeRows = await sql`
      SELECT
        "skill_loaded",
        "playbook_routed_from",
        COUNT(*)::int as loads,
        ROUND(100.0 * COUNT(*) FILTER (WHERE "success_marker") / COUNT(*), 1) as success_rate
      FROM "library_usage_logs"
      WHERE "timestamp" > NOW() - INTERVAL '7 days'
      GROUP BY "skill_loaded", "playbook_routed_from"
      HAVING COUNT(*) > 3
        AND COUNT(*) FILTER (WHERE "success_marker")::float / COUNT(*) < 0.2
      ORDER BY loads DESC
    `;

    for (const row of degradeRows) {
      patterns.push({
        type: "degrade",
        skill: row.skill_loaded,
        playbook: row.playbook_routed_from,
        detail: `${row.loads} loads, ${row.success_rate}% success`,
        action: "add to suboptimal_for + notify",
      });

      await sql`
        UPDATE "library_skills"
        SET "suboptimal_for" = (
          SELECT jsonb_agg(DISTINCT x) FROM (
            SELECT jsonb_array_elements_text(COALESCE("suboptimal_for", '[]'::jsonb)) AS x
            UNION
            SELECT ${row.playbook_routed_from}
          ) t
        ),
        "updated_at" = NOW()
        WHERE "name" = ${row.skill_loaded}
      `;
    }

    // ── 3. Co-dependency: co-loaded >3 times → mark dependency ────────────────
    const coLoadedRows = await sql`
      WITH skill_pairs AS (
        SELECT
          "session_id",
          "skill_loaded" as skill_a,
          unnest(
            CASE
              WHEN jsonb_typeof("co_loaded_with") = 'array' THEN
                (SELECT array_agg(value::text) FROM jsonb_array_elements_text("co_loaded_with"))
              ELSE ARRAY[]::text[]
            END
          ) as skill_b
        FROM "library_usage_logs"
        WHERE "timestamp" > NOW() - INTERVAL '7 days'
          AND "co_loaded_with" IS NOT NULL
          AND jsonb_typeof("co_loaded_with") = 'array'
      )
      SELECT skill_a, skill_b, COUNT(*)::int as pair_count
      FROM skill_pairs
      WHERE skill_a != skill_b
      GROUP BY skill_a, skill_b
      HAVING COUNT(*) > 3
      ORDER BY pair_count DESC
      LIMIT 20
    `;

    for (const row of coLoadedRows) {
      patterns.push({
        type: "co_dependency",
        skill: `${row.skill_a} ↔ ${row.skill_b}`,
        detail: `${row.pair_count} co-loads`,
        action: "mark as mutual dependencies in both SKILL.md",
      });

      // Add dependency edge
      await sql`
        INSERT INTO "library_edges" ("from_node", "from_type", "to_node", "to_type", "edge_type", "weight")
        VALUES (${row.skill_a}, 'skill', ${row.skill_b}, 'skill', 'depends_on', ${Math.min(10, row.pair_count)})
        ON CONFLICT ("from_node", "from_type", "to_node", "to_type", "edge_type") DO NOTHING
      `;
    }

    // ── 4. Archival candidates: never loaded in 30 days ──────────────────────
    const archivalRows = await sql`
      SELECT "name"
      FROM "library_skills"
      WHERE "name" NOT IN (
        SELECT DISTINCT "skill_loaded"
        FROM "library_usage_logs"
        WHERE "timestamp" > NOW() - INTERVAL '30 days'
      )
      AND "created_at" < NOW() - INTERVAL '30 days'
    `;

    for (const row of archivalRows) {
      patterns.push({
        type: "archival_candidate",
        skill: row.name,
        detail: "No usage in 30 days",
        action: "Mark for review — NOT deleting (cardinal rule #5)",
      });

      await sql`
        UPDATE "library_skills"
        SET "suboptimal_for" = jsonb_set(
          COALESCE("suboptimal_for", '[]'::jsonb),
          '{0}',
          '"__ARCHIVAL_REVIEW__"'::jsonb
        ),
        "updated_at" = NOW()
        WHERE "name" = ${row.name}
      `;
    }

    // ── Build digest ─────────────────────────────────────────────────────────
    const byType: Record<string, number> = {};
    for (const p of patterns) {
      byType[p.type] = (byType[p.type] || 0) + 1;
    }

    digestLines.push("");
    digestLines.push(`📊 *Summary:* ${patterns.length} patterns detected`);
    for (const [type, count] of Object.entries(byType)) {
      const emoji = type === "promote" ? "⭐" : type === "degrade" ? "⚠️" : type === "co_dependency" ? "🔗" : "📦";
      digestLines.push(`  ${emoji} ${type}: ${count}`);
    }

    if (patterns.length > 0) {
      digestLines.push("");
      digestLines.push("*Details:*");
      for (const p of patterns) {
        digestLines.push(`• ${p.type === "promote" ? "⭐" : p.type === "degrade" ? "⚠️" : p.type === "co_dependency" ? "🔗" : "📦"} *${p.skill}* — ${p.detail} → ${p.action}`);
      }
    } else {
      digestLines.push("");
      digestLines.push("✅ No significant patterns detected this week.");
    }

    digestLines.push("");
    digestLines.push("_Refinement loop complete. All updates applied to DB._");
    digestLines.push(`_Next run: ${new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]} 02:00 UTC_`);

    const digestText = digestLines.join("\n");

    // Post to Slack #jarvis-admin
    let slackStatus = "not_sent";
    try {
      const slackRes = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.SLACK_BOT_TOKEN || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel: process.env.SLACK_JARVIS_ADMIN_CHANNEL || "C08JZ5NQGK5R",
          text: digestText,
          mrkdwn: true,
        }),
      });

      const slackData = await slackRes.json();
      slackStatus = slackData.ok ? "sent" : `failed: ${(slackData as any).error || "unknown"}`;
    } catch (slackErr) {
      slackStatus = `error: ${(slackErr as Error).message}`;
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      patterns_detected: patterns.length,
      by_type: byType,
      slack_status: slackStatus,
      digest: digestText,
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[cron/refinement-loop]", err);
    return NextResponse.json({ error: "Refinement loop failed" }, { status: 500 });
  } finally {
    await sql.end();
  }
};
