/**
 * GET /api/marketplace/community-search?q=...
 *
 * Phase 13.C: Searches community repos (GitHub) for skills.
 * Uses GitHub API to search vercel-labs/agent-skills, anthropics/skills, and awesome repos.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAllowlist } from "@/lib/auth/require-allowlist";

const GITHUB_API = "https://api.github.com";

interface CommunitySkill {
  name: string;
  description: string;
  source: string;
  url: string;
  stars: number;
  tags: string[];
}

async function searchGitHub(query: string, repo: string): Promise<CommunitySkill[]> {
  const token = process.env.GITHUB_TOKEN || "";
  const headers: Record<string, string> = {
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "neptune-chat-marketplace",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    // Search for skills.md files in the repo
    const url = `${GITHUB_API}/search/code?q=${encodeURIComponent(query)}+repo:${repo}+filename:SKILL.md&per_page=10`;
    const res = await fetch(url, { headers });

    if (!res.ok) return [];

    const data = await res.json();
    const skills: CommunitySkill[] = [];

    for (const item of data.items || []) {
      skills.push({
        name: item.name?.replace(".md", "") || item.path?.split("/").pop()?.replace(".md", "") || "unknown",
        description: `Found in ${repo}: ${item.path}`,
        source: repo,
        url: item.html_url || `https://github.com/${repo}/blob/main/${item.path}`,
        stars: 0,
        tags: [repo.split("/")[1] || "community"],
      });
    }

    return skills;
  } catch {
    return [];
  }
}

export const GET = requireAllowlist(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";

  // Known community repos for skill discovery
  const COMMUNITY_REPOS = [
    "vercel-labs/agent-skills",
    "anthropics/skills",
    "tomekkorbak/awesome-claude-skills",
    "AnandChowdhary/awesome-claude-code",
  ];

  try {
    const allResults: CommunitySkill[] = [];

    if (query.trim()) {
      // Search specific repos
      const promises = COMMUNITY_REPOS.map((repo) => searchGitHub(query.trim(), repo));
      const results = await Promise.allSettled(promises);

      for (const r of results) {
        if (r.status === "fulfilled") {
          allResults.push(...r.value);
        }
      }
    }

    return NextResponse.json({
      query,
      count: allResults.length,
      results: allResults,
      sources: COMMUNITY_REPOS,
    }, {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (err) {
    console.error("[marketplace/community-search]", err);
    return NextResponse.json(
      { error: "Community search failed", results: [] },
      { status: 500 }
    );
  }
});
