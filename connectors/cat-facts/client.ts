/**
 * cat-facts Connector Client — U2.5 skill-author generated
 *
 * Cat Facts API — random feline trivia from catfact.ninja
 *
 * Pattern: ActionRequest -> execute() -> ActionResponse
 * Reference: connectors/slack/client.ts for the canonical pattern.
 *
 * Usage:
 *   import { execute } from "@/connectors/cat-facts/client";
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
  return { success: false, error: `${action} failed: ${msg}` };
}

// ── Configuration ──────────────────────────────────────────────────────────────

const BASE_URL = process.env.CAT_FACTS_API_URL || "https://catfact.ninja";

// ── Action Handlers ───────────────────────────────────────────────────────────

// Each handler is an async function taking optional args → ActionResponse
// Add new handlers below via wrap-api-endpoint.ts

async function getRandomFact(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const url = `${BASE_URL}/fact`;
    const res = await fetch(url, {
      method: "GET",
    });

    if (!res.ok) {
      return fail("get_random_fact", `HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    return ok(data, "get_random_fact");
  } catch (e) { return fail("get_random_fact", e); }
}

async function getMultipleFacts(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const params = new URLSearchParams();
    if (args?.limit) params.set("limit", String(args.limit));
    const url = `${BASE_URL}/facts${params.toString() ? "?" + params.toString() : ""}`;
    const res = await fetch(url, {
      method: "GET",
    });

    if (!res.ok) {
      return fail("get_multiple_facts", `HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    return ok(data, "get_multiple_facts");
  } catch (e) { return fail("get_multiple_facts", e); }
}

async function listBreeds(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const url = `${BASE_URL}/breeds`;
    const res = await fetch(url, {
      method: "GET",
    });

    if (!res.ok) {
      return fail("list_breeds", `HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    return ok(data, "list_breeds");
  } catch (e) { return fail("list_breeds", e); }
}

// ── Main Action Router ────────────────────────────────────────────────────────

export async function execute(req: ActionRequest): Promise<ActionResponse> {
  const { action, args } = req;

  switch (action) {
    case "list_breeds": return listBreeds(args);
    case "get_multiple_facts": return getMultipleFacts(args);
    case "get_random_fact": return getRandomFact(args);

    default:
      return {
        success: false,
        error: `Unknown action: '${action}'. Available: ${availableActions.join(", ")}`,
      };
  }
}

// ── Available Actions Registry ────────────────────────────────────────────────

export const availableActions: string[] = [
  "list_breeds",
  "get_multiple_facts",
  "get_random_fact",
];

export default { execute, availableActions };
