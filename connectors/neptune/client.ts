/**
 * Neptune Connector — Action Router
 *
 * Resolves skill and function calls for all neptune-authored capabilities.
 * Skills live under skills/<connector>/SKILL.md
 * Functions live under functions/<name>.ts
 *
 * Phase 8: 200+ actions across 8 connectors (github, ghl, linear, vercel, forth, wiki, mcp-hub, affy)
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

const SKILLS_ROOT = join(process.cwd(), "connectors", "neptune", "skills");
const FUNCTIONS_ROOT = join(process.cwd(), "connectors", "neptune", "functions");

// ── Types ──────────────────────────────────────────────────────────────────

export interface SkillAction {
  name: string;
  description: string;
  parameters: Record<string, { type: string; required: boolean; description: string }>;
  returns: string;
}

export interface SkillManifest {
  name: string;
  version: string;
  connector: string;
  actions: SkillAction[];
  totalActions: number;
}

// ── Skill Registry ──────────────────────────────────────────────────────────

const SKILL_REGISTRY: Record<string, { path: string; actions: number }> = {
  github:  { path: "github/SKILL.md",  actions: 35 },
  ghl:     { path: "ghl/SKILL.md",     actions: 35 },
  linear:  { path: "linear/SKILL.md",  actions: 25 },
  vercel:  { path: "vercel/SKILL.md",  actions: 25 },
  forth:   { path: "forth/SKILL.md",   actions: 30 },
  wiki:    { path: "wiki/SKILL.md",    actions: 20 },
  "mcp-hub": { path: "mcp-hub/SKILL.md", actions: 15 },
  affy:    { path: "affy/SKILL.md",    actions: 15 },
};

// ── Function Registry ──────────────────────────────────────────────────────

const FUNCTION_REGISTRY: Record<string, string> = {
  "parse-decline-reason": "parse-decline-reason.ts",
  "compute-mrr": "compute-mrr.ts",
  "annotation-collector": "annotation-collector.ts",
  "usage-telemetry": "usage-telemetry.ts",
};

// ── Router ──────────────────────────────────────────────────────────────────

export async function routeNeptuneAction(
  action: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  // Check if it's a skill action
  const [connector, ...actionParts] = action.split(".");
  const actionName = actionParts.join(".");

  if (SKILL_REGISTRY[connector]) {
    return resolveSkillAction(connector, actionName, payload);
  }

  // Check if it's a function call
  if (FUNCTION_REGISTRY[action]) {
    return resolveFunctionCall(action, payload);
  }

  return { success: false, error: `Unknown action: ${action}. Available connectors: ${Object.keys(SKILL_REGISTRY).join(", ")}` };
}

async function resolveSkillAction(
  connector: string,
  actionName: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const skillPath = join(SKILLS_ROOT, SKILL_REGISTRY[connector].path);

  if (!existsSync(skillPath)) {
    return { success: false, error: `Skill file not found: ${skillPath}` };
  }

  // In production, this would parse the SKILL.md and execute the requested action.
  // For Phase 8, we return the skill metadata confirming the action exists.
  return {
    success: true,
    data: {
      connector,
      action: actionName,
      skillPath,
      totalActions: SKILL_REGISTRY[connector].actions,
      message: `Skill '${connector}.${actionName}' resolved. See ${skillPath} for full documentation.`,
    },
  };
}

async function resolveFunctionCall(
  functionName: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const funcPath = join(FUNCTIONS_ROOT, FUNCTION_REGISTRY[functionName]);

  if (!existsSync(funcPath)) {
    return { success: false, error: `Function file not found: ${funcPath}` };
  }

  return {
    success: true,
    data: {
      function: functionName,
      funcPath,
      message: `Function '${functionName}' resolved.`,
    },
  };
}

export function listNeptuneSkills(): { connector: string; actions: number }[] {
  return Object.entries(SKILL_REGISTRY).map(([connector, info]) => ({
    connector,
    actions: info.actions,
  }));
}

export function listNeptuneFunctions(): string[] {
  return Object.keys(FUNCTION_REGISTRY);
}

export function getTotalActions(): number {
  return Object.values(SKILL_REGISTRY).reduce((sum, s) => sum + s.actions, 0);
}
