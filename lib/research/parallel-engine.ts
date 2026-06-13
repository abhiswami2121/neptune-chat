/**
 * lib/research/parallel-engine.ts
 * U5.5 — Parallel Multi-Source Research Engine
 *
 * Fires 5 research sources in Promise.all with 30s per-source timeout.
 * Synthesizes results ranked by confidence + recency + relevance.
 * Gracefully handles source failures — never blocks on a single source.
 *
 * Architecture:
 * - 5 sources: tavilySearch, exaSearch, githubCodeSearch, webSearch, smitheryMcpSearch
 * - Each source gets 30s timeout, runs in parallel
 * - Failed sources are skipped (logged, not fatal)
 * - synthesize() merges results with weighted scoring
 * - Structured output: {findings, sources, confidence, recommendations}
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface ResearchSource {
  /** Unique source identifier */
  id: string;
  /** Human-readable source name */
  name: string;
  /** Source type: api (requires key) or local (always available) */
  type: "api" | "local";
  /** Environment variable for API key (if api type) */
  apiKeyEnv?: string;
  /** Whether the API key is currently configured */
  configured: boolean;
  /** Source weight for scoring (0.0-1.0) */
  weight: number;
  /** Per-source timeout in milliseconds */
  timeoutMs: number;
}

export interface SourceResult {
  source: ResearchSource;
  status: "success" | "timeout" | "error" | "skipped";
  results: ResearchFinding[];
  resultCount: number;
  responseTimeMs: number;
  errorMessage?: string;
}

export interface ResearchFinding {
  title: string;
  url?: string;
  snippet: string;
  publishedDate?: string;
  relevanceScore?: number;
}

export interface SynthesisResult {
  query: string;
  findings: Array<{
    keyFinding: string;
    confidence: number;
    supportingSources: string[];
    evidence: string;
    strength: "strong" | "moderate" | "weak" | "speculative";
  }>;
  sources: Array<{
    name: string;
    status: "success" | "timeout" | "error" | "skipped";
    resultCount: number;
    confidence: number;
    responseTimeMs: number;
  }>;
  overallConfidence: number;
  recommendations: Array<{
    recommendation: string;
    confidence: number;
    basedOn: string[];
    urgency: "high" | "medium" | "low";
  }>;
  contradictions: Array<{
    topic: string;
    positions: Array<{ source: string; claim: string }>;
    resolution: string;
  }>;
  generatedAt: string;
  queryTimeMs: number;
}

// ── Source Definitions ─────────────────────────────────────────────────────

const RESEARCH_SOURCES: ResearchSource[] = [
  {
    id: "tavily_search",
    name: "Tavily Search",
    type: "api",
    apiKeyEnv: "TAVILY_API_KEY",
    configured: false, // checked at runtime
    weight: 1.0,
    timeoutMs: 30000,
  },
  {
    id: "exa_search",
    name: "Exa Search",
    type: "api",
    apiKeyEnv: "EXA_API_KEY",
    configured: false,
    weight: 0.9,
    timeoutMs: 30000,
  },
  {
    id: "github_code_search",
    name: "GitHub Code Search",
    type: "local",
    weight: 0.8,
    configured: true, // always available via public API
    timeoutMs: 30000,
  },
  {
    id: "web_search",
    name: "Web Search (DuckDuckGo)",
    type: "local",
    weight: 0.7,
    configured: true, // always available
    timeoutMs: 30000,
  },
  {
    id: "smithery_mcp_search",
    name: "Smithery MCP Search",
    type: "api",
    apiKeyEnv: "SMITHERY_API_KEY",
    configured: false,
    weight: 0.8,
    timeoutMs: 30000,
  },
];

// ── Configuration ──────────────────────────────────────────────────────────

const MIN_SOURCES_REQUIRED = 2;
const GLOBAL_TIMEOUT_MS = 35000;
const DEFAULT_PER_SOURCE_TIMEOUT = 30000;

// ── API Key Management ─────────────────────────────────────────────────────

/**
 * Check which sources have their API keys configured.
 * Called at runtime before each research operation.
 */
export function checkSourceAvailability(): ResearchSource[] {
  return RESEARCH_SOURCES.map((source) => {
    if (source.type === "local") return { ...source, configured: true };
    const key = process.env[source.apiKeyEnv!];
    return { ...source, configured: !!key && key.length > 0 };
  });
}

/**
 * Get list of missing API keys that need to be staged.
 */
export function getMissingApiKeys(): string[] {
  return RESEARCH_SOURCES
    .filter((s) => s.type === "api" && !process.env[s.apiKeyEnv!])
    .map((s) => s.apiKeyEnv!);
}

// ── Source Query Functions ─────────────────────────────────────────────────

/**
 * Query Tavily Search API.
 * Requires TAVILY_API_KEY env var.
 */
async function queryTavily(query: string, timeoutMs: number): Promise<ResearchFinding[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("TAVILY_API_KEY not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        max_results: 5,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Tavily returned ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    return (data.results || []).map((r: any) => ({
      title: r.title || "",
      url: r.url || "",
      snippet: r.content || r.snippet || "",
      publishedDate: r.published_date,
      relevanceScore: r.score,
    }));
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Query Exa Search API.
 * Requires EXA_API_KEY env var.
 */
async function queryExa(query: string, timeoutMs: number): Promise<ResearchFinding[]> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) throw new Error("EXA_API_KEY not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        query,
        numResults: 5,
        useAutoprompt: true,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Exa returned ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    return (data.results || []).map((r: any) => ({
      title: r.title || "",
      url: r.url || "",
      snippet: r.text || r.snippet || "",
      publishedDate: r.publishedDate,
      relevanceScore: r.score,
    }));
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Query GitHub Code Search API.
 * Always available (public endpoint, no key required for basic search).
 */
async function queryGitHub(query: string, timeoutMs: number): Promise<ResearchFinding[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const q = encodeURIComponent(`${query} language:typescript`);
    const res = await fetch(
      `https://api.github.com/search/code?q=${q}&per_page=5`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Neptune-Chat/Research-Engine",
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`GitHub returned ${res.status}`);
    }

    const data = await res.json();
    return (data.items || []).map((item: any) => ({
      title: `${item.repository?.full_name || "unknown"}: ${item.name}`,
      url: item.html_url,
      snippet: `Repository: ${item.repository?.full_name}, Path: ${item.path}`,
      publishedDate: undefined,
      relevanceScore: item.score ? item.score / 10 : 0.5,
    }));
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Query DuckDuckGo Instant Answer API.
 * Always available (public API, no key required).
 */
async function queryWebSearch(query: string, timeoutMs: number): Promise<ResearchFinding[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const q = encodeURIComponent(query);
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${q}&format=json&no_html=1&skip_disambig=1`,
      {
        headers: { "User-Agent": "Neptune-Chat/Research-Engine" },
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`DuckDuckGo returned ${res.status}`);
    }

    const data = await res.json();

    const findings: ResearchFinding[] = [];

    if (data.AbstractText) {
      findings.push({
        title: data.Heading || "DuckDuckGo Abstract",
        url: data.AbstractURL,
        snippet: data.AbstractText,
        relevanceScore: 0.7,
      });
    }

    for (const topic of data.RelatedTopics?.slice(0, 4) || []) {
      if (topic.Text) {
        findings.push({
          title: topic.FirstURL || "Related Topic",
          url: topic.FirstURL,
          snippet: topic.Text,
          relevanceScore: 0.5,
        });
      }
    }

    return findings;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Query Smithery MCP Search.
 * Requires SMITHERY_API_KEY env var.
 */
async function querySmithery(query: string, timeoutMs: number): Promise<ResearchFinding[]> {
  const apiKey = process.env.SMITHERY_API_KEY;
  if (!apiKey) throw new Error("SMITHERY_API_KEY not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const q = encodeURIComponent(query);
    const res = await fetch(
      `https://api.smithery.ai/v1/search?q=${q}&limit=5`,
      {
        headers: {
          "x-api-key": apiKey,
          "User-Agent": "Neptune-Chat/Research-Engine",
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Smithery returned ${res.status}`);
    }

    const data = await res.json();
    return (data.results || data.servers || []).map((r: any) => ({
      title: r.name || r.title || "MCP Server",
      url: r.url || r.homepage,
      snippet: r.description || r.snippet || "",
      publishedDate: undefined,
      relevanceScore: r.score || 0.6,
    }));
  } finally {
    clearTimeout(timeout);
  }
}

// ── Source Dispatcher ──────────────────────────────────────────────────────

const SOURCE_QUERY_MAP: Record<string, (q: string, t: number) => Promise<ResearchFinding[]>> = {
  tavily_search: queryTavily,
  exa_search: queryExa,
  github_code_search: queryGitHub,
  web_search: queryWebSearch,
  smithery_mcp_search: querySmithery,
};

// ── Parallel Execution ─────────────────────────────────────────────────────

/**
 * Execute a single source query with timeout and error handling.
 */
async function executeSource(
  source: ResearchSource,
  query: string
): Promise<SourceResult> {
  const start = Date.now();

  if (!source.configured) {
    return {
      source,
      status: "skipped",
      results: [],
      resultCount: 0,
      responseTimeMs: Date.now() - start,
      errorMessage: `${source.apiKeyEnv} not configured. Stage via Vercel REST API.`,
    };
  }

  const queryFn = SOURCE_QUERY_MAP[source.id];
  if (!queryFn) {
    return {
      source,
      status: "error",
      results: [],
      resultCount: 0,
      responseTimeMs: Date.now() - start,
      errorMessage: `No query function for source '${source.id}'`,
    };
  }

  try {
    // Race between the query and the timeout
    const results = await Promise.race([
      queryFn(query, source.timeoutMs),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${source.timeoutMs}ms`)), source.timeoutMs)
      ),
    ]);

    return {
      source,
      status: "success",
      results,
      resultCount: results.length,
      responseTimeMs: Date.now() - start,
    };
  } catch (err: any) {
    const isTimeout =
      err?.message?.includes("Timeout") ||
      err?.name === "AbortError" ||
      err?.message?.includes("aborted");

    return {
      source,
      status: isTimeout ? "timeout" : "error",
      results: [],
      resultCount: 0,
      responseTimeMs: Date.now() - start,
      errorMessage: err?.message || "Unknown error",
    };
  }
}

/**
 * Execute all configured sources in parallel with per-source timeouts.
 * Minimum 2 sources must succeed for valid results.
 */
export async function executeResearch(
  query: string,
  options?: {
    sources?: string[]; // specific source IDs to use
    timeoutMs?: number; // global timeout
  }
): Promise<SourceResult[]> {
  const availableSources = checkSourceAvailability();

  let sources = availableSources;
  if (options?.sources) {
    sources = availableSources.filter((s) => options.sources!.includes(s.id));
  }

  // Set global timeout
  const globalTimeout = options?.timeoutMs || GLOBAL_TIMEOUT_MS;

  const sourcePromises = sources.map((source) => executeSource(source, query));

  // Race between all sources completing and global timeout
  try {
    const results = await Promise.race([
      Promise.all(sourcePromises),
      new Promise<SourceResult[]>((resolve) =>
        setTimeout(() => {
          // On global timeout, collect whatever we have
          console.warn(`[research-engine] Global timeout ${globalTimeout}ms reached`);
          resolve(
            sources.map((s) => ({
              source: s,
              status: "timeout" as const,
              results: [],
              resultCount: 0,
              responseTimeMs: globalTimeout,
              errorMessage: "Global timeout reached",
            }))
          );
        }, globalTimeout)
      ),
    ]);

    return results;
  } catch (err) {
    console.error("[research-engine] Fatal error in parallel execution:", err);
    return sources.map((s) => ({
      source: s,
      status: "error" as const,
      results: [],
      resultCount: 0,
      responseTimeMs: 0,
      errorMessage: `Fatal error: ${err instanceof Error ? err.message : "Unknown"}`,
    }));
  }
}

// ── Synthesis ──────────────────────────────────────────────────────────────

interface ScoredFinding {
  finding: ResearchFinding;
  sourceId: string;
  sourceWeight: number;
  confidenceScore: number;
  recencyScore: number;
  relevanceScore: number;
  finalScore: number;
}

/**
 * Score findings by confidence (0.4) + recency (0.3) + relevance (0.3).
 */
function scoreFindings(results: SourceResult[]): ScoredFinding[] {
  const scored: ScoredFinding[] = [];
  const now = Date.now();

  for (const result of results) {
    if (result.status !== "success") continue;

    const sourceWeight = result.source.weight;

    for (const finding of result.results) {
      // Confidence: source weight * (1.0 if successful, lower if low count)
      const confidenceScore = sourceWeight * 0.4;

      // Recency: newer = higher score (decay over 365 days)
      let recencyScore = 0.3;
      if (finding.publishedDate) {
        const publishedMs = new Date(finding.publishedDate).getTime();
        if (!isNaN(publishedMs)) {
          const daysOld = (now - publishedMs) / (1000 * 60 * 60 * 24);
          recencyScore = Math.max(0, 0.3 * (1 - daysOld / 365));
        }
      }

      // Relevance: based on source's relevance score or default
      const relevanceScore =
        (finding.relevanceScore || 0.5) * 0.3;

      const finalScore = confidenceScore + recencyScore + relevanceScore;

      scored.push({
        finding,
        sourceId: result.source.id,
        sourceWeight,
        confidenceScore,
        recencyScore,
        relevanceScore,
        finalScore,
      });
    }
  }

  // Sort by final score descending
  scored.sort((a, b) => b.finalScore - a.finalScore);

  return scored;
}

/**
 * Synthesize results from multiple sources into a unified output.
 */
export function synthesize(
  query: string,
  results: SourceResult[],
  queryStartMs: number
): SynthesisResult {
  const scored = scoreFindings(results);

  // Group findings by topic similarity (simple deduplication by title overlap)
  const grouped = new Map<string, ScoredFinding[]>();
  for (const s of scored) {
    const key = s.finding.title.slice(0, 60).toLowerCase();
    const existing = grouped.get(key) || [];
    existing.push(s);
    grouped.set(key, existing);
  }

  // Synthesize each group into a key finding
  const synthesizedFindings = Array.from(grouped.entries()).map(([topicKey, groupScored]) => {
    const best = groupScored[0];
    const avgConfidence =
      groupScored.reduce((sum, s) => sum + s.finalScore, 0) / groupScored.length;
    const supportingSources = Array.from(new Set(groupScored.map((s) => s.sourceId)));

    let strength: "strong" | "moderate" | "weak" | "speculative";
    if (supportingSources.length >= 3 && avgConfidence >= 0.6) strength = "strong";
    else if (supportingSources.length >= 2 && avgConfidence >= 0.4) strength = "moderate";
    else if (supportingSources.length >= 1 && avgConfidence >= 0.25) strength = "weak";
    else strength = "speculative";

    return {
      keyFinding: best.finding.snippet || best.finding.title,
      confidence: Math.round(avgConfidence * 100) / 100,
      supportingSources,
      evidence: best.finding.url || best.finding.title,
      strength,
    };
  });

  // Calculate overall confidence
  const successfulSources = results.filter((r) => r.status === "success");
  const avgSourceWeight =
    successfulSources.length > 0
      ? successfulSources.reduce((sum, r) => sum + r.source.weight, 0) /
        successfulSources.length
      : 0;

  const overallConfidence =
    synthesizedFindings.length > 0
      ? Math.round(
          (synthesizedFindings.reduce((sum, f) => sum + f.confidence, 0) /
            synthesizedFindings.length) *
            avgSourceWeight *
            100
        ) / 100
      : 0;

  // Generate recommendations
  const recommendations = synthesizedFindings
    .filter((f) => f.strength === "strong" || f.strength === "moderate")
    .slice(0, 5)
    .map((f) => ({
      recommendation: `Based on ${f.supportingSources.length} source(s): ${f.keyFinding.slice(0, 150)}`,
      confidence: f.confidence,
      basedOn: f.supportingSources,
      urgency: (f.strength === "strong" ? "high" : "medium") as "high" | "medium" | "low",
    }));

  // Detect contradictions (simplified: flag topics with conflicting scores)
  const contradictions: SynthesisResult["contradictions"] = [];
  const uniqueTopics = Array.from(new Set(scored.map((s) => s.finding.title.slice(0, 80).toLowerCase())));
  for (const topic of uniqueTopics) {
    const conflicting = scored.filter(
      (s) =>
        s.finding.title.slice(0, 80).toLowerCase() === topic &&
        s.finalScore < 0.2
    );
    if (conflicting.length > 0) {
      const supportive = scored.filter(
        (s) =>
          s.finding.title.slice(0, 80).toLowerCase() === topic &&
          s.finalScore >= 0.3
      );
      if (supportive.length > 0 && conflicting.length > 0) {
        contradictions.push({
          topic: topic.slice(0, 100),
          positions: [
            ...supportive.slice(0, 2).map((s) => ({
              source: s.sourceId,
              claim: s.finding.snippet.slice(0, 100),
            })),
            ...conflicting.slice(0, 1).map((s) => ({
              source: s.sourceId,
              claim: s.finding.snippet.slice(0, 100),
            })),
          ],
          resolution: supportive.length > conflicting.length ? "Majority support" : "Mixed evidence",
        });
      }
    }
  }

  return {
    query,
    findings: synthesizedFindings.slice(0, 15),
    sources: results.map((r) => ({
      name: r.source.name,
      status: r.status,
      resultCount: r.resultCount,
      confidence: r.status === "success" ? r.source.weight : 0,
      responseTimeMs: r.responseTimeMs,
    })),
    overallConfidence,
    recommendations,
    contradictions: contradictions.slice(0, 5),
    generatedAt: new Date().toISOString(),
    queryTimeMs: Date.now() - queryStartMs,
  };
}

// ── Convenience: Full Research Pipeline ────────────────────────────────────

/**
 * Run the complete research pipeline: execute → synthesize → return.
 * Min 2 sources must return results for valid output.
 */
export async function research(query: string): Promise<{
  success: boolean;
  synthesis: SynthesisResult | null;
  rawResults: SourceResult[];
  error?: string;
}> {
  const start = Date.now();
  const results = await executeResearch(query);

  const successfulSources = results.filter((r) => r.status === "success");
  if (successfulSources.length < MIN_SOURCES_REQUIRED) {
    return {
      success: false,
      synthesis: null,
      rawResults: results,
      error: `Only ${successfulSources.length}/${results.length} sources returned results. Minimum ${MIN_SOURCES_REQUIRED} required. Available: ${results.map((r) => `${r.source.name}(${r.status})`).join(", ")}`,
    };
  }

  const synthesis = synthesize(query, results, start);
  return {
    success: true,
    synthesis,
    rawResults: results,
  };
}
