/**
 * U1.3: Connector Function Inventory — wrapped vs total counts per connector.
 *
 * Single source of truth sourced from docs/inventory/MASTER-INVENTORY.md.
 * Used by /api/connectors, /connectors UI, and U2 wrapping plan.
 *
 * "wrapped" = tools currently accessible via Neptune
 * "total"   = backend-available tools/functions/endpoints (known lower bound)
 */

export interface ConnectorInventoryEntry {
  /** Connector ID matching manifest.id */
  id: string;
  /** Human-readable name */
  name: string;
  /** Tools/functions currently wrapped in Neptune */
  wrapped: number;
  /** Total tools/functions/endpoints available in backend */
  total: number;
  /** Wrap priority: P0 (blocking) | P1 (important) | P2 (nice-to-have) */
  priority: "P0" | "P1" | "P2";
  /** Short description of the backend surface */
  surface: string;
}

/**
 * Canonical inventory per MASTER-INVENTORY.md (2026-06-11).
 * VPS is included as a connector despite having no manifest yet.
 */
export const CONNECTOR_INVENTORY: ConnectorInventoryEntry[] = [
  {
    id: "base44",
    name: "Base44 CRM",
    wrapped: 6,
    total: 246,
    priority: "P0",
    surface: "91 entities, 40 MCP bridge tools, 16 reporting actions, NMI/Slack bridges",
  },
  {
    id: "slack",
    name: "Slack Communications",
    wrapped: 5,
    total: 20,
    priority: "P0",
    surface: "20 Slack MCP Bridge actions (10 read + 10 write)",
  },
  {
    id: "nmi",
    name: "NMI Payments",
    wrapped: 4,
    total: 30,
    priority: "P0",
    surface: "30+ NMI MCP Bridge actions, CoF toolkit, Golden Vault toolkit",
  },
  {
    id: "vapi",
    name: "Vapi Voice AI",
    wrapped: 2,
    total: 15,
    priority: "P0",
    surface: "15+ Vapi MCP Bridge actions (calls, transcripts, analytics, outcomes)",
  },
  {
    id: "ghl",
    name: "GHL CRM",
    wrapped: 5,
    total: 10,
    priority: "P0",
    surface: "Contacts, SMS, email, conversations, pipeline, opportunities",
  },
  {
    id: "github",
    name: "GitHub",
    wrapped: 6,
    total: 15,
    priority: "P1",
    surface: "Issue CRUD, labels, branches, workflow dispatch, repo settings",
  },
  {
    id: "vercel",
    name: "Vercel Deploy",
    wrapped: 5,
    total: 12,
    priority: "P1",
    surface: "REST API: projects, deployments, domains, env, integrations, usage",
  },
  {
    id: "hyperswitch",
    name: "Hyperswitch",
    wrapped: 3,
    total: 8,
    priority: "P1",
    surface: "Payment links, payments CRUD, refunds, analytics",
  },
  {
    id: "forth",
    name: "Forth Credit",
    wrapped: 5,
    total: 8,
    priority: "P1",
    surface: "Disputes, contacts, credit reports, enrollments",
  },
  {
    id: "vps",
    name: "VPS Functions",
    wrapped: 0,
    total: 15,
    priority: "P1",
    surface: "hostingerBridge, claude-agent-api, hermes-api, pm2, file operations",
  },
  {
    id: "affy",
    name: "Affy Chargebacks",
    wrapped: 4,
    total: 6,
    priority: "P2",
    surface: "Chargebacks, evidence submission, affidavits, dispute tracking",
  },
  {
    id: "linear",
    name: "Linear",
    wrapped: 4,
    total: 8,
    priority: "P2",
    surface: "Issues CRUD, search, projects, cycles",
  },
  {
    id: "wiki",
    name: "Wiki",
    wrapped: 5,
    total: 6,
    priority: "P2",
    surface: "Ingestion, querying, linting, page writing, index updates",
  },
  {
    id: "mcp-hub",
    name: "MCP Hub",
    wrapped: 3,
    total: 5,
    priority: "P2",
    surface: "Server listing, connection, tool discovery",
  },
];

/**
 * Look up inventory entry by connector ID.
 */
export function getInventoryEntry(
  id: string
): ConnectorInventoryEntry | undefined {
  return CONNECTOR_INVENTORY.find((e) => e.id === id);
}

/**
 * Compute aggregate coverage stats across all connectors.
 */
export function getInventoryCoverage(): {
  totalWrapped: number;
  totalAvailable: number;
  coveragePercent: number;
  byPriority: Record<string, { wrapped: number; total: number; count: number }>;
} {
  const totalWrapped = CONNECTOR_INVENTORY.reduce(
    (sum, e) => sum + e.wrapped,
    0
  );
  const totalAvailable = CONNECTOR_INVENTORY.reduce(
    (sum, e) => sum + e.total,
    0
  );

  const byPriority: Record<
    string,
    { wrapped: number; total: number; count: number }
  > = {};
  for (const e of CONNECTOR_INVENTORY) {
    if (!byPriority[e.priority]) {
      byPriority[e.priority] = { wrapped: 0, total: 0, count: 0 };
    }
    byPriority[e.priority].wrapped += e.wrapped;
    byPriority[e.priority].total += e.total;
    byPriority[e.priority].count += 1;
  }

  return {
    totalWrapped,
    totalAvailable,
    coveragePercent:
      totalAvailable > 0
        ? Math.round((totalWrapped / totalAvailable) * 1000) / 10
        : 0,
    byPriority,
  };
}
