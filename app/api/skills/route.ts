/**
 * GET /api/skills — List available Jarvis cortex skills.
 * Tries VPS bridge first, falls back to bundled static catalog.
 */

const FALLBACK_SKILLS = [
  {
    name: "neptune-project-hierarchy-LOCKED.md",
    description: "Project identity and hierarchy for all Neptune projects",
    category: "neptune",
  },
  {
    name: "mission-resume-protocol-LOCKED.md",
    description: "How to resume missions from checkpoint",
    category: "mission",
  },
  {
    name: "neptune-auto-mode-routing.md",
    description: "Auto-mode intent routing and model selection",
    category: "neptune",
  },
  {
    name: "neptune-ai-byok-routing.md",
    description: "BYOK routing patterns for AI providers",
    category: "neptune",
  },
  {
    name: "working-with-neptune-ui.md",
    description: "Guide for working with Neptune UI components",
    category: "neptune",
  },
  {
    name: "working-with-newleaf-base44.md",
    description: "Guide for NewLeaf Base44 platform",
    category: "platform",
  },
  {
    name: "checkpoint-discipline.md",
    description: "Checkpoint protocol for long missions",
    category: "mission",
  },
  {
    name: "billing-and-payments.md",
    description: "Billing, payments, and NMI integration",
    category: "platform",
  },
  {
    name: "jarvis-os-repo-map.md",
    description: "Repository structure map for Jarvis OS",
    category: "platform",
  },
  {
    name: "orchestration-and-dispatch.md",
    description: "Agent orchestration and dispatch patterns",
    category: "agent",
  },
];

export async function GET() {
  // Try VPS bridge first
  try {
    const bridgeUrl = process.env.VPS_FS_BRIDGE_URL || null;

    if (bridgeUrl) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(`${bridgeUrl}/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentPath: "jarvis/cortex/skills" }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const files = (data.files ?? []).map(
          (f: { name: string; size?: number }) => ({
            name: f.name,
            description: `Skill file (${f.size ?? "unknown"} bytes)`,
            category: "skills",
          })
        );
        return Response.json({
          source: "vps",
          count: files.length,
          skills: files,
        });
      }
    }
  } catch {
    // Fall through to static catalog
  }

  return Response.json({
    source: "static",
    count: FALLBACK_SKILLS.length,
    skills: FALLBACK_SKILLS,
  });
}
