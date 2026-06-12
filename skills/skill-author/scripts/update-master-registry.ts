/**
 * update-master-registry.ts — U2.5.A skill-author script
 *
 * Scans ALL connector client.ts files for availableActions + SKILL.md files
 * for capabilities/functions and regenerates functions/master-registry.json.
 *
 * This is the canonical registry for execute_skill — it maps every function
 * to its connector/skill parent + associated playbooks + intent tags.
 *
 * Safety: read-only on all connector/skill files. Only writes to functions/master-registry.json.
 * Preserves ALL existing entries (additive — never removes).
 *
 * Usage via execute_skill:
 *   execute_skill skills/skill-author scripts/update-master-registry.ts
 *   (no params needed — scans everything)
 */

import { z } from "zod";
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

// ── Schema ──────────────────────────────────────────────────────────────────

export const UpdateMasterRegistrySchema = z.object({
  // No required params — scans all connectors
});

export type UpdateMasterRegistryInput = z.infer<typeof UpdateMasterRegistrySchema>;

// ── Output ──────────────────────────────────────────────────────────────────

export interface SkillScriptOutput {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

// ── Types ───────────────────────────────────────────────────────────────────

interface RegistryFunction {
  function_name: string;
  execution_signature: string;
  runtime_type: "node" | "vercel-serverless";
  parent_connector: string;
  parent_skill: string;
  associated_playbooks: string[];
  intent_tags: string[];
  category: string;
}

interface MasterRegistry {
  version: string;
  generated: string;
  total_functions: number;
  connectors: string[];
  functions: RegistryFunction[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function extractAvailableActions(clientContent: string): string[] {
  const match = clientContent.match(
    /export const availableActions:\s*string\[\]\s*=\s*\[([\s\S]*?)\];/
  );
  if (!match) return [];
  return match[1]
    .split("\n")
    .map((l) => l.trim().replace(/^["']|["'],?$/g, ""))
    .filter((l) => l.length > 1 && !l.startsWith("//") && !l.startsWith("/*"));
}

function extractYamlField(content: string, field: string): string {
  const regex = new RegExp(`${field}:\\s*(.+)`, "i");
  const m = content.match(regex);
  return m ? m[1].trim().replace(/['"]/g, "") : "";
}

function parseYamlList(raw: string): string[] {
  if (!raw || raw === "[]") return [];
  const bracketMatch = raw.match(/^\[(.*)\]$/);
  if (bracketMatch) {
    return bracketMatch[1].split(",").map((s) => s.trim().replace(/['"]/g, "")).filter(Boolean);
  }
  if (raw.includes(",")) {
    return raw.split(",").map((s) => s.trim().replace(/['"]/g, "")).filter(Boolean);
  }
  return [raw.replace(/['"]/g, "")];
}

// ── Main Function ───────────────────────────────────────────────────────────

export async function execute(_input?: UpdateMasterRegistryInput): Promise<SkillScriptOutput> {
  try {
    const CWD = process.cwd();
    const now = new Date().toISOString();

    // Load existing registry to preserve entries
    const registryPath = join(CWD, "functions", "master-registry.json");
    let existing: MasterRegistry = { version: "1.0.0", generated: now, total_functions: 0, connectors: [], functions: [] };
    if (existsSync(registryPath)) {
      try {
        existing = JSON.parse(readFileSync(registryPath, "utf-8"));
      } catch {
        // Start fresh if corrupt
      }
    }

    // Set of existing function names for dedup
    const existingNames = new Set(existing.functions.map((f) => f.function_name));
    const newFunctions: RegistryFunction[] = [...existing.functions];
    const connectors: string[] = [];

    // ── 1. Scan connectors/ for client.ts files ────────────────────────

    const connectorsRoot = join(CWD, "connectors");
    if (existsSync(connectorsRoot)) {
      for (const dir of readdirSync(connectorsRoot)) {
        const dirPath = join(connectorsRoot, dir);
        if (!statSync(dirPath).isDirectory() || dir.startsWith(".") || dir.startsWith("_")) continue;

        const clientPath = join(dirPath, "client.ts");
        if (!existsSync(clientPath)) continue;

        connectors.push(dir);
        const clientContent = readFileSync(clientPath, "utf-8");
        const actions = extractAvailableActions(clientContent);

        if (actions.length === 0) continue;

        // Read SKILL.md for metadata
        let domain = "general";
        let description = `${dir} connector`;
        const skillPath = join(dirPath, "SKILL.md");
        if (existsSync(skillPath)) {
          const skillContent = readFileSync(skillPath, "utf-8");
          domain = extractYamlField(skillContent, "domain") || domain;
          description = extractYamlField(skillContent, "description") || description;
        }

        // Read GRAPH-TAG.json for associated playbooks
        let associatedPlaybooks: string[] = [];
        const graphPath = join(dirPath, "GRAPH-TAG.json");
        if (existsSync(graphPath)) {
          try {
            const graph = JSON.parse(readFileSync(graphPath, "utf-8"));
            associatedPlaybooks = (graph.directions?.associated_playbooks || []).map(
              (p: { ref: string }) => p.ref
            );
          } catch { /* ignore invalid JSON */ }
        }

        for (const action of actions) {
          if (existingNames.has(action)) continue; // Preserve existing
          existingNames.add(action);

          newFunctions.push({
            function_name: action,
            execution_signature: `execute_skill("connectors/${dir}", "${action}", args)`,
            runtime_type: "node",
            parent_connector: `connectors/${dir}`,
            parent_skill: `connectors/${dir}`,
            associated_playbooks: associatedPlaybooks,
            intent_tags: [action, dir, domain, "connector"],
            category: dir,
          });
        }
      }
    }

    // ── 2. Scan skills/capabilities for SKILL.md ───────────────────────

    const capsRoot = join(CWD, "skills", "capabilities");
    if (existsSync(capsRoot)) {
      for (const dir of readdirSync(capsRoot)) {
        const dirPath = join(capsRoot, dir);
        if (!statSync(dirPath).isDirectory() || dir.startsWith(".")) continue;

        const skillPath = join(dirPath, "SKILL.md");
        if (!existsSync(skillPath)) continue;

        const skillContent = readFileSync(skillPath, "utf-8");
        const name = extractYamlField(skillContent, "name") || dir;
        const domain = extractYamlField(skillContent, "domain") || "general";

        if (existingNames.has(name)) continue;
        existingNames.add(name);

        newFunctions.push({
          function_name: name,
          execution_signature: `execute_skill("capabilities/${dir}")`,
          runtime_type: "node",
          parent_connector: "skills",
          parent_skill: `capabilities/${dir}`,
          associated_playbooks: [],
          intent_tags: [dir, domain, "capability"],
          category: "capabilities",
        });
      }
    }

    // ── 3. Scan skills/functions for SKILL.md ─────────────────────────

    const funcsRoot = join(CWD, "skills", "functions");
    if (existsSync(funcsRoot)) {
      for (const dir of readdirSync(funcsRoot)) {
        const dirPath = join(funcsRoot, dir);
        if (!statSync(dirPath).isDirectory() || dir.startsWith(".")) continue;

        const skillPath = join(dirPath, "SKILL.md");
        if (!existsSync(skillPath)) continue;

        const skillContent = readFileSync(skillPath, "utf-8");
        const name = extractYamlField(skillContent, "name") || dir;
        const domain = extractYamlField(skillContent, "domain") || "general";

        if (existingNames.has(name)) continue;
        existingNames.add(name);

        newFunctions.push({
          function_name: name,
          execution_signature: `execute_skill("skills/functions/${dir}")`,
          runtime_type: "node",
          parent_connector: "skills",
          parent_skill: `functions/${dir}`,
          associated_playbooks: [],
          intent_tags: [dir, domain, "function"],
          category: "functions",
        });
      }
    }

    // ── 4. Include skill-author itself ─────────────────────────────────

    if (!existingNames.has("skill-author")) {
      newFunctions.push({
        function_name: "skill-author",
        execution_signature: `execute_skill("skills/skill-author")`,
        runtime_type: "node",
        parent_connector: "skills",
        parent_skill: "skills/skill-author",
        associated_playbooks: ["playbooks/engineering"],
        intent_tags: ["skill creation", "connector", "scaffolding", "meta"],
        category: "meta",
      });
    }

    // ── 5. Write registry ─────────────────────────────────────────────

    const allConnectorNames = [
      ...new Set([...existing.connectors, ...connectors].filter((c) => c !== "skills")),
    ];

    const registry: MasterRegistry = {
      version: "1.0.0",
      generated: now,
      total_functions: newFunctions.length,
      connectors: allConnectorNames,
      functions: newFunctions,
    };

    writeFileSync(registryPath, JSON.stringify(registry, null, 2));

    const addedCount = newFunctions.length - (existing.functions.length || 0);

    return {
      success: true,
      data: {
        regenerated: true,
        output_path: "functions/master-registry.json",
        total_functions: registry.total_functions,
        connectors_count: allConnectorNames.length,
        new_entries_added: Math.max(0, addedCount),
        preserved_entries: Math.min(existing.functions.length || 0, newFunctions.length),
        next_step:
          "Master registry updated. Run regenerate-skill-index.ts to update playbook-skills.md.",
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `update-master-registry failed: ${msg}` };
  }
}

export default execute;
