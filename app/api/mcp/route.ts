import { NextResponse } from "next/server";
import { mcpHub } from "@/lib/mcp/hub";
import { requireAllowlist } from "@/lib/auth/require-allowlist";

export const GET = requireAllowlist(async () => {
  const servers = mcpHub.getServerList();
  return NextResponse.json({
    servers,
    toolCount: servers.reduce((sum, s) => sum + s.tools.length, 0),
  });
});
