/**
 * GET /api/marketplace/vercel-search?q=react+ui
 *
 * Phase 13.G: Searches vercel-labs/agent-skills via npx skills CLI.
 * Results cached 1h. Used by marketplace UI "Vercel Skills" tab.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAllowlist } from "@/lib/auth/require-allowlist";
import { searchVercelSkills } from "@/lib/marketplace/vercel-skills";

export const GET = requireAllowlist(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";

  if (!query.trim()) {
    return NextResponse.json(
      { error: "Missing query parameter 'q'", results: [] },
      { status: 400 }
    );
  }

  try {
    const results = await searchVercelSkills(query.trim());

    return NextResponse.json({
      query,
      count: results.length,
      results,
      source: "vercel-labs/agent-skills",
      cached: true,
    }, {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (err) {
    console.error("[marketplace/vercel-search]", err);
    return NextResponse.json(
      { error: "Vercel search failed", results: [] },
      { status: 500 }
    );
  }
});
