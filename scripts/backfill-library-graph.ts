#!/usr/bin/env tsx
/**
 * Phase 12.A — Library Graph Backfill Script
 *
 * Reads:
 *   1. skills/registry.json (source of truth for connectors, functions, capabilities)
 *   2. connectors/{name}/SKILL.md (per-connector skill docs)
 *   3. skills/functions/{name}/SKILL.md (per-function docs)
 *   4. playbooks/{domain}/playbook-*.md (domain SOPs)
 *   5. skills/playbook-skills.md (master router)
 *
 * Populates 6 library_* tables + computes edges between all nodes.
 *
 * Usage:  tsx scripts/backfill-library-graph.ts [--dry-run]
 *
 * Idempotent — safe to run multiple times. Uses ON CONFLICT upsert.
 */

import { readFileSync, readdirSync, existsSync, statSync } from "fs";
import { join, resolve } from "path";
import postgres from "postgres";
import * as dotenv from "dotenv";

// ── Config ──────────────────────────────────────────────────────────────────

dotenv.config({ path: join(process.cwd(), ".env.local") });

const POSTGRES_URL = process.env.POSTGRES_URL;
if (!POSTGRES_URL) {
  console.error("❌ POSTGRES_URL not set in .env.local");
  process.exit(1);
}

const sql = postgres(POSTGRES_URL, { max: 1 });

const NEPTUNE_ROOT = process.cwd();
const SKILLS_ROOT = join(NEPTUNE_ROOT, "skills");
const CONNECTORS_ROOT = join(NEPTUNE_ROOT, "connectors");
const PLAYBOOKS_ROOT = join(NEPTUNE_ROOT, "playbooks");
const WORKFLOWS_ROOT = join(NEPTUNE_ROOT, "workflows");

const REGISTRY_PATH = join(SKILLS_ROOT, "registry.json");
const PLAYBOOK_SKILLS_PATH = join(SKILLS_ROOT, "playbook-skills.md");

const DRY_RUN = process.argv.includes("--dry-run");

// ── Types ──────────────────────────────────────────────────────────────────

interface RegistryEntry {
  name: string;
  version: string;
  path: string;
  tools?: number;
  primary_domain: string;
  also_in?: string[];
  dependencies?: string[];
}

interface Registry {
  connectors: RegistryEntry[];
  functions: RegistryEntry[];
  capabilities: RegistryEntry[];
}

interface ConnectorSkill {
  name: string;
  description: string;
  version: string;
  domain: string;
  mcp: boolean;
  tools: { name: string; description: string }[];
  filePath: string;
  content: string;
}

interface LibraryPlaybook {
  name: string;
  description: string;
  scopeConnectors: string[];
  triggers: string[];
  workflows: string[];
  filePath: string;
  content: string;
}

interface Edge {
  from_node: string;
  from_type: string;
  to_node: string;
  to_type: string;
  edge_type: string;
  weight: number;
}

// ── Logging ─────────────────────────────────────────────────────────────────

const LOG_LINES: string[] = [];
function log(msg: string) {
  LOG_LINES.push(msg);
  if (!DRY_RUN) console.log(msg);
}

// ── 1. Load Registry ───────────────────────────────────────────────────────

function loadRegistry(): Registry | null {
  if (!existsSync(REGISTRY_PATH)) {
    log("⚠️  registry.json not found. Skipping connector backfill.");
    return null;
  }
  return JSON.parse(readFileSync(REGISTRY_PATH, "utf-8"));
}

// ── 2. Parse Connector SKILL.md Files ──────────────────────────────────────

function parseYamlFrontmatter(content: string): Record<string, string> {
  const fm: Record<string, string> = {};
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return fm;
  const yamlLines = match[1].split("\n");
  for (const line of yamlLines) {
    const kv = line.match(/^(\w[\w_-]*):\s*(.+)$/);
    if (kv) {
      const val = kv[2].trim().replace(/^['"]|['"]$/g, "");
      fm[kv[1]] = val;
    }
  }
  return fm;
}

function parseConnectorSkillMarkdown(filePath: string): ConnectorSkill | null {
  try {
    const content = readFileSync(filePath, "utf-8");
    const fm = parseYamlFrontmatter(content);

    // Parse "Available Actions" table
    const tools: { name: string; description: string }[] = [];
    const toolTableRegex = /\|\s+(\w[\w]+)\s+\|\s+(.+?)\s+\|/g;
    const toolSection = content.match(/## Available Actions\n([\s\S]*?)(?=\n## |$)/);
    if (toolSection) {
      let m: RegExpExecArray | null;
      while ((m = toolTableRegex.exec(toolSection[1])) !== null) {
        const toolName = m[1].trim();
        if (toolName === "Tool" || toolName === "---") continue;
        tools.push({ name: toolName, description: m[2].trim() });
      }
    }

    return {
      name: fm.name || pathToName(filePath),
      description: fm.description || "",
      version: fm.version || "1.0.0",
      domain: fm.domain || "",
      mcp: fm.mcp === "true",
      tools,
      filePath,
      content,
    };
  } catch {
    return null;
  }
}

function pathToName(filePath: string): string {
  const parts = filePath.split("/");
  const connectorIdx = parts.indexOf("connectors");
  if (connectorIdx >= 0 && parts[connectorIdx + 1]) {
    return parts[connectorIdx + 1] + "-connector";
  }
  return filePath.replace(/.*\//, "").replace(/\.md$/, "");
}

// ── 3. Walk connectors/ Directory ──────────────────────────────────────────

function walkConnectors(): ConnectorSkill[] {
  const skills: ConnectorSkill[] = [];
  if (!existsSync(CONNECTORS_ROOT)) return skills;

  const dirs = readdirSync(CONNECTORS_ROOT).filter((d) => {
    const p = join(CONNECTORS_ROOT, d);
    return statSync(p).isDirectory() && d !== "_template";
  });

  for (const dir of dirs) {
    const skillPath = join(CONNECTORS_ROOT, dir, "SKILL.md");
    if (existsSync(skillPath)) {
      const skill = parseConnectorSkillMarkdown(skillPath);
      if (skill) skills.push(skill);
    }
  }

  return skills;
}

// ── 4. Walk playbooks/ Directory ───────────────────────────────────────────

function walkPlaybooks(): LibraryPlaybook[] {
  const playbooks: LibraryPlaybook[] = [];
  if (!existsSync(PLAYBOOKS_ROOT)) return playbooks;

  const entries = readdirSync(PLAYBOOKS_ROOT);

  for (const entry of entries) {
    const entryPath = join(PLAYBOOKS_ROOT, entry);
    if (!statSync(entryPath).isDirectory()) continue;

    // Look for playbook-*.md
    const files = readdirSync(entryPath);
    const playbookFile = files.find((f) => f.startsWith("playbook-") && f.endsWith(".md"));
    if (!playbookFile) continue;

    const filePath = join(entryPath, playbookFile);
    try {
      const content = readFileSync(filePath, "utf-8");

      // Extract trigger words from routines section
      const triggers: string[] = [];
      const triggerRegex = /Trigger words?: '([^']+)'/gi;
      let tm: RegExpExecArray | null;
      while ((tm = triggerRegex.exec(content)) !== null) {
        triggers.push(...tm[1].split(",").map((s) => s.trim()));
      }

      // Extract scope connectors (connector mentions in text)
      const scopeConnectors: string[] = [];
      const connectorMentionRegex = /\b(nmi|slack|github|linear|base44|ghl|hyperswitch|forth|vapi|vercel|affy|wiki|mcp-hub|ai-sdk-6|workflow-devkit)-connector\b/gi;
      const mentioned = new Set<string>();
      let cm: RegExpExecArray | null;
      while ((cm = connectorMentionRegex.exec(content)) !== null) {
        mentioned.add(cm[0].toLowerCase());
      }
      scopeConnectors.push(...mentioned);

      // Extract workflow references
      const workflows: string[] = [];
      const workflowRegex = /workflows\/([\w-]+)(?:\.workflow\.ts|\.md)/gi;
      let wm: RegExpExecArray | null;
      while ((wm = workflowRegex.exec(content)) !== null) {
        workflows.push(wm[1]);
      }

      playbooks.push({
        name: entry,
        description: content.split("\n")[0]?.replace(/^#\s*/, "") || entry,
        scopeConnectors,
        triggers,
        workflows,
        filePath,
        content,
      });
    } catch {
      // skip
    }
  }

  return playbooks;
}

// ── 5. Walk skills/functions/ Directory ────────────────────────────────────

interface FunctionEntry {
  name: string;
  signature: string;
  description: string;
  domain: string;
  also_in: string[];
  dependencies: string[];
  version: string;
  filePath: string;
  content: string;
}

function walkFunctions(skillsRoot: string, registry: Registry): FunctionEntry[] {
  const functions: FunctionEntry[] = [];
  const funcsDir = join(skillsRoot, "functions");

  for (const f of registry.functions) {
    const funcDir = join(funcsDir, f.name);
    const funcFile = join(funcDir, "SKILL.md");

    if (!existsSync(funcFile)) {
      // Fallback — create minimal entry from registry
      functions.push({
        name: f.name,
        signature: "",
        description: f.name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        domain: f.primary_domain,
        also_in: f.also_in || [],
        dependencies: f.dependencies || [],
        version: f.version,
        filePath: funcFile,
        content: "",
      });
      continue;
    }

    try {
      const content = readFileSync(funcFile, "utf-8");
      const lines = content.split("\n");
      const description = lines.find((l) => l.trim().length > 0 && !l.startsWith("#"))?.trim() || "";

      // Extract signature if present
      const sigLine = content.match(/```(?:ts|typescript)?\s*\n(export\s+)?(async\s+)?function\s+\w+\([^)]*\).*?\n```/);
      const signature = sigLine ? sigLine[0].split("\n")[1]?.trim().replace(/^export\s+/, "").replace(/^async\s+/, "") : "";

      functions.push({
        name: f.name,
        signature,
        description: description || f.name.replace(/-/g, " "),
        domain: f.primary_domain,
        also_in: f.also_in || [],
        dependencies: f.dependencies || [],
        version: f.version,
        filePath: funcFile,
        content,
      });
    } catch {
      functions.push({
        name: f.name,
        signature: "",
        description: "",
        domain: f.primary_domain,
        also_in: f.also_in || [],
        dependencies: f.dependencies || [],
        version: f.version,
        filePath: funcFile,
        content: "",
      });
    }
  }

  return functions;
}

// ── 6. Walk workflows/ Directory ───────────────────────────────────────────

function walkWorkflows(): { name: string; description: string; durable: boolean; filePath: string }[] {
  const workflows: { name: string; description: string; durable: boolean; filePath: string }[] = [];
  if (!existsSync(WORKFLOWS_ROOT)) return workflows;

  const files = readdirSync(WORKFLOWS_ROOT);
  for (const file of files) {
    if (file.endsWith(".workflow.ts") || file.endsWith(".ts")) {
      const filePath = join(WORKFLOWS_ROOT, file);
      try {
        const content = readFileSync(filePath, "utf-8");
        const durable = content.includes("createWorkflow") || content.includes("hooks.waitFor");
        const descLine = content.split("\n").find((l) => l.includes("description:"))?.trim() || "";
        const description = descLine.replace(/.*description:\s*['"]?/, "").replace(/['"],?$/, "");

        workflows.push({
          name: file.replace(/\.(workflow\.)?ts$/, ""),
          description: description || file,
          durable,
          filePath,
        });
      } catch {
        // skip
      }
    }
  }

  return workflows;
}

// ── 7. Compute Edges ───────────────────────────────────────────────────────

function computeEdges(
  registry: Registry,
  connectorSkills: ConnectorSkill[],
  playbooks: LibraryPlaybook[],
  functions: FunctionEntry[],
  workflows: { name: string; description: string; durable: boolean; filePath: string }[]
): Edge[] {
  const edges: Edge[] = [];
  const edgeSet = new Set<string>();

  function addEdge(from: string, fromType: string, to: string, toType: string, edgeType: string, weight = 1) {
    const key = `${from}|${fromType}|${to}|${toType}|${edgeType}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push({ from_node: from, from_type: fromType, to_node: to, to_type: toType, edge_type: edgeType, weight });
  }

  // A. Connector → dependencies (USES edge)
  for (const c of registry.connectors) {
    for (const dep of c.dependencies || []) {
      const depConnector = registry.connectors.find((rc) => rc.name === dep);
      if (depConnector) {
        addEdge(c.name, "connector", dep, "connector", "uses", 5);
      }
    }
  }

  // B. Connector → tools (EXPOSES edge) — from parsed SKILL.md
  for (const cs of connectorSkills) {
    for (const tool of cs.tools) {
      addEdge(cs.name, "connector", tool.name, "function", "exposes", 2);
    }
  }

  // C. Connector → domains (ALSO_IN edges)
  for (const c of registry.connectors) {
    for (const domain of c.also_in || []) {
      addEdge(c.name, "connector", domain, "domain", "also_in", 1);
    }
    // Primary domain
    if (c.primary_domain) {
      addEdge(c.name, "connector", c.primary_domain, "domain", "also_in", 3);
    }
  }

  // D. Function → connector/function dependencies (DEPENDS_ON edge)
  for (const f of registry.functions) {
    for (const dep of f.dependencies || []) {
      // Check if dependency is a connector
      const depConnector = registry.connectors.find((rc) => rc.name === dep);
      if (depConnector) {
        addEdge(f.name, "function", dep, "connector", "depends_on", 4);
      }
      // Check if dependency is another function
      const depFunc = registry.functions.find((rf) => rf.name === dep);
      if (depFunc) {
        addEdge(f.name, "function", dep, "function", "depends_on", 3);
      }
    }
  }

  // E. Playbook → connectors (ROUTES_TO edges)
  for (const p of playbooks) {
    for (const connName of p.scopeConnectors) {
      // Normalize name to match registry
      const match = registry.connectors.find((c) => c.name === connName);
      if (match) {
        addEdge(p.name, "playbook", match.name, "connector", "routes_to", 3);
      }
    }
  }

  // F. Workflow → playbook (IMPLEMENTS edges)
  for (const w of workflows) {
    for (const p of playbooks) {
      if (p.workflows.includes(w.name)) {
        addEdge(w.name, "workflow", p.name, "playbook", "implements", 4);
      }
    }
  }

  // G. Workflow → functions (CALLED_BY edges — computed from playbook content)
  for (const p of playbooks) {
    for (const f of registry.functions) {
      const funcNameShort = f.name.replace(/-/g, " ").toLowerCase();
      if (p.content.toLowerCase().includes(funcNameShort) || p.content.includes(f.name)) {
        addEdge(p.name, "playbook", f.name, "function", "routes_to", 2);
      }
    }
  }

  // H. Connector → capability/function (exposes edges for skills not in tools table)
  for (const cs of connectorSkills) {
    for (const f of functions) {
      if (f.dependencies.includes(cs.name)) {
        addEdge(cs.name, "connector", f.name, "function", "exposes", 2);
      }
    }
  }

  // I. Function → domains
  for (const f of registry.functions) {
    addEdge(f.name, "function", f.primary_domain, "domain", "also_in", 2);
    for (const domain of f.also_in || []) {
      addEdge(f.name, "function", domain, "domain", "also_in", 1);
    }
  }

  return edges;
}

// ── 8. Backfill Database ───────────────────────────────────────────────────

async function backfill() {
  log("Phase 12.A — Library Graph Backfill");
  log("==================================");
  log(`Root: ${NEPTUNE_ROOT}`);

  // 8a. Load registry
  const registry = loadRegistry();
  if (!registry) {
    log("❌ No registry found. Run neptune:bootstrap first.");
    return;
  }
  log(`📋 Registry: ${registry.connectors.length} connectors, ${registry.functions.length} functions, ${registry.capabilities.length} capabilities`);

  // 8b. Walk filesystem
  const connectorSkills = walkConnectors();
  log(`📁 Connectors: ${connectorSkills.length} SKILL.md files found`);

  const playbooks = walkPlaybooks();
  log(`📚 Playbooks: ${playbooks.length} domain playbooks found`);

  const functions = walkFunctions(SKILLS_ROOT, registry);
  log(`🔧 Functions: ${functions.length} domain functions`);

  const workflows = walkWorkflows();
  log(`⚙️  Workflows: ${workflows.length} workflow files`);

  // 8c. Compute edges
  const edges = computeEdges(registry, connectorSkills, playbooks, functions, workflows);
  log(`🔗 Edges: ${edges.length} computed`);

  if (DRY_RUN) {
    log("\n── DRY RUN — No DB writes ──");
    log("\nConnectors to insert:");
    for (const c of connectorSkills) {
      log(`  - ${c.name} (${c.tools.length} tools) → ${c.domain}`);
    }
    log("\nPlaybooks to insert:");
    for (const p of playbooks) {
      log(`  - ${p.name} (${p.triggers.length} triggers, ${p.scopeConnectors.length} connectors)`);
    }
    log("\nEdges sample (first 20):");
    for (const e of edges.slice(0, 20)) {
      log(`  ${e.from_node} [${e.from_type}] --${e.edge_type}--> ${e.to_node} [${e.to_type}] (w:${e.weight})`);
    }
    return;
  }

  // 8d. Upsert connectors
  log("\n💾 Inserting connectors...");
  for (const cs of connectorSkills) {
    const regEntry = registry.connectors.find((c) => c.name === cs.name);
    await sql`
      INSERT INTO "library_connectors" (
        "name", "domain", "mcp_enabled", "description", "primary_domain",
        "also_in", "dependencies", "tools", "tool_names", "version", "file_path"
      ) VALUES (
        ${cs.name},
        ${cs.domain},
        ${cs.mcp},
        ${cs.description},
        ${cs.domain},
        ${JSON.stringify(regEntry?.also_in || [])}::jsonb,
        ${JSON.stringify(regEntry?.dependencies || [])}::jsonb,
        ${cs.tools.length},
        ${JSON.stringify(cs.tools.map((t) => t.name))}::jsonb,
        ${cs.version},
        ${cs.filePath}
      )
      ON CONFLICT ("name") DO UPDATE SET
        "description" = EXCLUDED."description",
        "tools" = EXCLUDED."tools",
        "tool_names" = EXCLUDED."tool_names",
        "also_in" = EXCLUDED."also_in",
        "dependencies" = EXCLUDED."dependencies",
        "updated_at" = now()
    `;
  }

  // 8e. Upsert skills (connector docs)
  log("💾 Inserting connector skills...");
  for (const cs of connectorSkills) {
    await sql`
      INSERT INTO "library_skills" (
        "name", "type", "connector_name", "description", "file_path", "content", "version"
      ) VALUES (
        ${cs.name}, 'connector', ${cs.name}, ${cs.description}, ${cs.filePath}, ${cs.content}, ${cs.version}
      )
      ON CONFLICT ("name", "type") DO UPDATE SET
        "content" = EXCLUDED."content",
        "description" = EXCLUDED."description",
        "updated_at" = now()
    `;
  }

  // Also insert capability skills
  for (const cap of registry.capabilities) {
    await sql`
      INSERT INTO "library_skills" (
        "name", "type", "connector_name", "description", "file_path", "version"
      ) VALUES (
        ${cap.name}, 'capability', NULL, ${cap.name.replace(/-/g, " ")}, ${cap.path}, '1.0.0'
      )
      ON CONFLICT ("name", "type") DO UPDATE SET
        "description" = EXCLUDED."description",
        "updated_at" = now()
    `;
  }

  // 8f. Upsert functions
  log("💾 Inserting functions...");
  for (const f of functions) {
    await sql`
      INSERT INTO "library_functions" (
        "name", "signature", "skill_name", "description", "domain",
        "also_in", "dependencies", "file_path", "version"
      ) VALUES (
        ${f.name},
        ${f.signature || null},
        ${f.name},
        ${f.description},
        ${f.domain},
        ${JSON.stringify(f.also_in)}::jsonb,
        ${JSON.stringify(f.dependencies)}::jsonb,
        ${f.filePath},
        ${f.version}
      )
      ON CONFLICT ("name") DO UPDATE SET
        "description" = EXCLUDED."description",
        "dependencies" = EXCLUDED."dependencies",
        "updated_at" = now()
    `;
  }

  // 8g. Upsert playbooks
  log("💾 Inserting playbooks...");
  for (const p of playbooks) {
    await sql`
      INSERT INTO "library_playbooks" (
        "name", "type", "scope_connectors", "triggers", "workflows",
        "description", "file_path", "content"
      ) VALUES (
        ${p.name},
        'domain',
        ${JSON.stringify(p.scopeConnectors)}::jsonb,
        ${JSON.stringify(p.triggers)}::jsonb,
        ${JSON.stringify(p.workflows)}::jsonb,
        ${p.description},
        ${p.filePath},
        ${p.content}
      )
      ON CONFLICT ("name") DO UPDATE SET
        "scope_connectors" = EXCLUDED."scope_connectors",
        "triggers" = EXCLUDED."triggers",
        "workflows" = EXCLUDED."workflows",
        "content" = EXCLUDED."content",
        "updated_at" = now()
    `;
  }

  // 8h. Upsert workflows
  log("💾 Inserting workflows...");
  for (const w of workflows) {
    await sql`
      INSERT INTO "library_workflows" (
        "name", "playbook_name", "durable", "description", "file_path"
      ) VALUES (
        ${w.name}, NULL, ${w.durable}, ${w.description}, ${w.filePath}
      )
      ON CONFLICT ("name") DO UPDATE SET
        "durable" = EXCLUDED."durable",
        "description" = EXCLUDED."description",
        "updated_at" = now()
    `;
  }

  // 8i. Clear and re-insert edges (edges are fully computed, not incremental)
  log("💾 Inserting edges...");
  // Delete existing edges before re-inserting (edges are fully recomputed)
  await sql`DELETE FROM "library_edges"`;
  for (const e of edges) {
    await sql`
      INSERT INTO "library_edges" (
        "from_node", "from_type", "to_node", "to_type", "edge_type", "weight"
      ) VALUES (
        ${e.from_node}, ${e.from_type}, ${e.to_node}, ${e.to_type}, ${e.edge_type}, ${e.weight}
      )
      ON CONFLICT ("from_node", "from_type", "to_node", "to_type", "edge_type") DO UPDATE SET
        "weight" = EXCLUDED."weight"
    `;
  }

  // 8j. Summary
  const counts = await sql`
    SELECT
      (SELECT count(*) FROM "library_connectors") as connectors,
      (SELECT count(*) FROM "library_skills") as skills,
      (SELECT count(*) FROM "library_functions") as functions,
      (SELECT count(*) FROM "library_playbooks") as playbooks,
      (SELECT count(*) FROM "library_workflows") as workflows,
      (SELECT count(*) FROM "library_edges") as edges
  `;

  log("\n✅ Backfill complete!");
  log(`   Connectors: ${counts[0].connectors}`);
  log(`   Skills:     ${counts[0].skills}`);
  log(`   Functions:  ${counts[0].functions}`);
  log(`   Playbooks:  ${counts[0].playbooks}`);
  log(`   Workflows:  ${counts[0].workflows}`);
  log(`   Edges:      ${counts[0].edges}`);
}

backfill()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Backfill failed:", err);
    process.exit(1);
  });
