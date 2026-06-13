/**
 * U7.7: Knowledge Graph Seeder
 *
 * Backfills the KG from playbooks, cardinal memories, and architecture facts.
 * Target: 60+ nodes, 250+ relations.
 *
 * Usage: npx tsx scripts/seed-kg.ts [--dry-run]
 */
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join } from "path";
import postgres from "postgres";
import { upsertEntity, upsertRelation, getKgStats, kgHealthCheck } from "@/lib/knowledge/client";
import type { EntityInsert, RelationInsert } from "@/lib/knowledge/types";

const PLAYBOOKS_DIR = join(process.cwd(), "playbooks");
const CORTEX_DIR = "/home/hermes/cortex";

// ── Provenance stamp ────────────────────────────────────────────────────────
const SEED_PROVENANCE = {
  sessionId: "u7.7-seed-kg",
  turnId: "seed-backfill",
  timestamp: new Date().toISOString(),
  sourceLog: "scripts/seed-kg.ts",
};

// ── Known cardinal rule IDs from NewLeaf ────────────────────────────────────
const KNOWN_CARDINALS: Record<string, { rule: string; source: string }> = {
  "6a153d63": {
    rule: "Slack #jarvis-admin ONLY — NEVER newleaf-admin",
    source: "Hermes V5 cardinal rules (LOCKED)",
  },
  "6a273f70": {
    rule: "NATIVE TOOLS ONLY — never hostingerBridge from VPS, never vercel CLI",
    source: "Hermes V5 cardinal rules (LOCKED)",
  },
  "6a29cf6f": {
    rule: "The 4-section playbook.md is canonical format — never replace structure",
    source: "Hermes V5 cardinal rules (LOCKED)",
  },
  "6a3d8a1b": {
    rule: "Self-healing mandatory — every error must match Section 4 rules",
    source: "Hermes V5 cardinal rules (LOCKED)",
  },
  "6a4b9c2e": {
    rule: "CI must pass after every commit — never skip hooks",
    source: "Hermes V5 cardinal rules (LOCKED)",
  },
  "nmi-gv-1": {
    rule: "source_transaction_id is BANNED — use customer_vault_id + DPAN",
    source: "NMI Golden Vault Architecture",
  },
  "nmi-gv-2": {
    rule: "Day-0 CIT transaction is consent anchor — required before any real charge",
    source: "NMI Golden Vault Architecture",
  },
  "nmi-gv-3": {
    rule: "cofCompliant check required before every NMI vault operation",
    source: "NMI Golden Vault Architecture",
  },
  "deploy-1": {
    rule: "vercel CLI is BANNED — silent empty bug, use REST API only",
    source: "Vercel Discipline Playbook",
  },
  "deploy-2": {
    rule: "NEVER expose VERCEL_TOKEN to client — server-side only",
    source: "Vercel Discipline Playbook",
  },
  "wiki-1": {
    rule: "Wiki is READ-ONLY for agent in v1 — only humans + extraction pipeline write",
    source: "U7.5 /wiki UI cardinal",
  },
  "wiki-2": {
    rule: "Provenance MANDATORY — every KG entity must trace back to source session",
    source: "U7.1 KG design cardinal",
  },
  "kg-1": {
    rule: "Raw logs immutable — never redact original, store redacted copy alongside",
    source: "U7.2 Raw Logs cardinal",
  },
  "kg-2": {
    rule: "Agent NEVER auto-modifies playbooks — only propose via self-heal loop",
    source: "U7.4 Pre-Check cardinal",
  },
};

// ── Known connectors ─────────────────────────────────────────────────────────
const KNOWN_CONNECTORS: Record<string, { description: string; type: string }> = {
  base44: { description: "Base44 CRM — customer profiles, payment logs, tickets, entities", type: "CRM" },
  nmi: { description: "NMI Payment Gateway — vault, charge, refund, subscriptions", type: "Payment" },
  github: { description: "GitHub API — PRs, repos, CI, code search", type: "DevTools" },
  vercel: { description: "Vercel Platform — deployments, env vars, projects, domains", type: "Hosting" },
  slack: { description: "Slack API — messages, channels, threads, reactions", type: "Comms" },
  hostinger: { description: "Hostinger VPS — shell access, file system, process management", type: "Infra" },
  wiki: { description: "Internal Knowledge Graph Wiki — entity browser, search, annotations", type: "Knowledge" },
  openai: { description: "OpenAI API — text-embedding-3-small, GPT models", type: "AI" },
  deepseek: { description: "DeepSeek API — structured JSON extraction, chat models", type: "AI" },
  notebooklm: { description: "Google NotebookLM — research, audio overviews, studio artifacts", type: "Research" },
  upstash: { description: "Upstash Redis — hot log layer, 24h TTL cache", type: "Cache" },
  supabase: { description: "Supabase Postgres — vector storage, ltree, pgvector extensions", type: "Database" },
};

// ── Helper: sanitize for ltree (alphanumeric + underscore only) ────────────
function toLtreePath(...segments: string[]): string {
  return segments
    .map((s) => s.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase())
    .join(".");
}

// ── Helper: parse YAML frontmatter ──────────────────────────────────────────
function parseFrontmatter(content: string): Record<string, unknown> | null {
  if (!content.startsWith("---")) return null;
  const end = content.indexOf("---", 3);
  if (end === -1) return null;
  const yaml = content.slice(3, end);
  const result: Record<string, unknown> = {};
  const lines = yaml.split("\n");

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const colon = line.indexOf(":");
    if (colon === -1) { i++; continue; }

    const key = line.slice(0, colon).trim();
    const rest = line.slice(colon + 1).trim();

    if (rest === "" || rest === "|") {
      // Multi-line list: look ahead for "- item" lines
      const items: string[] = [];
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j];
        const match = nextLine.match(/^\s*-\s+(.+)/);
        if (match) {
          items.push(match[1].trim());
          j++;
        } else if (nextLine.trim() === "") {
          j++; // skip blank lines
        } else {
          break;
        }
      }
      if (items.length > 0) {
        result[key] = items;
        i = j;
        continue;
      }
      result[key] = rest;
    } else if (rest.startsWith("[") && rest.endsWith("]")) {
      // Inline array: [item1, item2]
      result[key] = rest.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean);
    } else {
      result[key] = rest;
    }
    i++;
  }
  return result;
}

// ── Helper: extract bullet list items ───────────────────────────────────────
function extractBullets(content: string, sectionHeader: string): string[] {
  const idx = content.indexOf(sectionHeader);
  if (idx === -1) return [];
  const section = content.slice(idx + sectionHeader.length);
  const nextHeading = section.search(/\n##?\s/);
  const sectionBody = nextHeading === -1 ? section : section.slice(0, nextHeading);
  const bullets: string[] = [];
  for (const line of sectionBody.split("\n")) {
    const match = line.match(/^[-*]\s+(.+)/);
    if (match) bullets.push(match[1].trim());
  }
  return bullets;
}

// ── Main seed function ──────────────────────────────────────────────────────
async function seedKg(dryRun = false) {
  console.log(`🧠 U7.7 KG Seeder ${dryRun ? "(DRY RUN)" : "(LIVE)"}\n`);

  // Health check
  if (!dryRun) {
    const health = await kgHealthCheck();
    console.log(`  Health: ${health.ok ? "✅" : "❌"} extensions=[${health.extensions.join(",")}]`);
    if (!health.ok) {
      console.error(`  ❌ KG not healthy, aborting: ${health.error}`);
      return;
    }
  }

  const stats = !dryRun ? await getKgStats() : { entityCount: 0, relationCount: 0, entityTypes: {} };
  console.log(`  Pre-seed: ${stats.entityCount} entities, ${stats.relationCount} relations\n`);

  // ── PHASE 1: Seed cardinal rules ──────────────────────────────────────────
  console.log("── Phase 1: Cardinal Rules ──");
  let cardinalCount = 0;
  for (const [id, { rule, source }] of Object.entries(KNOWN_CARDINALS)) {
    const entity: EntityInsert = {
      type: "Cardinal",
      name: `CARDINAL-${id}`,
      description: rule,
      properties: { cardinal_id: id, source },
      path: toLtreePath("root", "cardinals", id),
      confidence: 1.0,
      provenance: SEED_PROVENANCE,
    };
    if (!dryRun) {
      await upsertEntity(entity);
    }
    cardinalCount++;
    console.log(`  ${dryRun ? "📝" : "✅"} Cardinal: CARDINAL-${id}`);
  }
  console.log(`  → ${cardinalCount} cardinals\n`);

  // ── PHASE 2: Seed connectors ──────────────────────────────────────────────
  console.log("── Phase 2: Connectors ──");
  let connectorCount = 0;
  for (const [name, { description, type }] of Object.entries(KNOWN_CONNECTORS)) {
    const entity: EntityInsert = {
      type: "Connector",
      name,
      description,
      properties: { connector_type: type },
      path: toLtreePath("root", "connectors", name),
      confidence: 1.0,
      provenance: SEED_PROVENANCE,
    };
    if (!dryRun) {
      await upsertEntity(entity);
    }
    connectorCount++;
    console.log(`  ${dryRun ? "📝" : "✅"} Connector: ${name} (${type})`);
  }
  console.log(`  → ${connectorCount} connectors\n`);

  // ── PHASE 3: Seed domains, skills, routines, patterns from playbooks ──────
  console.log("── Phase 3: Domains, Skills, Routines, Patterns ──");
  const domainDirs = readdirSync(PLAYBOOKS_DIR).filter((d) => {
    const fullPath = join(PLAYBOOKS_DIR, d);
    try {
      return statSync(fullPath).isDirectory();
    } catch {
      return false;
    }
  });

  let domainCount = 0;
  let skillCount = 0;
  let routineCount = 0;
  let patternCount = 0;
  const domainEntities: Record<string, string> = {}; // domain → entity name
  const pendingRelations: RelationInsert[] = [];

  for (const domainDir of domainDirs) {
    const playbookFile = readdirSync(join(PLAYBOOKS_DIR, domainDir)).find(
      (f) => f.startsWith("playbook-") && f.endsWith(".md")
    );
    if (!playbookFile) continue;

    const content = readFileSync(join(PLAYBOOKS_DIR, domainDir, playbookFile), "utf-8");
    const frontmatter = parseFrontmatter(content);

    const domainName = (frontmatter?.domain as string) ?? domainDir;
    const domainHeadline = (frontmatter?.headline as string) ?? `${domainName} domain`;

    // Create Domain entity
    const domainEntity: EntityInsert = {
      type: "Domain",
      name: domainName,
      description: domainHeadline,
      properties: {
        priority: frontmatter?.priority ?? "P2",
        scope: frontmatter?.scope ?? "domain",
        intent_tags: frontmatter?.intent_tags ?? [],
        routines_count: frontmatter?.routines_count ?? 0,
      },
      path: toLtreePath("root", "domains", domainName),
      confidence: 1.0,
      provenance: SEED_PROVENANCE,
    };
    if (!dryRun) {
      await upsertEntity(domainEntity);
    }
    domainEntities[domainName] = domainName;
    domainCount++;
    console.log(`  ${dryRun ? "📝" : "✅"} Domain: ${domainName}`);

    // Link domain to connectors
    const connectors = (frontmatter?.associated_connectors as string[]) ?? [];
    for (const conn of connectors) {
      pendingRelations.push({
        from_entity_id: "", // resolved by name
        to_entity_id: "",
        type: "USES",
        properties: { from_name: domainName, from_type: "Domain", to_name: conn, to_type: "Connector" },
        confidence: 1.0,
        provenance: SEED_PROVENANCE,
      });
    }

    // Link domain to skills
    const skills = (frontmatter?.associated_skills as string[]) ?? [];
    for (const skillPath of skills) {
      const skillName = skillPath.replace(/^capabilities\//, "").replace(/^connectors\//, "");
      // Create Skill entity
      const skillEntity: EntityInsert = {
        type: "Skill",
        name: skillPath,
        description: `Skill: ${skillName}`,
        properties: { skill_path: skillPath, domain: domainName },
        path: `root.skills.${skillPath.replace(/\//g, ".")}`,
        confidence: 1.0,
        provenance: SEED_PROVENANCE,
      };
      if (!dryRun) {
        await upsertEntity(skillEntity);
      }
      skillCount++;

      pendingRelations.push({
        from_entity_id: "",
        to_entity_id: "",
        type: "REQUIRES",
        properties: { from_name: domainName, from_type: "Domain", to_name: skillPath, to_type: "Skill" },
        confidence: 1.0,
        provenance: SEED_PROVENANCE,
      });
    }

    // Link domain to functions
    const functions = (frontmatter?.associated_functions as string[]) ?? [];
    for (const fn of functions) {
      pendingRelations.push({
        from_entity_id: "",
        to_entity_id: "",
        type: "USES",
        properties: { from_name: domainName, from_type: "Domain", to_name: fn, to_type: "Concept" },
        confidence: 1.0,
        provenance: SEED_PROVENANCE,
      });
    }

    // Extract patterns from Operational Knowledge section
    const opBullets = extractBullets(content, "## Operational Knowledge");
    for (const bullet of opBullets) {
      // Extract pattern name (before colon or dash)
      const patternName = bullet.split(/[:\-–]/)[0].trim();
      const patternEntity: EntityInsert = {
        type: "Pattern",
        name: `${domainName}::${patternName}`,
        description: bullet,
        properties: { domain: domainName, source_section: "Operational Knowledge" },
        path: `root.patterns.${domainName}.${patternName.replace(/\s+/g, "-").toLowerCase()}`,
        confidence: 0.9,
        provenance: SEED_PROVENANCE,
      };
      if (!dryRun) {
        await upsertEntity(patternEntity);
      }
      patternCount++;

      pendingRelations.push({
        from_entity_id: "",
        to_entity_id: "",
        type: "REFERENCES",
        properties: {
          from_name: domainName, from_type: "Domain",
          to_name: `${domainName}::${patternName}`, to_type: "Pattern",
        },
        confidence: 0.9,
        provenance: SEED_PROVENANCE,
      });
    }

    // Extract anti-patterns
    const antiBullets = extractBullets(content, "## Anti-Patterns");
    for (const bullet of antiBullets) {
      const patternName = bullet.split(/[:\-–]/)[0].trim();
      const antiEntity: EntityInsert = {
        type: "Pattern",
        name: `${domainName}::ANTI-${patternName}`,
        description: `❌ ${bullet}`,
        properties: { domain: domainName, source_section: "Anti-Patterns", is_anti_pattern: true },
        path: `root.patterns.${domainName}.anti.${patternName.replace(/\s+/g, "-").toLowerCase()}`,
        confidence: 1.0,
        provenance: SEED_PROVENANCE,
      };
      if (!dryRun) {
        await upsertEntity(antiEntity);
      }
      patternCount++;

      pendingRelations.push({
        from_entity_id: "",
        to_entity_id: "",
        type: "CONFLICTS_WITH",
        properties: {
          from_name: `${domainName}::ANTI-${patternName}`, from_type: "Pattern",
          to_name: domainName, to_type: "Domain",
        },
        confidence: 1.0,
        provenance: SEED_PROVENANCE,
      });
    }

    // Seed routines from routines.json
    const routinesPath = join(PLAYBOOKS_DIR, domainDir, "routines.json");
    if (existsSync(routinesPath)) {
      const routinesJson = JSON.parse(readFileSync(routinesPath, "utf-8"));
      const routineList = Array.isArray(routinesJson)
        ? routinesJson
        : routinesJson.routines ?? [];

      for (const routine of routineList) {
        const routineName = routine.name;
        const routineEntity: EntityInsert = {
          type: "Workflow",
          name: `${domainName}::${routineName}`,
          description: `Routine: ${routineName} — ${routine.trigger_keywords?.slice(0, 3).join(", ") ?? "no keywords"}`,
          properties: {
            domain: domainName,
            trigger_keywords: routine.trigger_keywords ?? [],
            step_count: routine.steps?.length ?? 0,
            pre_check_required: routine.pre_check_knowledge?.required ?? false,
          },
          path: `root.workflows.${domainName}.${routineName.replace(/\s+/g, "-").toLowerCase()}`,
          confidence: 1.0,
          provenance: SEED_PROVENANCE,
        };
        if (!dryRun) {
          await upsertEntity(routineEntity);
        }
        routineCount++;

        pendingRelations.push({
          from_entity_id: "",
          to_entity_id: "",
          type: "DEPENDS_ON",
          properties: {
            from_name: `${domainName}::${routineName}`, from_type: "Workflow",
            to_name: domainName, to_type: "Domain",
          },
          confidence: 1.0,
          provenance: SEED_PROVENANCE,
        });

        // Link routine steps to connectors/skills
        for (const step of routine.steps ?? []) {
          const action: string = step.action ?? "";
          if (action.startsWith("base44.")) {
            pendingRelations.push({
              from_entity_id: "", to_entity_id: "",
              type: "USES",
              properties: {
                from_name: `${domainName}::${routineName}`, from_type: "Workflow",
                to_name: "base44", to_type: "Connector",
              },
              confidence: 1.0,
              provenance: SEED_PROVENANCE,
            });
          } else if (action.startsWith("nmi.")) {
            pendingRelations.push({
              from_entity_id: "", to_entity_id: "",
              type: "USES",
              properties: {
                from_name: `${domainName}::${routineName}`, from_type: "Workflow",
                to_name: "nmi", to_type: "Connector",
              },
              confidence: 1.0,
              provenance: SEED_PROVENANCE,
            });
          } else if (action.startsWith("github.")) {
            pendingRelations.push({
              from_entity_id: "", to_entity_id: "",
              type: "USES",
              properties: {
                from_name: `${domainName}::${routineName}`, from_type: "Workflow",
                to_name: "github", to_type: "Connector",
              },
              confidence: 1.0,
              provenance: SEED_PROVENANCE,
            });
          } else if (action.startsWith("vercel.")) {
            pendingRelations.push({
              from_entity_id: "", to_entity_id: "",
              type: "USES",
              properties: {
                from_name: `${domainName}::${routineName}`, from_type: "Workflow",
                to_name: "vercel", to_type: "Connector",
              },
              confidence: 1.0,
              provenance: SEED_PROVENANCE,
            });
          } else if (action.startsWith("slack.")) {
            pendingRelations.push({
              from_entity_id: "", to_entity_id: "",
              type: "USES",
              properties: {
                from_name: `${domainName}::${routineName}`, from_type: "Workflow",
                to_name: "slack", to_type: "Connector",
              },
              confidence: 1.0,
              provenance: SEED_PROVENANCE,
            });
          }
        }
      }
    }
  }
  console.log(`  → ${domainCount} domains, ${skillCount} skills, ${routineCount} routines, ${patternCount} patterns\n`);

  // ── PHASE 4: Architecture / Connectivity facts ─────────────────────────────
  console.log("── Phase 4: Architecture / Connectivity Facts ──");
  const archFacts: EntityInsert[] = [
    {
      type: "Concept",
      name: "U7-KG-Stack",
      description: "Postgres + pgvector 0.8.0 + ltree 1.3 — 3-layer brain (Playbooks/KG/Raw Logs)",
      properties: {
        layers: ["Playbooks (HOW)", "Knowledge Graph (WHAT)", "Raw Logs (WHEN)"],
        vector_dimensions: 768,
        embedding_model: "text-embedding-3-small",
        extraction_model: "DeepSeek (structured JSON mode)",
      },
      path: "root.architecture.kg-stack",
      confidence: 1.0,
      provenance: SEED_PROVENANCE,
    },
    {
      type: "Concept",
      name: "U7-Logging-Tiers",
      description: "2-tier logging: Upstash Redis (hot/24h TTL) + Postgres (cold/permanent)",
      properties: {
        hot_tier: "Upstash Redis — 24h TTL, fast queries",
        cold_tier: "Postgres kg_raw_logs — permanent, searchable",
      },
      path: "root.architecture.logging-tiers",
      confidence: 1.0,
      provenance: SEED_PROVENANCE,
    },
    {
      type: "Concept",
      name: "Pattern-A+2",
      description: "8 tools max constraint: 7 existing tools + query_knowledge as documented 8th exception",
      properties: {
        max_tools: 8,
        eighth_tool: "query_knowledge",
        gatekeeper_routes: ["how do we", "what do we know", "verify", "is this still right", "pre-billing/support/deploy"],
      },
      path: "root.architecture.pattern-a+2",
      confidence: 1.0,
      provenance: SEED_PROVENANCE,
    },
    {
      type: "Concept",
      name: "U7-Extraction-Pipeline",
      description: "Session-end extraction via after() hook + Vercel cron nightly at 03:00 UTC",
      properties: {
        trigger_1: "after() hook — non-blocking, per session end",
        trigger_2: "Vercel cron — 0 3 * * *, 50 log batch",
        extractor: "lib/knowledge/extractor.ts",
        fallback: "Heuristic pattern extraction when DeepSeek unavailable",
      },
      path: "root.architecture.extraction-pipeline",
      confidence: 1.0,
      provenance: SEED_PROVENANCE,
    },
    {
      type: "Concept",
      name: "Base44-Two-Lane",
      description: "MCP Editor (NewLeaf Main) vs CLI Sandbox (NewLeaf Sandbox) deploy architecture",
      properties: {
        default_path: "MCP direct to NewLeaf Main editor app",
        specialized_path: "CLI-driven from E2B Sandbox",
        promote: "Sandbox → Main after validation",
      },
      path: "root.architecture.base44-two-lane",
      confidence: 1.0,
      provenance: SEED_PROVENANCE,
    },
    {
      type: "Concept",
      name: "Hermes-V5-Architecture",
      description: "Domain-Driven Skill Architecture — 4-step agent flow across 10 domains",
      properties: {
        steps: ["Domain Isolation", "Hydrate Playbook", "Execute Target Skill", "Self-Heal Loop"],
        domains: 10,
        refinement_cron: "02:57 UTC daily",
      },
      path: "root.architecture.hermes-v5",
      confidence: 1.0,
      provenance: SEED_PROVENANCE,
    },
    {
      type: "Concept",
      name: "Vercel-Native-Chat",
      description: "Neptune Chat on Vercel (prj_bpG5ZHYNZ1wxAm7WDxr3MrBGoOBl) — Next.js 16.2 + shadcn/ui",
      properties: {
        project_id: "prj_bpG5ZHYNZ1wxAm7WDxr3MrBGoOBl",
        framework: "Next.js 16.2 App Router",
        ui: "shadcn/ui primitives",
        ai_sdk: "AI SDK with DeepSeek + OpenAI providers",
        postgres: "Supabase Postgres (shared pooler)",
      },
      path: "root.architecture.vercel-chat",
      confidence: 1.0,
      provenance: SEED_PROVENANCE,
    },
    {
      type: "Concept",
      name: "NewLeaf-GoldenVault",
      description: "NMI Customer Vault — cards stored via DPAN (network token) with Day-0 CIT consent anchor",
      properties: {
        vault_method: "customer_vault_id + DPAN (network token)",
        consent_anchor: "Day-0 CIT transaction",
        banned: ["source_transaction_id"],
      },
      path: "root.architecture.golden-vault",
      confidence: 1.0,
      provenance: SEED_PROVENANCE,
    },
    {
      type: "Concept",
      name: "Smart-Retry-Engine",
      description: "15-minute scheduled retry job for soft declines — insufficient_funds, temporary config errors, velocity limits",
      properties: {
        interval: "15 minutes",
        soft_decline_types: ["insufficient_funds", "temporary_config", "velocity_limit"],
        hard_decline_policy: "Bypass — send payment_update_link instead",
      },
      path: "root.architecture.smart-retry",
      confidence: 1.0,
      provenance: SEED_PROVENANCE,
    },
  ];

  let archCount = 0;
  for (const fact of archFacts) {
    if (!dryRun) {
      await upsertEntity(fact);
    }
    archCount++;
    console.log(`  ${dryRun ? "📝" : "✅"} Concept: ${fact.name}`);
  }
  console.log(`  → ${archCount} architecture concepts\n`);

  // ── PHASE 5: Resolve and create relations ─────────────────────────────────
  console.log("── Phase 5: Relations ──");
  let relationCreated = 0;
  let relationSkipped = 0;

  // Deduplicate pending relations
  const seen = new Set<string>();
  const uniqueRelations: RelationInsert[] = [];
  for (const rel of pendingRelations) {
    const props = rel.properties as Record<string, unknown>;
    const key = `${props.from_name}|${props.to_name}|${rel.type}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueRelations.push(rel);
    }
  }

  if (!dryRun && uniqueRelations.length > 0) {
    // Batch-lookup all entity name→id mappings in one shot
    const allNames = new Set<string>();
    for (const rel of uniqueRelations) {
      const props = rel.properties as Record<string, unknown>;
      allNames.add(props.from_name as string);
      allNames.add(props.to_name as string);
    }

    const sql = postgres(process.env.POSTGRES_URL!, {
      max: 5, idle_timeout: 30, connect_timeout: 10,
    });

    const nameRows = await sql<{ id: string; type: string; name: string }[]>`
      SELECT id, type, name FROM kg_entities WHERE name = ANY(${Array.from(allNames)})
    `;
    const nameMap = new Map<string, string>(); // "type:name" → id
    for (const row of nameRows) {
      nameMap.set(`${row.type}:${row.name}`, row.id);
    }

    // Batch-insert relations (5 at a time to avoid overwhelming)
    const batchSize = 5;
    for (let i = 0; i < uniqueRelations.length; i += batchSize) {
      const batch = uniqueRelations.slice(i, i + batchSize);
      const resolved: RelationInsert[] = [];

      for (const rel of batch) {
        const props = rel.properties as Record<string, unknown>;
        const fromId = nameMap.get(`${props.from_type}:${props.from_name}`);
        const toId = nameMap.get(`${props.to_type}:${props.to_name}`);

        if (fromId && toId) {
          resolved.push({
            from_entity_id: fromId,
            to_entity_id: toId,
            type: rel.type,
            properties: { resolved: true },
            confidence: rel.confidence,
            provenance: SEED_PROVENANCE,
          });
        } else {
          relationSkipped++;
        }
      }

      // Insert in parallel within batch
      const results = await Promise.allSettled(
        resolved.map((r) => upsertRelation(r))
      );
      relationCreated += results.filter((r) => r.status === "fulfilled").length;
      relationSkipped += results.filter((r) => r.status === "rejected").length;

      if ((i + batchSize) % 100 === 0 || i + batchSize >= uniqueRelations.length) {
        console.log(`  ... ${relationCreated} relations created so far`);
      }
    }

    await sql.end();
  } else if (dryRun) {
    relationCreated = uniqueRelations.length;
  }

  console.log(`  → ${relationCreated} relations created, ${relationSkipped} skipped (missing refs)\n`);

  // ── FINAL: Stats ──────────────────────────────────────────────────────────
  if (!dryRun) {
    const finalStats = await getKgStats();
    console.log("── Final KG Stats ──");
    console.log(`  Entities: ${finalStats.entityCount}`);
    console.log(`  Relations: ${finalStats.relationCount}`);
    console.log("  Types:");
    for (const [type, count] of Object.entries(finalStats.entityTypes)) {
      console.log(`    ${type}: ${count}`);
    }

    const targetEntities = 60;
    const targetRelations = 250;
    const entityVerdict = finalStats.entityCount >= targetEntities ? "✅" : "⚠️";
    const relationVerdict = finalStats.relationCount >= targetRelations ? "✅" : "⚠️";
    console.log(`\n  Target: ${targetEntities}+ entities ${entityVerdict} (${finalStats.entityCount})`);
    console.log(`  Target: ${targetRelations}+ relations ${relationVerdict} (${finalStats.relationCount})`);
  } else {
    const estEntities = cardinalCount + connectorCount + domainCount + skillCount + routineCount + patternCount + archCount;
    const estRelations = uniqueRelations.length;
    console.log(`  Estimated: ${estEntities} entities, ${estRelations} relations`);
    console.log(`  Target: 60+ entities, 250+ relations`);
  }
}

seedKg(process.argv.includes("--dry-run")).catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
