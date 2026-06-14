#!/usr/bin/env npx tsx
/**
 * scripts/backfill-constraints.ts — Phase 13.A backfill
 *
 * Reads existing registry.json + SKILL.md files to estimate constraint values
 * for library_skills and library_functions tables.
 *
 * Usage: npx tsx scripts/backfill-constraints.ts [--dry-run]
 *
 * Estimates:
 *   context_tokens_estimated: chars in content / 2.5 (rough token estimate)
 *   typical_latency_ms: 200ms base + 50ms per dependency
 *   cost_per_invocation_usd: tokens * $3/1M tokens (Claude Sonnet pricing)
 *   dependencies: from registry.json
 *   optimal_for: primary_domain + also_in domains
 *   suboptimal_for: empty (filled by refinement loop)
 */

import { config } from "dotenv";
import postgres from "postgres";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

config({ path: ".env.local" });

const POSTGRES_URL = process.env.POSTGRES_URL;
const CWD = process.cwd();
const DRY_RUN = process.argv.includes("--dry-run");

// ── Helpers ──────────────────────────────────────────────────────────────────

function estimateTokens(content: string | null): number {
  if (!content) return 0;
  return Math.ceil(content.length / 2.5);
}

function estimateLatency(deps: string[]): number {
  // Base 200ms + 50ms per dependency
  return 200 + deps.length * 50;
}

function estimateCost(tokens: number): number {
  // Claude Sonnet ~$3/1M input tokens
  return (tokens / 1_000_000) * 3;
}

// ── Registry reader ──────────────────────────────────────────────────────────

interface RegistryEntry {
  name: string;
  primary_domain: string;
  also_in: string[];
  dependencies: string[];
}

function readRegistry(): { connectors: RegistryEntry[]; functions: RegistryEntry[] } {
  const registryPath = join(CWD, "skills", "registry.json");
  if (!existsSync(registryPath)) {
    console.warn("registry.json not found, using empty data");
    return { connectors: [], functions: [] };
  }
  const raw = JSON.parse(readFileSync(registryPath, "utf-8"));
  return {
    connectors: raw.connectors || [],
    functions: raw.functions || [],
  };
}

// ── SKILL.md reader ──────────────────────────────────────────────────────────

function readSkillContent(skillName: string, type: string): string | null {
  const candidates: string[] = [];
  if (type === "connector") {
    candidates.push(
      join(CWD, "connectors", skillName.replace(/-connector$/, ""), "SKILL.md"),
      join(CWD, "connectors", skillName.replace(/-connector$/, ""), "PLAYBOOK.md"),
    );
  } else if (type === "function") {
    candidates.push(
      join(CWD, "skills", "functions", skillName, "SKILL.md"),
      join(CWD, "functions", skillName + ".md"),
    );
  }

  for (const p of candidates) {
    if (existsSync(p)) {
      try {
        return readFileSync(p, "utf-8");
      } catch {
        continue;
      }
    }
  }
  return null;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!POSTGRES_URL) {
    console.error("POSTGRES_URL not defined");
    process.exit(1);
  }

  const sql = postgres(POSTGRES_URL, { max: 1 });
  const registry = readRegistry();

  console.log(`Phase 13.A: Backfilling constraints for library_skills + library_functions`);
  console.log(`Registry: ${registry.connectors.length} connectors, ${registry.functions.length} functions`);
  if (DRY_RUN) console.log("🔍 DRY RUN — no writes\n");

  let updatedSkills = 0;
  let updatedFunctions = 0;

  // ── Backfill library_skills ────────────────────────────────────────────────
  for (const entry of registry.connectors) {
    const content = readSkillContent(entry.name, "connector");
    const tokens = estimateTokens(content);
    const latency = estimateLatency(entry.dependencies || []);
    const cost = Math.round(estimateCost(tokens) * 1_000_000) / 1_000_000;

    const optimalFor = [entry.primary_domain, ...(entry.also_in || [])].filter(Boolean);
    const deps = entry.dependencies || [];

    const updateData = {
      context_tokens_estimated: tokens || null,
      typical_latency_ms: latency,
      cost_per_invocation_usd: cost,
      dependencies: JSON.stringify(deps),
      incompatible_with: JSON.stringify([]),
      optimal_for: JSON.stringify(optimalFor),
      suboptimal_for: JSON.stringify([]),
    };

    console.log(`  📦 ${entry.name}: tokens=${tokens} latency=${latency}ms cost=$${cost.toFixed(6)} deps=[${deps.join(",")}] optimal=[${optimalFor.join(",")}]`);

    if (!DRY_RUN) {
      await sql`
        UPDATE "library_skills"
        SET ${sql(updateData)}
        WHERE "name" = ${entry.name} OR "connector_name" = ${entry.name}
      `;
    }
    updatedSkills++;
  }

  // ── Backfill library_functions ──────────────────────────────────────────────
  for (const entry of registry.functions) {
    const content = readSkillContent(entry.name, "function");
    const tokens = estimateTokens(content || `# ${entry.name}\n\nSignature: unknown`);
    const latency = estimateLatency(entry.dependencies || []);
    const cost = Math.round(estimateCost(tokens) * 1_000_000) / 1_000_000;

    const optimalFor = [entry.primary_domain, ...(entry.also_in || [])].filter(Boolean);

    const updateData = {
      context_tokens_estimated: tokens || 200,
      typical_latency_ms: latency,
      cost_per_invocation_usd: cost,
      incompatible_with: JSON.stringify([]),
      optimal_for: JSON.stringify(optimalFor),
      suboptimal_for: JSON.stringify([]),
    };

    console.log(`  🔧 ${entry.name}: tokens=${tokens} latency=${latency}ms cost=$${cost.toFixed(6)} deps=[${(entry.dependencies || []).join(",")}] optimal=[${optimalFor.join(",")}]`);

    if (!DRY_RUN) {
      await sql`
        UPDATE "library_functions"
        SET ${sql(updateData)}
        WHERE "name" = ${entry.name}
      `;
    }
    updatedFunctions++;
  }

  console.log(`\n✅ Backfill complete: ${updatedSkills} skills, ${updatedFunctions} functions`);
  if (DRY_RUN) console.log("🔍 DRY RUN — no changes written. Remove --dry-run to apply.");

  await sql.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
