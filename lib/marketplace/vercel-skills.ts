/**
 * lib/marketplace/vercel-skills.ts — Phase 13.G: Vercel Skills CLI Integration
 *
 * Wraps `npx skills find` and `npx skills add` for marketplace discovery.
 * Used by /api/marketplace/vercel-search and /api/marketplace/adopt routes.
 *
 * Architecture:
 *   discovery: npx skills find <query>     → returns top matches from vercel-labs/agent-skills
 *   adoption:  npx skills add <source> --skill <name> --copy  → adopts to local
 *
 * Results cached 1h to avoid hammering Vercel.
 */

import { execSync } from "child_process";

// ── Types ──────────────────────────────────────────────────────────────────

export interface VercelSkillResult {
  name: string;
  description: string;
  source: string;
  author: string;
  stars?: number;
  tags: string[];
  url: string;
}

export interface SkillsAddResult {
  success: boolean;
  skillName: string;
  source: string;
  output: string;
  error?: string;
}

// ── In-memory cache ─────────────────────────────────────────────────────────

const discoveryCache = new Map<string, { data: VercelSkillResult[]; ts: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ── Discovery: npx skills find ──────────────────────────────────────────────

export async function searchVercelSkills(query: string): Promise<VercelSkillResult[]> {
  const cacheKey = query.toLowerCase().trim();
  const cached = discoveryCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const output = execSync(`npx skills find "${query}" --json`, {
      encoding: "utf-8",
      timeout: 15_000,
      maxBuffer: 1024 * 1024, // 1MB
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: process.env.NODE_ENV || "production" },
    });

    const parsed = JSON.parse(output);
    const results: VercelSkillResult[] = Array.isArray(parsed)
      ? parsed.map((item: any) => ({
          name: item.name || item.skill || "unknown",
          description: item.description || item.prompt?.slice(0, 200) || "",
          source: item.source || item.repo || "vercel-labs/agent-skills",
          author: item.author || "vercel-labs",
          stars: item.stars,
          tags: item.tags || item.keywords || [],
          url: item.url || `https://github.com/${item.source || "vercel-labs/agent-skills"}`,
        }))
      : [];

    discoveryCache.set(cacheKey, { data: results, ts: Date.now() });
    return results;
  } catch (err) {
    // If CLI not available or errors, return empty with fallback note
    console.warn("[vercel-skills] search failed, returning empty:", (err as Error).message);
    return [];
  }
}

// ── Adoption: npx skills add ────────────────────────────────────────────────

export async function adoptVercelSkill(
  source: string,
  skillName: string
): Promise<SkillsAddResult> {
  try {
    const cmd = `npx skills add ${source} --skill ${skillName} --copy --yes`;
    const output = execSync(cmd, {
      encoding: "utf-8",
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: process.env.NODE_ENV || "production" },
    });

    return {
      success: true,
      skillName,
      source,
      output: output.trim(),
    };
  } catch (err) {
    return {
      success: false,
      skillName,
      source,
      output: "",
      error: (err as Error).message,
    };
  }
}

// ── Cache management ────────────────────────────────────────────────────────

export function clearDiscoveryCache() {
  discoveryCache.clear();
}

export function getCacheSize(): number {
  return discoveryCache.size;
}
