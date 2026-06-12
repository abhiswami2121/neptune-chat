/**
 * wrap-api-endpoint.ts — U2.5.A skill-author script
 *
 * Adds a new action handler to an existing connector's client.ts action router.
 * Appends a new switch case + adds to availableActions export.
 *
 * Uses simple regex-based insertion (not AST) for reliability.
 *
 * Safety: only edits connectors/_test_* OR connector explicitly named in args.
 *
 * Usage via execute_skill:
 *   execute_skill skills/skill-author scripts/wrap-api-endpoint.ts {
 *     connector: "cat-facts",
 *     action: "get_random_fact",
 *     method: "GET",
 *     endpoint_url: "/fact",
 *     description: "Get a random cat fact"
 *   }
 */

import { z } from "zod";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

// ── Schema ──────────────────────────────────────────────────────────────────

export const WrapApiEndpointSchema = z.object({
  connector: z.string().min(2).describe("Target connector name (e.g., 'cat-facts')"),
  action: z
    .string()
    .min(2)
    .regex(/^[a-z][a-z0-9_]*$/, "Action name must be snake_case")
    .describe("Action name in snake_case (e.g., 'get_random_fact')"),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).describe("HTTP method"),
  endpoint_url: z.string().describe("API endpoint path (e.g., '/fact')"),
  description: z.string().optional().describe("Description for docs"),
  params_schema: z
    .record(z.string())
    .optional()
    .describe("Parameter names and their types (e.g., {limit: 'number'})"),
  response_field: z.string().optional().describe("Key to extract from JSON response"),
});

export type WrapApiEndpointInput = z.infer<typeof WrapApiEndpointSchema>;

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
    throw new Error(`SAFETY: Cannot edit production connector '${name}'. Use _test_ prefix for testing.`);
  }
  return true;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function toPascalCase(snake: string): string {
  return snake
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

function toCamelCase(snake: string): string {
  const pascal = toPascalCase(snake);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function buildHandlerCode(input: WrapApiEndpointInput): string {
  const { action, method, endpoint_url, description, params_schema, response_field } = input;
  const fnName = toCamelCase(action);

  let handler = `async function ${fnName}(args?: Record<string, unknown>): Promise<ActionResponse> {\n`;
  handler += `  try {\n`;

  // Build URL with query params if GET
  if (method === "GET" && params_schema && Object.keys(params_schema).length > 0) {
    const params = Object.keys(params_schema);
    handler += `    const params = new URLSearchParams();\n`;
    for (const p of params) {
      handler += `    if (args?.${p}) params.set("${p}", String(args.${p}));\n`;
    }
    handler += `    const url = \`\${BASE_URL}${endpoint_url}\${params.toString() ? "?" + params.toString() : ""}\`;\n`;
  } else {
    handler += `    const url = \`\${BASE_URL}${endpoint_url}\`;\n`;
  }

  handler += `    const res = await fetch(url, {\n`;
  handler += `      method: "${method}",\n`;
  if (method !== "GET") {
    handler += `      headers: { "Content-Type": "application/json" },\n`;
    handler += `      body: JSON.stringify(args || {}),\n`;
  }
  handler += `    });\n\n`;
  handler += `    if (!res.ok) {\n`;
  handler += `      return fail("${action}", \`HTTP \${res.status}: \${res.statusText}\`);\n`;
  handler += `    }\n\n`;
  handler += `    const data = await res.json();\n`;

  if (response_field) {
    handler += `    return ok(data.${response_field} ?? data, "${action}");\n`;
  } else {
    handler += `    return ok(data, "${action}");\n`;
  }

  handler += `  } catch (e) { return fail("${action}", e); }\n`;
  handler += `}\n`;

  return handler;
}

// ── Main Function ───────────────────────────────────────────────────────────

export async function execute(input: WrapApiEndpointInput): Promise<SkillScriptOutput> {
  try {
    const parsed = WrapApiEndpointSchema.parse(input);
    const { connector, action } = parsed;

    isSafeTarget(connector);

    const CWD = process.cwd();
    const clientPath = join(CWD, "connectors", connector, "client.ts");

    if (!existsSync(clientPath)) {
      return {
        success: false,
        error: `Client file not found: connectors/${connector}/client.ts. Run create-connector-pack.ts first.`,
      };
    }

    let content = readFileSync(clientPath, "utf-8");

    // Check if action already exists
    if (content.includes(`case "${action}":`)) {
      return {
        success: false,
        error: `Action '${action}' already exists in connectors/${connector}/client.ts.`,
      };
    }

    // ── 1. Insert the handler function code BEFORE the router ──
    const handlerCode = buildHandlerCode(parsed);
    const routerMarker = "// ── Main Action Router";
    const routerIdx = content.indexOf(routerMarker);

    if (routerIdx < 0) {
      return {
        success: false,
        error: `Could not find 'Main Action Router' section in client.ts. File may be malformed.`,
      };
    }

    content = content.slice(0, routerIdx) + handlerCode + "\n" + content.slice(routerIdx);

    // ── 2. Insert the switch case ──
    const switchMatch = content.match(/(switch\s*\(\s*action\s*\)\s*\{)/);
    if (!switchMatch || switchMatch.index === undefined) {
      return { success: false, error: "Could not find switch statement in client.ts." };
    }

    const switchBodyStart = switchMatch.index + switchMatch[0].length;
    const caseLine = `\n    case "${action}": return ${toCamelCase(action)}(args);`;

    content = content.slice(0, switchBodyStart) + caseLine + content.slice(switchBodyStart);

    // ── 3. Add to availableActions ──
    const actionsMatch = content.match(/export const availableActions: string\[\]\s*=\s*\[/);
    if (!actionsMatch || actionsMatch.index === undefined) {
      return { success: false, error: "Could not find availableActions in client.ts." };
    }

    const actionsStart = actionsMatch.index + actionsMatch[0].length;
    const actionEntry = `\n  "${action}",`;

    content = content.slice(0, actionsStart) + actionEntry + content.slice(actionsStart);

    // ── 4. Write back ──
    writeFileSync(clientPath, content);

    const handlerFnName = toCamelCase(action);

    return {
      success: true,
      data: {
        connector,
        action,
        method: parsed.method,
        endpoint_url: parsed.endpoint_url,
        handler_function: handlerFnName,
        file_updated: `connectors/${connector}/client.ts`,
        lines_changed: handlerCode.split("\n").length + 2,
        next_step:
          "Run update-master-registry.ts to register the new action, then typecheck + build.",
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `wrap-api-endpoint failed: ${msg}` };
  }
}

export default execute;
