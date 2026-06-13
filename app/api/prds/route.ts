/**
 * GET /api/prds — List available PRDs.
 * Tries VPS bridge first, falls back to bundled static catalog.
 */

const FALLBACK_PRDS = [
  {
    name: "neptune-chat-production-grade-master-v2.md",
    description: "North Star PRD for Neptune Chat production deployment",
    category: "neptune",
  },
  {
    name: "neptune-chat-code-integration-master-v1.md",
    description: "Original Neptune Chat code integration PRD",
    category: "neptune",
  },
  {
    name: "PRD_BASE44_TWO_LANE_WORKFLOW.md",
    description: "Base44 two-lane workflow architecture",
    category: "platform",
  },
  {
    name: "hermes-ai-computer-full-prd.md",
    description: "Hermes AI Computer full PRD and phase plan",
    category: "platform",
  },
];

import { requireAllowlist } from "@/lib/auth/require-allowlist";

export const GET = requireAllowlist(async () => {
  try {
    const bridgeUrl = process.env.VPS_FS_BRIDGE_URL || null;

    if (bridgeUrl) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(`${bridgeUrl}/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentPath: "jarvis/prd" }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const files = (data.files ?? []).map(
          (f: { name: string; size?: number }) => ({
            name: f.name,
            description: `PRD file (${f.size ?? "unknown"} bytes)`,
            category: "prd",
          })
        );
        return Response.json({
          source: "vps",
          count: files.length,
          prds: files,
        });
      }
    }
  } catch {
    // Fall through
  }

  return Response.json({
    source: "static",
    count: FALLBACK_PRDS.length,
    prds: FALLBACK_PRDS,
  });
});
