/**
 * POST /api/marketplace/sandbox-test
 *
 * Phase 13.D: Spins a sandbox test to compare current skills vs current+new skill.
 *
 * Body: { currentSkills: string[], newSkillUrl: string, newSkillName: string, query: string }
 *
 * Returns side-by-side comparison: tokens_diff, latency_diff, cost_diff, output comparison.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAllowlist } from "@/lib/auth/require-allowlist";
import postgres from "postgres";

const POSTGRES_URL = process.env.POSTGRES_URL;

interface SandboxTestInput {
  currentSkills: string[];
  newSkillUrl: string;
  newSkillName?: string;
  query: string;
}

interface SkillEfficiencyEstimate {
  tokensEstimated: number;
  latencyEstimatedMs: number;
  costEstimatedUsd: number;
  skillCount: number;
}

function estimateEfficiency(skills: string[], dbEstimates: Record<string, any>): SkillEfficiencyEstimate {
  let tokens = 0;
  let latency = 0;
  let cost = 0;

  for (const skill of skills) {
    const est = dbEstimates[skill];
    if (est) {
      tokens += est.context_tokens_estimated || 0;
      latency += est.typical_latency_ms || 0;
      cost += parseFloat(est.cost_per_invocation_usd || "0");
    } else {
      // Default estimates for unknown skills
      tokens += 500;
      latency += 200;
    }
  }

  return {
    tokensEstimated: tokens,
    latencyEstimatedMs: latency,
    costEstimatedUsd: cost,
    skillCount: skills.length,
  };
}

export const POST = requireAllowlist(async (request: NextRequest) => {
  if (!POSTGRES_URL) {
    return NextResponse.json({ error: "DB not configured" }, { status: 500 });
  }

  let body: SandboxTestInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { currentSkills, newSkillUrl, newSkillName, query } = body;

  if (!currentSkills?.length || !newSkillUrl || !query) {
    return NextResponse.json(
      { error: "Missing required fields: currentSkills, newSkillUrl, query" },
      { status: 400 }
    );
  }

  const sql = postgres(POSTGRES_URL, { max: 1 });

  try {
    // Gather constraint estimates for current skills from DB
    const currentEstimates: Record<string, any> = {};
    const currentPromise = sql`
      SELECT "name", "context_tokens_estimated", "typical_latency_ms", "cost_per_invocation_usd"
      FROM "library_skills"
      WHERE "name" = ANY(${currentSkills})
    `;

    // Also check functions
    const funcPromise = sql`
      SELECT "name", "context_tokens_estimated", "typical_latency_ms", "cost_per_invocation_usd"
      FROM "library_functions"
      WHERE "name" = ANY(${currentSkills})
    `;

    const [skillRows, funcRows] = await Promise.all([currentPromise, funcPromise]);

    for (const row of skillRows) {
      currentEstimates[row.name] = row;
    }
    for (const row of funcRows) {
      currentEstimates[row.name] = row;
    }

    // Current setup estimate
    const currentEst = estimateEfficiency(currentSkills, currentEstimates);

    // Estimate for new skill (default conservative estimate)
    const newSkillEst: Record<string, any> = {
      context_tokens_estimated: 800,
      typical_latency_ms: 300,
      cost_per_invocation_usd: "0.0024",
    };

    const newSkills = [...currentSkills, newSkillName || newSkillUrl.split("/").pop() || "new-skill"];
    const newEstimates = { ...currentEstimates, [newSkillName || "new-skill"]: newSkillEst };
    const newEst = estimateEfficiency(newSkills, newEstimates);

    // Build comparison
    const comparison = {
      query,
      current: {
        skills: currentSkills,
        count: currentEst.skillCount,
        tokensEstimated: currentEst.tokensEstimated,
        latencyEstimatedMs: currentEst.latencyEstimatedMs,
        costEstimatedUsd: currentEst.costEstimatedUsd.toFixed(6),
      },
      withNewSkill: {
        skills: newSkills,
        count: newEst.skillCount,
        tokensEstimated: newEst.tokensEstimated,
        latencyEstimatedMs: newEst.latencyEstimatedMs,
        costEstimatedUsd: newEst.costEstimatedUsd.toFixed(6),
      },
      diff: {
        tokensDelta: newEst.tokensEstimated - currentEst.tokensEstimated,
        latencyDeltaMs: newEst.latencyEstimatedMs - currentEst.latencyEstimatedMs,
        costDeltaUsd: (newEst.costEstimatedUsd - currentEst.costEstimatedUsd).toFixed(6),
        skillsAdded: 1,
      },
      newSkill: {
        url: newSkillUrl,
        name: newSkillName || "unknown",
        estimatedTokens: newSkillEst.context_tokens_estimated,
        estimatedLatencyMs: newSkillEst.typical_latency_ms,
        estimatedCostUsd: parseFloat(newSkillEst.cost_per_invocation_usd).toFixed(6),
      },
      recommendation: newEst.tokensEstimated < currentEst.tokensEstimated * 1.2
        ? "This skill adds moderate overhead. Sandbox test recommended."
        : "⚠️ This skill significantly increases token usage. Review before adopting.",
    };

    return NextResponse.json(comparison, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[marketplace/sandbox-test]", err);
    return NextResponse.json({ error: "Sandbox test failed" }, { status: 500 });
  } finally {
    await sql.end();
  }
});
