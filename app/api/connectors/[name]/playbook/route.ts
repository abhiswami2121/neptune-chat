/**
 * GET /api/connectors/[name]/playbook — returns rendered PLAYBOOK.md content
 * for the given connector. Used by the ConnectorDetailSheet Playbook tab.
 */

import { getPlaybook } from "@/lib/connectors/playbook-loader";
import { initConnectors } from "@/lib/connectors/init";
import { requireAllowlist } from "@/lib/auth/require-allowlist";

export const GET = requireAllowlist(async (
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) => {
  const { name } = await params;

  // Ensure registry is populated (idempotent)
  initConnectors();

  const playbook = getPlaybook(name);

  if (!playbook) {
    return Response.json(
      { error: `No playbook found for connector "${name}"` },
      { status: 404 }
    );
  }

  return Response.json({
    connectorId: playbook.connectorId,
    connectorName: playbook.connectorName,
    rawMarkdown: playbook.rawMarkdown,
    sections: playbook.sections.map((s) => ({
      heading: s.heading,
      content: s.content,
      level: s.level,
    })),
  });
});
