/**
 * create-connector-pack.ts — U2.5.A skill-author script
 *
 * Scaffolds a new connector skill pack under connectors/<name>/
 * Creates: SKILL.md, client.ts (action router template), docs/ folder, GRAPH-TAG.json
 *
 * Safety: only creates in connectors/<name>/ where <name> is explicitly provided.
 * Will NOT overwrite existing connectors unless _test_ prefix.
 *
 * Usage via execute_skill:
 *   execute_skill skills/skill-author scripts/create-connector-pack.ts {
 *     name: "cat-facts",
 *     domain: "engineering",
 *     has_mcp: false,
 *     description: "Cat facts API — random feline trivia"
 *   }
 */

import { z } from "zod";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

// ── Schema ──────────────────────────────────────────────────────────────────

export const CreateConnectorPackSchema = z.object({
  name: z.string().min(2).max(50).describe("Connector folder name (e.g., 'cat-facts')"),
  domain: z.string().min(2).describe("Playbook domain (e.g., 'engineering')"),
  has_mcp: z.boolean().default(false).describe("Whether this connector uses MCP bridge"),
  mcp_config: z
    .string()
    .optional()
    .describe("MCP JSON config string (if has_mcp=true)"),
  description: z.string().optional().describe("Short description for the connector"),
});

export type CreateConnectorPackInput = z.infer<typeof CreateConnectorPackSchema>;

// ── Output ──────────────────────────────────────────────────────────────────

export interface SkillScriptOutput {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

// ── Safety Check ────────────────────────────────────────────────────────────

function isSafeTarget(name: string): boolean {
  // Only allow _test_ prefixed OR explicitly non-customer names
  if (name.startsWith("_test_")) return true;
  // Block real customer connectors from being overwritten
  const forbidden = ["base44", "nmi", "slack", "hyperswitch", "vapi", "github", "vercel", "linear"];
  if (forbidden.includes(name)) {
    throw new Error(`SAFETY: Cannot overwrite production connector '${name}'. Use _test_ prefix for testing.`);
  }
  return true;
}

// ── Main Function ───────────────────────────────────────────────────────────

export async function execute(input: CreateConnectorPackInput): Promise<SkillScriptOutput> {
  try {
    const { name, domain, has_mcp, mcp_config, description } =
      CreateConnectorPackSchema.parse(input);

    // Safety gate
    isSafeTarget(name);

    const CWD = process.cwd();
    const connectorDir = join(CWD, "connectors", name);

    if (existsSync(connectorDir)) {
      return {
        success: false,
        error: `Connector '${name}' already exists at connectors/${name}/. Delete it first or use a different name.`,
      };
    }

    // Create directories
    mkdirSync(connectorDir, { recursive: true });
    mkdirSync(join(connectorDir, "docs"), { recursive: true });

    const desc = description || `Integration pack for ${name}`;

    // ── SKILL.md ──────────────────────────────────────────────────────────

    const skillMd = `---
name: ${name}-connector
description: ${desc}
version: 1.0.0
domain: ${domain}
mcp: ${has_mcp}
custom_client: true
---

# ${name.charAt(0).toUpperCase() + name.slice(1)} Integration Pack

## File Capabilities & Paths
- **Custom API Client:** connectors/${name}/client.ts
- **Manifest:** connectors/${name}/manifest.ts
- **Schema:** connectors/${name}/schema.ts

## Available Actions
| Tool | Description |
|------|-------------|
${has_mcp ? "| mcp_bridge | Route calls through MCP bridge |\n" : ""}| (run \`wrap-api-endpoint\` to add actions) | |
`;

    writeFileSync(join(connectorDir, "SKILL.md"), skillMd);

    // ── client.ts (Action Router Template) ────────────────────────────────

    const clientTs = `/**
 * ${name} Connector Client — U2.5 skill-author generated
 *
 * ${desc}
 *
 * Pattern: ActionRequest -> execute() -> ActionResponse
 * Reference: connectors/slack/client.ts for the canonical pattern.
 *
 * Usage:
 *   import { execute } from "@/connectors/${name}/client";
 *   const result = await execute({ action: "example_action", args: { param: "value" } });
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActionRequest {
  action: string;
  args?: Record<string, unknown>;
}

export interface ActionResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  action?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function ok(data: unknown, action: string): ActionResponse {
  return { success: true, action, data };
}

function fail(action: string, err: unknown): ActionResponse {
  const msg = err instanceof Error ? err.message : String(err);
  return { success: false, error: \`\${action} failed: \${msg}\` };
}

${has_mcp ? `
// ── MCP Bridge (if applicable) ────────────────────────────────────────────────

async function mcpBridge(action: string, args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    // TODO: Wire to MCP hub
    return fail(action, "MCP bridge not yet configured");
  } catch (e) { return fail(action, e); }
}
` : ""}
// ── Action Handlers ───────────────────────────────────────────────────────────

// Each handler is an async function taking optional args → ActionResponse
// Add new handlers below via wrap-api-endpoint.ts

// ── Main Action Router ────────────────────────────────────────────────────────

export async function execute(req: ActionRequest): Promise<ActionResponse> {
  const { action, args } = req;

  switch (action) {
${has_mcp ? `    case "mcp_bridge": return mcpBridge(action, args);\n` : ""}
    default:
      return {
        success: false,
        error: \`Unknown action: '\${action}'. Available: \${availableActions.join(", ")}\`,
      };
  }
}

// ── Available Actions Registry ────────────────────────────────────────────────

export const availableActions: string[] = [
${has_mcp ? `  "mcp_bridge",\n` : ""}];

export default { execute, availableActions };
`;

    writeFileSync(join(connectorDir, "client.ts"), clientTs);

    // ── manifest.ts ───────────────────────────────────────────────────────

    const manifestTs = `/**
 * ${name} Connector Manifest — U2.5 skill-author generated
 */
import { type ConnectorManifest } from "@/lib/connectors/types";

const manifest: ConnectorManifest = {
  id: "${name}",
  name: "${name.charAt(0).toUpperCase() + name.slice(1)}",
  version: "1.0.0",
  domain: "${domain}",
  description: "${desc}",
  hasMcp: ${has_mcp},
  customClient: true,
  rootPath: "connectors/${name}",
};

export default manifest;
`;

    writeFileSync(join(connectorDir, "manifest.ts"), manifestTs);

    // ── schema.ts ─────────────────────────────────────────────────────────

    const schemaTs = `/**
 * ${name} Schema — U2.5 skill-author generated
 */
export interface ${name.charAt(0).toUpperCase() + name.slice(1)}Config {
  apiUrl: string;
  timeout?: number;
}

export const defaultConfig: ${name.charAt(0).toUpperCase() + name.slice(1)}Config = {
  apiUrl: process.env.${name.toUpperCase().replace(/-/g, "_")}_API_URL || "",
  timeout: 10_000,
};
`;

    writeFileSync(join(connectorDir, "schema.ts"), schemaTs);

    // ── index.ts ──────────────────────────────────────────────────────────

    const indexTs = `/**
 * ${name} Connector — U2.5 skill-author generated
 */
export { execute, availableActions } from "./client";
export { defaultConfig } from "./schema";
export type { ActionRequest, ActionResponse } from "./client";
`;

    writeFileSync(join(connectorDir, "index.ts"), indexTs);

    // ── GRAPH-TAG.json ────────────────────────────────────────────────────

    const graphTag = {
      entity_type: "connector",
      entity_id: `connectors/${name}`,
      version: "1.0.0",
      graph_version: "4d-v1",
      directions: {
        associated_playbooks: [
          { ref: `playbooks/${domain}`, relationship: "domain_alignment" },
        ],
        associated_skills: [],
        exposed_functions: [],
        runtime_types: ["node"],
        intent_tags: [name, domain, "connector"],
      },
      metadata: {
        domain,
        mcp: has_mcp,
        custom_client: true,
        function_count: 0,
        description: desc,
        generated_by: "skill-author/create-connector-pack",
        generated_at: new Date().toISOString(),
      },
    };

    writeFileSync(
      join(connectorDir, "GRAPH-TAG.json"),
      JSON.stringify(graphTag, null, 2)
    );

    // ── docs/api-reference.md (placeholder) ───────────────────────────────

    const apiRef = `# ${name.charAt(0).toUpperCase() + name.slice(1)} API Reference

Placeholder — run ingest-api-docs.ts to populate with real API documentation.

Generated by skill-author/create-connector-pack on ${new Date().toISOString()}
`;

    writeFileSync(join(connectorDir, "docs", "api-reference.md"), apiRef);

    // ── Result ─────────────────────────────────────────────────────────────

    return {
      success: true,
      data: {
        connector_name: name,
        domain,
        path: `connectors/${name}/`,
        files_created: [
          `connectors/${name}/SKILL.md`,
          `connectors/${name}/client.ts`,
          `connectors/${name}/manifest.ts`,
          `connectors/${name}/schema.ts`,
          `connectors/${name}/index.ts`,
          `connectors/${name}/GRAPH-TAG.json`,
          `connectors/${name}/docs/api-reference.md`,
        ],
        next_step: "Run wrap-api-endpoint.ts for each API endpoint to wire up actions.",
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `create-connector-pack failed: ${msg}` };
  }
}

export default execute;
