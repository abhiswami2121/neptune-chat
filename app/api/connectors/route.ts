/**
 * GET /api/connectors — List configured integrations and their status.
 * Reads from environment variables to determine connection state.
 */

interface Connector {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: "connected" | "configured" | "disconnected";
  details: string;
}

export function GET() {
  const connectors: Connector[] = [
    {
      id: "github",
      name: "GitHub",
      description: "Code repository integration",
      icon: "github",
      status: process.env.GITHUB_TOKEN ? "connected" : "disconnected",
      details: process.env.GITHUB_TOKEN
        ? "Token configured"
        : "Set GITHUB_TOKEN env var to connect",
    },
    {
      id: "slack",
      name: "Slack",
      description: "Team messaging integration",
      icon: "slack",
      status: process.env.SLACK_BOT_TOKEN ? "connected" : "disconnected",
      details: process.env.SLACK_BOT_TOKEN
        ? "Bot token configured"
        : "Set SLACK_BOT_TOKEN env var to connect",
    },
    {
      id: "postgres",
      name: "PostgreSQL",
      description: "Database integration",
      icon: "database",
      status: process.env.POSTGRES_URL ? "connected" : "disconnected",
      details: process.env.POSTGRES_URL
        ? "Neon Postgres connected"
        : "Set POSTGRES_URL env var to connect",
    },
    {
      id: "redis",
      name: "Redis",
      description: "Cache and session store",
      icon: "redis",
      status: process.env.REDIS_URL ? "connected" : "disconnected",
      details: process.env.REDIS_URL
        ? "Redis connected"
        : "Set REDIS_URL env var to connect",
    },
    {
      id: "vercel_blob",
      name: "Vercel Blob",
      description: "File storage",
      icon: "hard-drive",
      status: process.env.BLOB_READ_WRITE_TOKEN ? "connected" : "disconnected",
      details: process.env.BLOB_READ_WRITE_TOKEN
        ? "Blob storage configured"
        : "Set BLOB_READ_WRITE_TOKEN env var to connect",
    },
    {
      id: "vps_bridge",
      name: "VPS File Bridge",
      description: "Skill/PRD file system access",
      icon: "server",
      status: process.env.VPS_FS_BRIDGE_URL ? "configured" : "disconnected",
      details: process.env.VPS_FS_BRIDGE_URL
        ? `Bridge at ${process.env.VPS_FS_BRIDGE_URL}`
        : "Set VPS_FS_BRIDGE_URL to enable knowledge tools",
    },
    {
      id: "neptune_v2",
      name: "Neptune V2",
      description: "Coding engine bridge",
      icon: "bot",
      status: "configured",
      details: process.env.NEPTUNE_V2_CHAT_URL
        ? `V2 at ${process.env.NEPTUNE_V2_CHAT_URL}`
        : "Using default neptune-v2.vercel.app",
    },
    {
      id: "mcp",
      name: "MCP Servers",
      description: "Model Context Protocol integration",
      icon: "plug",
      status: process.env.MCP_SERVER_URL ? "configured" : "disconnected",
      details: process.env.MCP_SERVER_URL
        ? `MCP at ${process.env.MCP_SERVER_URL}`
        : "Set MCP_SERVER_URL to connect MCP servers",
    },
  ];

  const summary = {
    total: connectors.length,
    connected: connectors.filter((c) => c.status === "connected").length,
    configured: connectors.filter(
      (c) => c.status === "connected" || c.status === "configured"
    ).length,
    disconnected: connectors.filter((c) => c.status === "disconnected").length,
  };

  return Response.json({ summary, connectors });
}
