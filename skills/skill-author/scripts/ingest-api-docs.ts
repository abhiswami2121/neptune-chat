/**
 * ingest-api-docs.ts — U2.5.A skill-author script
 *
 * Fetches API documentation from a URL and writes it to
 * connectors/<connector>/docs/api-reference.md
 *
 * Uses Node.js fetch (available in Next.js server runtime / Vercel Sandbox).
 *
 * Safety: only writes to connectors/_test_* OR explicitly named connector.
 *
 * Usage via execute_skill:
 *   execute_skill skills/skill-author scripts/ingest-api-docs.ts {
 *     url: "https://catfact.ninja/",
 *     connector_name: "cat-facts"
 *   }
 */

import { z } from "zod";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

// ── Schema ──────────────────────────────────────────────────────────────────

export const IngestApiDocsSchema = z.object({
  url: z.string().url().describe("URL of the API documentation page"),
  connector_name: z.string().min(2).describe("Target connector name (e.g., 'cat-facts')"),
  api_base_url: z.string().optional().describe("Base URL for the API (if different from docs)"),
  additional_endpoints: z
    .array(z.string())
    .optional()
    .describe("Extra endpoint paths to document"),
});

export type IngestApiDocsInput = z.infer<typeof IngestApiDocsSchema>;

// ── Output ──────────────────────────────────────────────────────────────────

export interface SkillScriptOutput {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

// ── Safety ──────────────────────────────────────────────────────────────────

function isSafeTarget(name: string): boolean {
  if (name.startsWith("_test_")) return true;
  const forbidden = ["base44", "nmi", "slack", "hyperswitch", "vapi"];
  if (forbidden.includes(name)) {
    throw new Error(`SAFETY: Cannot write docs for production connector '${name}'. Use _test_ prefix.`);
  }
  return true;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractEndpoints(text: string, baseUrl: string): string[] {
  const endpoints: string[] = [];
  // Match common API doc patterns: GET /path, POST /path, etc.
  const methodPattern = /(GET|POST|PUT|PATCH|DELETE)\s+(\/[^\s,)]+)/gi;
  let match;
  while ((match = methodPattern.exec(text)) !== null) {
    endpoints.push(`${match[1]} ${match[2]}`);
  }
  // Also try OpenAPI-style paths
  const pathPattern = /['"`](\/[a-zA-Z0-9_\-/:]+)['"`]/g;
  while ((match = pathPattern.exec(text)) !== null) {
    if (!endpoints.some((e) => e.includes(match![1]))) {
      endpoints.push(`GET ${match[1]}`);
    }
  }
  return [...new Set(endpoints)].slice(0, 20);
}

// ── Main Function ───────────────────────────────────────────────────────────

export async function execute(input: IngestApiDocsInput): Promise<SkillScriptOutput> {
  try {
    const { url, connector_name, api_base_url, additional_endpoints } =
      IngestApiDocsSchema.parse(input);

    isSafeTarget(connector_name);

    const CWD = process.cwd();
    const docsDir = join(CWD, "connectors", connector_name, "docs");
    const outputPath = join(docsDir, "api-reference.md");

    // Ensure docs directory exists
    if (!existsSync(docsDir)) {
      mkdirSync(docsDir, { recursive: true });
    }

    // Fetch the documentation page
    let rawContent = "";
    let fetchedSuccessfully = false;
    let fetchError = "";

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);

      const res = await fetch(url, {
        headers: {
          "User-Agent": "Neptune-Chat/skill-author (ingest-api-docs)",
          Accept: "text/html, application/json, text/plain, */*",
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) {
        const text = await res.text();
        rawContent = stripHtml(text);
        fetchedSuccessfully = true;
      } else {
        fetchError = `HTTP ${res.status}: ${res.statusText}`;
      }
    } catch (err) {
      fetchError = err instanceof Error ? err.message : String(err);
    }

    // Extract endpoints
    const base = api_base_url || url.replace(/\/$/, "");
    const endpoints = extractEndpoints(rawContent, base);

    // Add any additional endpoints
    if (additional_endpoints) {
      endpoints.push(...additional_endpoints);
    }

    // ── Write docs ───────────────────────────────────────────────────────

    const now = new Date().toISOString();
    let doc = `# ${connector_name} API Reference\n\n`;
    doc += `**Generated:** ${now}\n`;
    doc += `**Source:** ${url}\n`;
    doc += `**Status:** ${fetchedSuccessfully ? "✅ Fetched successfully" : `⚠️ Fetch warning: ${fetchError}`}\n\n`;
    doc += `---\n\n`;

    if (endpoints.length > 0) {
      doc += `## Discovered Endpoints\n\n`;
      doc += `| Method | Path | Description |\n`;
      doc += `|--------|------|-------------|\n`;
      for (const ep of endpoints) {
        const [method, path] = ep.split(" ");
        doc += `| ${method} | \`${path}\` | TODO |\n`;
      }
      doc += `\n`;
    }

    if (fetchedSuccessfully && rawContent) {
      doc += `## Raw Documentation Excerpt\n\n`;
      // Truncate to keep file manageable
      const excerpt = rawContent.slice(0, 10_000);
      doc += `\`\`\`\n${excerpt}\n\`\`\`\n\n`;
      if (rawContent.length > 10_000) {
        doc += `*(Content truncated — ${rawContent.length} total chars, showing first 10,000)*\n\n`;
      }
    } else {
      doc += `## Manual Endpoints\n\n`;
      doc += `API documentation could not be auto-fetched. Endpoints must be documented manually.\n\n`;
      doc += `Fetch error: ${fetchError}\n\n`;
    }

    doc += `## Usage Notes\n\n`;
    doc += `- **Base URL:** ${base}\n`;
    doc += `- **Auth:** None (public API)\n`;
    doc += `- **Rate Limit:** Unknown — check API docs\n\n`;
    doc += `---\n*Generated by skill-author/ingest-api-docs*`;

    writeFileSync(outputPath, doc);

    return {
      success: true,
      data: {
        connector_name,
        source_url: url,
        docs_path: `connectors/${connector_name}/docs/api-reference.md`,
        fetched_successfully: fetchedSuccessfully,
        endpoints_discovered: endpoints,
        endpoint_count: endpoints.length,
        raw_length: rawContent.length,
        next_step:
          endpoints.length > 0
            ? `Found ${endpoints.length} endpoints. Run wrap-api-endpoint.ts for each.`
            : "No endpoints auto-discovered. Document manually and run wrap-api-endpoint.ts.",
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `ingest-api-docs failed: ${msg}` };
  }
}

export default execute;
