/**
 * MCP Client Manager — connects to MCP servers and surfaces their tools
 * as AI SDK compatible tool objects.
 *
 * PRD ref: Section 3, Layer 3 — MCP Server Integrations
 * Uses @ai-sdk/mcp experimental_createMCPClient for HTTP/SSE transport.
 *
 * Gracefully degrades when MCP_SERVER_URL is not configured — returns
 * empty tool set rather than throwing.
 */

import { experimental_createMCPClient, type MCPClient } from "@ai-sdk/mcp";

// ── Configuration ────────────────────────────────────────────────────────

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || "";
const MCP_SERVER_NAME = process.env.MCP_SERVER_NAME || "MCP Server";

// ── Singleton (per-request scope) ────────────────────────────────────────

let _clientPromise: Promise<MCPClient | null> | null = null;

function getClientPromise(): Promise<MCPClient | null> {
  if (!_clientPromise) {
    _clientPromise = createClient();
  }
  return _clientPromise;
}

async function createClient(): Promise<MCPClient | null> {
  if (!MCP_SERVER_URL) {
    return null;
  }

  try {
    const client = await experimental_createMCPClient({
      transport: {
        type: "http",
        url: MCP_SERVER_URL,
      },
      clientName: "neptune-chat",
      version: "3.1.0",
      onUncaughtError: (error) => {
        console.warn("[mcp] uncaught error:", error);
      },
    });

    return client;
  } catch (error) {
    console.warn("[mcp] failed to connect:", error);
    return null;
  }
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Returns AI SDK-compatible tool objects from all connected MCP servers.
 * Each tool has inputSchema (zod) and execute() functions — ready to pass
 * directly to streamText() / ToolLoopAgent.
 *
 * Returns empty object if no MCP server is configured or connection fails.
 */
export async function getMCPTools(): Promise<Record<string, unknown>> {
  const client = await getClientPromise();
  if (!client) {
    return {};
  }

  try {
    const tools = await client.tools();
    return tools as Record<string, unknown>;
  } catch (error) {
    console.warn("[mcp] failed to fetch tools:", error);
    return {};
  }
}

/**
 * Returns an array of MCP tool names — for use in experimental_activeTools.
 */
export async function getMCPToolNames(): Promise<string[]> {
  const client = await getClientPromise();
  if (!client) {
    return [];
  }

  try {
    const result = await client.listTools();
    return result.tools.map((t) => t.name);
  } catch {
    return [];
  }
}

/**
 * Returns metadata about connected MCP servers and their tools.
 * Used by /api/mcp/tools endpoint to populate the UI.
 */
export async function getMCPServerInfo(): Promise<{
  connected: boolean;
  serverName: string;
  serverUrl: string;
  serverVersion?: string;
  instructions?: string;
  tools: Array<{
    name: string;
    description?: string;
    title?: string;
  }>;
}> {
  if (!MCP_SERVER_URL) {
    return {
      connected: false,
      serverName: MCP_SERVER_NAME,
      serverUrl: "",
      tools: [],
    };
  }

  const client = await getClientPromise();
  if (!client) {
    return {
      connected: false,
      serverName: MCP_SERVER_NAME,
      serverUrl: MCP_SERVER_URL,
      tools: [],
    };
  }

  try {
    const result = await client.listTools();

    return {
      connected: true,
      serverName: MCP_SERVER_NAME,
      serverUrl: MCP_SERVER_URL,
      serverVersion: `${client.serverInfo.name}@${client.serverInfo.version}`,
      instructions: client.instructions,
      tools: result.tools.map((t) => ({
        name: t.name,
        description: t.description,
        title: t.title,
      })),
    };
  } catch (_error) {
    return {
      connected: false,
      serverName: MCP_SERVER_NAME,
      serverUrl: MCP_SERVER_URL,
      tools: [],
    };
  }
}

/**
 * Returns whether any MCP server is configured and reachable.
 */
export async function isMCPAvailable(): Promise<boolean> {
  if (!MCP_SERVER_URL) {
    return false;
  }
  const client = await getClientPromise();
  return client !== null;
}

/**
 * Resets the cached client — used when MCP_SERVER_URL changes at runtime
 * or for testing. In serverless, the cache naturally resets per-invocation.
 */
export function resetMCPClient(): void {
  _clientPromise = null;
}
