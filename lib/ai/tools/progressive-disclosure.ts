/**
 * Phase 12.C — Progressive Disclosure Tools
 *
 * 3 loader tools that the agent uses to incrementally discover capabilities:
 *   load_playbook(name)  → loads a domain playbook's full SOP content
 *   load_connector(name) → loads a connector's SKILL.md + tool list
 *   load_function(name)  → loads a function's signature + description
 *
 * Architecture: calls the /api/library/load/:type/:name endpoint internally.
 * Each call returns the full content of the node, not a summary.
 * The agent walks the tree: playbook → connectors → functions, loading only what it needs.
 *
 * Cardinal: NEVER expose more than 4 tools at runtime (these 3 + primitives).
 */

import { tool } from "ai";
import { z } from "zod";

// ── Internal fetch helper ──────────────────────────────────────────────────

const API_BASE = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

async function loadFromLibrary(type: string, name: string): Promise<{
  loaded: boolean;
  type: string;
  name: string;
  content: string;
  metadata: Record<string, unknown>;
  edges: { dependsOn: string[]; usedBy: string[]; routesTo: string[] };
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const url = `${API_BASE}/api/library/load/${type}/${encodeURIComponent(name)}`;
    const res = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "x-internal-token": process.env.NEPTUNE_INTERNAL_TOKEN || "",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        loaded: false,
        type,
        name,
        content: "",
        metadata: {},
        edges: { dependsOn: [], usedBy: [], routesTo: [] },
        error: (errData as any).error || `HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    return {
      loaded: true,
      type: data.type,
      name: data.name,
      content: data.content || "",
      metadata: data.metadata || {},
      edges: data.edges || { dependsOn: [], usedBy: [], routesTo: [] },
    };
  } catch (err) {
    return {
      loaded: false,
      type,
      name,
      content: "",
      metadata: {},
      edges: { dependsOn: [], usedBy: [], routesTo: [] },
      error: err instanceof Error ? err.message : "Unknown error loading from library",
    };
  }
}

// ── Phase 13.B: Usage Logging ──────────────────────────────────────────────

/**
 * Logs a skill load event to library_usage_logs (immutable audit trail).
 * Called inside each progressive disclosure tool after every load.
 * Non-blocking — fire-and-forget, failures are silent.
 */
async function logUsage(params: {
  skillLoaded: string;
  skillType: string;
  success: boolean;
  sessionId?: string;
  playbookRoutedFrom?: string;
  tokensActual?: number;
  latencyActualMs?: number;
}) {
  try {
    const logUrl = `${API_BASE}/api/library/log-usage`;
    await fetch(logUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-token": process.env.NEPTUNE_INTERNAL_TOKEN || "",
      },
      body: JSON.stringify({
        session_id: params.sessionId || "unknown",
        skill_loaded: params.skillLoaded,
        skill_type: params.skillType,
        playbook_routed_from: params.playbookRoutedFrom || null,
        success_marker: params.success,
        tokens_actual: params.tokensActual || null,
        latency_actual_ms: params.latencyActualMs || null,
      }),
      // Fire-and-forget: short timeout, don't block the tool
    }).catch(() => {}); // silent failure
  } catch {
    // Logging failure must never block the tool
  }
}

// ── load_playbook ──────────────────────────────────────────────────────────

export const loadPlaybook = tool({
  description:
    "Load a domain playbook to discover SOPs and routines for a specific business domain. " +
    "This is THE FIRST tool you should call for any task. " +
    "Available playbooks: billing, customer-support, disputes, marketing, reporting, HR, " +
    "engineering, vps-ops, planning-research, vercel-discipline, agent-orchestration. " +
    "The playbook content includes operational knowledge, anti-patterns, safeguards, " +
    "trigger words, connector routing, and step-by-step routines. " +
    "After loading a playbook, use load_connector for specific integration instructions.",
  inputSchema: z.object({
    name: z
      .string()
      .describe(
        "Domain playbook name. Examples: 'billing', 'customer-support', 'disputes', " +
        "'marketing', 'reporting', 'HR', 'engineering', 'vps-ops', 'planning-research', " +
        "'vercel-discipline', 'agent-orchestration'."
      ),
    session_id: z.string().optional().describe("Current session ID for usage tracking"),
  }),
  execute: async ({ name, session_id }) => {
    const startTime = Date.now();
    const result = await loadFromLibrary("playbook", name);
    const latency = Date.now() - startTime;

    // Phase 13.B: Log usage
    logUsage({
      skillLoaded: name,
      skillType: "playbook",
      success: result.loaded,
      sessionId: session_id,
      playbookRoutedFrom: undefined,
      tokensActual: result.content?.length ? Math.ceil(result.content.length / 2.5) : undefined,
      latencyActualMs: latency,
    });

    if (!result.loaded) {
      return {
        playbook_name: name,
        loaded: false,
        error: result.error || `Playbook '${name}' not found`,
        hint: "Try 'billing', 'customer-support', 'disputes', 'marketing', 'reporting', 'HR', or 'engineering'.",
      };
    }

    return {
      playbook_name: result.name,
      loaded: true,
      content: result.content.slice(0, 20000), // Cap at 20KB
      content_truncated: result.content.length > 20000,
      metadata: result.metadata,
      next_steps: "Use the scope_connectors from metadata to call load_connector for specific integration instructions.",
    };
  },
});

// ── load_connector ─────────────────────────────────────────────────────────

export const loadConnector = tool({
  description:
    "Load detailed instructions for using a specific integration/connector. " +
    "Call this AFTER loading a playbook — the playbook tells you which connectors to use. " +
    "Each connector doc includes: available tools/functions, usage patterns, " +
    "anti-patterns, and required parameters. " +
    "Available connectors: nmi, slack, github, linear, base44, ghl, hyperswitch, " +
    "forth, vapi, vercel, affy, wiki, mcp-hub, ai-sdk-6, workflow-devkit, neptune, cat-facts, custom-skills.",
  inputSchema: z.object({
    name: z
      .string()
      .describe(
        "Connector name. Supports both short names and full names. " +
        "Examples: 'nmi', 'slack', 'github', 'base44', 'ghl', 'hyperswitch', " +
        "'forth', 'vapi', 'vercel', 'nmi-connector', 'slack-connector'."
      ),
    playbook_routed_from: z.string().optional().describe("Which playbook routed to this connector"),
    session_id: z.string().optional().describe("Current session ID for usage tracking"),
  }),
  execute: async ({ name, playbook_routed_from, session_id }) => {
    const startTime = Date.now();
    const normalized = name.endsWith("-connector") ? name : `${name}-connector`;

    // Try both normalized and original
    let result = await loadFromLibrary("connector", normalized);
    if (!result.loaded) {
      result = await loadFromLibrary("connector", name);
    }
    if (!result.loaded) {
      result = await loadFromLibrary("connector", name.replace(/-connector$/, ""));
    }
    const latency = Date.now() - startTime;

    // Phase 13.B: Log usage
    logUsage({
      skillLoaded: name,
      skillType: "connector",
      success: result.loaded,
      sessionId: session_id,
      playbookRoutedFrom: playbook_routed_from,
      tokensActual: result.content?.length ? Math.ceil(result.content.length / 2.5) : undefined,
      latencyActualMs: latency,
    });

    if (!result.loaded) {
      return {
        connector_name: name,
        loaded: false,
        error: result.error || `Connector '${name}' not found`,
        hint: "Available connectors: nmi, slack, github, linear, base44, ghl, hyperswitch, forth, vapi, vercel, affy, wiki, mcp-hub, ai-sdk-6, workflow-devkit.",
      };
    }

    return {
      connector_name: result.name,
      loaded: true,
      content: result.content.slice(0, 15000),
      content_truncated: result.content.length > 15000,
      metadata: result.metadata,
      next_steps: "Use load_function for detailed function signatures if needed.",
    };
  },
});

// ── load_function ──────────────────────────────────────────────────────────

export const loadFunction = tool({
  description:
    "Load the detailed specification for a domain function. " +
    "Use when you need a function's exact signature, parameters, return type, " +
    "and dependencies. Functions are reusable business logic units that combine " +
    "connector tools into higher-level operations. " +
    "Available functions: calculate-refund-eligibility, billing-event-logger, " +
    "cof-health-audit, validate-action, resolve-customer-identity, generate-ai-email, " +
    "parse-fcra-credit-report, extract-customer-pii, build-customer-vde, execute-with-post-verify.",
  inputSchema: z.object({
    name: z
      .string()
      .describe(
        "Function name. Examples: 'calculate-refund-eligibility', 'cof-health-audit', " +
        "'validate-action', 'resolve-customer-identity', 'generate-ai-email'."
      ),
    playbook_routed_from: z.string().optional().describe("Which playbook routed to this function"),
    session_id: z.string().optional().describe("Current session ID for usage tracking"),
  }),
  execute: async ({ name, playbook_routed_from, session_id }) => {
    const startTime = Date.now();
    const result = await loadFromLibrary("function", name);
    const latency = Date.now() - startTime;

    // Phase 13.B: Log usage
    logUsage({
      skillLoaded: name,
      skillType: "function",
      success: result.loaded,
      sessionId: session_id,
      playbookRoutedFrom: playbook_routed_from,
      tokensActual: result.content?.length ? Math.ceil(result.content.length / 2.5) : undefined,
      latencyActualMs: latency,
    });

    if (!result.loaded) {
      return {
        function_name: name,
        loaded: false,
        error: result.error || `Function '${name}' not found`,
      };
    }

    return {
      function_name: result.name,
      loaded: true,
      content: result.content,
      metadata: result.metadata,
      edges: result.edges,
    };
  },
});

// ── Export all 3 progressive disclosure tools ──────────────────────────────

export const progressiveTools = {
  load_playbook: loadPlaybook,
  load_connector: loadConnector,
  load_function: loadFunction,
};

export { loadPlaybook as load_playbook, loadConnector as load_connector, loadFunction as load_function };
