/**
 * app/api/research/execute/route.ts
 * U5.5 — Research Execution API
 *
 * POST: Execute a research query across all available sources in parallel.
 * Returns structured synthesis with findings, sources, confidence, and recommendations.
 *
 * API keys (TAVILY_API_KEY, EXA_API_KEY, SMITHERY_API_KEY) are checked at runtime.
 * Missing keys are reported in the response so the UI can prompt for staging.
 */
import { NextResponse } from "next/server";
import { research, checkSourceAvailability, getMissingApiKeys } from "@/lib/research/parallel-engine";
import { collectAnnotation } from "@/connectors/neptune/functions/annotation-collector";

// ── POST: Execute Research ─────────────────────────────────────────────────

export async function POST(req: Request) {
  const start = Date.now();

  try {
    const body = await req.json();
    const { query, sources } = body;

    if (!query || typeof query !== "string" || query.trim().length < 3) {
      return NextResponse.json(
        { error: "Missing or too-short query (min 3 characters)" },
        { status: 400 }
      );
    }

    const result = await research(query.trim());

    const durationMs = Date.now() - start;

    // Annotate the research execution
    collectAnnotation({
      domain: "planning-research",
      playbook: "playbooks/planning-research/playbook-planning-research.md",
      skillOrWorkflow: "research-engine",
      outcome: result.success ? "success" : "partial",
      durationMs,
      error: result.error,
      learning: result.success
        ? `Research: ${result.synthesis!.findings.length} findings from ${result.rawResults.filter((r) => r.status === "success").length} sources, confidence=${result.synthesis!.overallConfidence}`
        : `Research partial: ${result.error}`,
      toolsUsed: ["parallel-research-engine", ...result.rawResults.map((r) => r.source.id)],
    });

    return NextResponse.json({
      success: result.success,
      synthesis: result.synthesis,
      rawResults: result.rawResults,
      durationMs,
      missingKeys: getMissingApiKeys(),
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        error: e?.message || "Research execution failed",
        durationMs: Date.now() - start,
      },
      { status: 500 }
    );
  }
}
