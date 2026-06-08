/**
 * GET /api/mcp/tools — List tools from connected MCP servers.
 * Uses @ai-sdk/mcp to discover and describe available MCP tools.
 *
 * Returns: { connected, serverName, serverUrl, tools[] }
 * Gracefully returns empty tools list when no MCP server is configured.
 */

import { getMCPServerInfo, getMCPToolNames } from "@/lib/mcp/client";

export async function GET() {
  const [info, toolNames] = await Promise.all([
    getMCPServerInfo(),
    getMCPToolNames(),
  ]);

  return Response.json({
    ...info,
    activeToolCount: toolNames.length,
  });
}
