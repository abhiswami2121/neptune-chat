/**
 * Playbook Refinement Script
 *
 * Audits connector tool usage logs and refines PLAYBOOK.md files
 * via AI Gateway DeepSeek calls. Runs nightly via cron or manually.
 *
 * Usage:
 *   bun run scripts/refine-playbooks.ts --all        # Refine all playbooks
 *   bun run scripts/refine-playbooks.ts --connector=slack  # Single connector
 *   bun run scripts/refine-playbooks.ts --dry-run     # Analysis only, no changes
 *   bun run scripts/refine-playbooks.ts --force       # Skip confidence threshold
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createClient } from "@vercel/postgres";

// ── Config ──────────────────────────────────────────────────────────────────

const DEEPSEEK_GATEWAY_URL =
  process.env.DEEPSEEK_GATEWAY_URL || "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const MIN_CONFIDENCE = Number(process.env.MIN_CONFIDENCE || 0.8);
const LOG_DIR = resolve(process.cwd(), "logs");

const CONNECTORS = [
  "slack", "ghl", "github", "nmi", "vercel", "hyperswitch",
  "base44", "affy", "forth", "linear", "wiki", "vapi", "mcp-hub",
];

// ── Types ──────────────────────────────────────────────────────────────────

interface ToolUsageStats {
  connector: string;
  totalCalls: number;
  errors: Array<{ tool: string; error: string; count: number }>;
  successRate: number;
  avgDuration: number;
  topPatterns: Array<{ sequence: string; count: number }>;
  rateLimitEvents: number;
  authFailures: number;
}

interface RefinementSuggestion {
  section: string;
  content: string;
  confidence: number;
  reasoning: string;
}

// ── Tool Usage Audit ───────────────────────────────────────────────────────

async function auditToolUsage(connector: string): Promise<ToolUsageStats | null> {
  if (!process.env.POSTGRES_URL) {
    console.warn("[refine-playbooks] POSTGRES_URL not set — skipping audit query");
    return null;
  }

  const client = createClient({ connectionString: process.env.POSTGRES_URL });
  await client.connect();

  try {
    // Query tool_calls from the past 24 hours for this connector
    const result = await client.query(
      `SELECT
        tool_name,
        COUNT(*) as call_count,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
        AVG(duration_ms) as avg_duration
       FROM tool_calls
       WHERE created_at > NOW() - INTERVAL '24 hours'
         AND tool_name LIKE $1
       GROUP BY tool_name
       ORDER BY call_count DESC`,
      [`${connector}.%`]
    );

    // Also check for inline tool names (e.g., pullSlackMessages)
    const inlineResult = await client.query(
      `SELECT
        tool_name,
        COUNT(*) as call_count,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
        AVG(duration_ms) as avg_duration
       FROM tool_calls
       WHERE created_at > NOW() - INTERVAL '24 hours'
         AND tool_name = ANY($1)
       GROUP BY tool_name`,
      [getInlineToolNames(connector)]
    );

    const allRows = [...result.rows, ...inlineResult.rows];

    if (allRows.length === 0) return null;

    const totalCalls = allRows.reduce((sum, r) => sum + Number(r.call_count), 0);
    const totalErrors = allRows.reduce((sum, r) => sum + Number(r.error_count), 0);

    return {
      connector,
      totalCalls,
      errors: allRows
        .filter((r) => Number(r.error_count) > 0)
        .map((r) => ({
          tool: r.tool_name,
          error: "Error reported",
          count: Number(r.error_count),
        })),
      successRate: totalCalls > 0 ? (totalCalls - totalErrors) / totalCalls : 1,
      avgDuration: allRows.reduce(
        (sum, r, _, arr) => sum + Number(r.avg_duration) / arr.length, 0
      ),
      topPatterns: [],
      rateLimitEvents: 0,
      authFailures: 0,
    };
  } catch (err) {
    console.error(`[refine-playbooks] Audit failed for ${connector}:`, err);
    return null;
  } finally {
    await client.end();
  }
}

function getInlineToolNames(connector: string): string[] {
  const mappings: Record<string, string[]> = {
    slack: ["pullSlackMessages"],
    github: ["spawnCodingAgent"],
    vapi: ["listV2Sessions", "getV2Session", "postV2Session", "streamV2Progress", "controlV2Session"],
    base44: ["queryDatabase"],
  };
  return mappings[connector] || [];
}

// ── AI Gateway Analysis ────────────────────────────────────────────────────

async function analyzeWithDeepSeek(
  playbookContent: string,
  stats: ToolUsageStats
): Promise<RefinementSuggestion[]> {
  if (!DEEPSEEK_API_KEY) {
    console.warn("[refine-playbooks] DEEPSEEK_API_KEY not set — skipping AI analysis");
    return [];
  }

  const prompt = `You are a PLAYBOOK.md refinement engine for Neptune's connector playbook system.

Given the current PLAYBOOK.md content and tool usage statistics from the past 24 hours,
suggest improvements to make the playbook more useful for AI agents using these tools.

CURRENT PLAYBOOK:
${playbookContent.slice(0, 8000)}

USAGE STATISTICS (24h):
- Total calls: ${stats.totalCalls}
- Success rate: ${(stats.successRate * 100).toFixed(1)}%
- Errors: ${JSON.stringify(stats.errors.slice(0, 5))}
- Average duration: ${stats.avgDuration.toFixed(0)}ms

Provide JSON array of refinement suggestions. Each suggestion must have:
- section: Which playbook section to modify (Operational Knowledge, Anti-Patterns, Safeguards, Common Workflows)
- content: The new content to ADD (not replace — append to existing section)
- confidence: 0.0 to 1.0 how confident you are this is needed
- reasoning: Why this refinement improves the playbook

Only include suggestions with confidence > 0.7. Be conservative — only add truly new information.
Focus on: new error patterns, missing safeguards, undocumented workflows found in usage data.

Respond with ONLY valid JSON array, no markdown formatting.`;

  try {
    const res = await fetch(DEEPSEEK_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "You are a precise JSON-generating playbook refinement engine." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });

    if (!res.ok) {
      console.error(`[refine-playbooks] AI Gateway returned ${res.status}`);
      return [];
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return [];

    // Extract JSON from response (may be wrapped in markdown code block)
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || content.match(/^\[([\s\S]*)\]$/);
    const jsonStr = jsonMatch ? (jsonMatch[1] || content) : content;

    const suggestions: RefinementSuggestion[] = JSON.parse(jsonStr.trim());
    return Array.isArray(suggestions) ? suggestions : [];
  } catch (err) {
    console.error("[refine-playbooks] AI analysis failed:", err);
    return [];
  }
}

// ── Apply Refinements ──────────────────────────────────────────────────────

function applyRefinements(
  playbookPath: string,
  suggestions: RefinementSuggestion[],
  isDryRun: boolean
): number {
  const originalContent = readFileSync(playbookPath, "utf-8");

  let modifiedContent = originalContent;
  let applied = 0;

  // Sort suggestions: Anti-Patterns before Safeguards before Common Workflows
  const priority: Record<string, number> = {
    "Operational Knowledge": 1,
    "Anti-Patterns": 3, // Highest priority
    Safeguards: 2,
    "Common Workflows": 1,
  };

  const sorted = [...suggestions].sort(
    (a, b) => (priority[b.section] || 0) - (priority[a.section] || 0)
  );

  for (const s of sorted) {
    if (isDryRun) {
      console.log(`  [DRY RUN] Would refine #${s.section}: ${s.content.slice(0, 80)}... (confidence: ${s.confidence})`);
      applied++;
      continue;
    }

    // Find the section heading and append content
    const sectionRegex = new RegExp(
      `(## ${s.section}[\\s\\S]*?)(?=\\n## |\\n---\\n|$)`,
      "i"
    );
    const match = modifiedContent.match(sectionRegex);

    if (match) {
      const insertionPoint = match.index! + match[0].length;
      const refinementBlock = `\n\n<!-- REFINEMENT ${new Date().toISOString().split("T")[0]} — Auto-generated via playbook-refinement -->\n${s.content}\n<!-- END REFINEMENT -->`;

      modifiedContent =
        modifiedContent.slice(0, insertionPoint) +
        refinementBlock +
        modifiedContent.slice(insertionPoint);

      applied++;
    }
  }

  // Update Refinement Notes
  const today = new Date().toISOString().split("T")[0];
  const notesBlock = `\n- **${today}:** Automated refinement — ${applied} suggestion(s) applied (confidence ≥ ${MIN_CONFIDENCE})`;

  if (modifiedContent.includes("## Refinement Notes")) {
    modifiedContent = modifiedContent.replace(
      /(## Refinement Notes[\s\S]*?)(?=\n## |$)/,
      `$1${notesBlock}`
    );
  }

  if (!isDryRun && applied > 0) {
    writeFileSync(playbookPath, modifiedContent, "utf-8");
    console.log(`  Applied ${applied} refinement(s) to ${playbookPath}`);
  }

  return applied;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function refineConnector(
  connector: string,
  isDryRun: boolean,
  minConfidence: number
): Promise<number> {
  console.log(`\n[refine-playbooks] Processing: ${connector}`);

  const playbookPath = resolve(
    process.cwd(),
    `lib/connectors/${connector}/PLAYBOOK.md`
  );

  if (!existsSync(playbookPath)) {
    console.log(`  No PLAYBOOK.md found — skipping`);
    return 0;
  }

  const playbookContent = readFileSync(playbookPath, "utf-8");

  // 1. Audit tool usage
  const stats = await auditToolUsage(connector);

  if (!stats || stats.totalCalls === 0) {
    console.log(`  No tool usage data — skipping refinement`);
    return 0;
  }

  console.log(
    `  Found ${stats.totalCalls} calls (${(stats.successRate * 100).toFixed(1)}% success)`
  );

  // 2. AI Analysis
  const suggestions = await analyzeWithDeepSeek(playbookContent, stats);

  if (suggestions.length === 0) {
    console.log(`  No suggestions from AI Gateway`);
    return 0;
  }

  // 3. Filter by confidence
  const highConfidence = suggestions.filter((s) => s.confidence >= minConfidence);
  console.log(
    `  AI suggestions: ${suggestions.length} total, ${highConfidence.length} above threshold (${minConfidence})`
  );

  if (highConfidence.length === 0) return 0;

  // 4. Apply refinements
  const applied = applyRefinements(playbookPath, highConfidence, isDryRun);

  if (applied > 0) {
    // Log details
    const logPath = resolve(LOG_DIR, `playbook-refinement-${connector}-${new Date().toISOString().split("T")[0]}.json`);
    mkdirSync(LOG_DIR, { recursive: true });
    writeFileSync(
      logPath,
      JSON.stringify(
        { connector, stats, suggestions: highConfidence, applied, timestamp: new Date().toISOString() },
        null,
        2
      )
    );
  }

  return applied;
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const isForce = args.includes("--force");
  const allFlag = args.includes("--all");
  const connectorArg = args.find((a) => a.startsWith("--connector="));

  const minConfidence = isForce ? 0.5 : MIN_CONFIDENCE;

  console.log("[refine-playbooks] Starting refinement run");
  console.log(`  Mode: ${isDryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`  Min confidence: ${minConfidence}`);

  let connectorsToRefine: string[];

  if (connectorArg) {
    const name = connectorArg.split("=")[1];
    if (!CONNECTORS.includes(name)) {
      console.error(`Unknown connector: ${name}. Valid: ${CONNECTORS.join(", ")}`);
      process.exit(1);
    }
    connectorsToRefine = [name];
  } else if (allFlag) {
    connectorsToRefine = CONNECTORS;
  } else {
    console.log("Usage: --all | --connector=slack [--dry-run] [--force]");
    process.exit(0);
  }

  let totalRefined = 0;

  for (const connector of connectorsToRefine) {
    try {
      totalRefined += await refineConnector(connector, isDryRun, minConfidence);
    } catch (err) {
      console.error(`  Failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\n[refine-playbooks] Complete. ${totalRefined} suggestion(s) applied across ${connectorsToRefine.length} connector(s).`);
}

main().catch((err) => {
  console.error("[refine-playbooks] Fatal:", err);
  process.exit(1);
});
