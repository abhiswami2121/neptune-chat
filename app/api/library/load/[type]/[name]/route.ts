/**
 * GET /api/library/load/:type/:name — Returns full document content for a node.
 *
 * Types: connector | skill | function | playbook | workflow
 * Name:  node identifier (e.g., "nmi-connector", "billing", "calculate-refund-eligibility")
 *
 * Returns the full markdown/file content for the node.
 * Used by the progressive disclosure tools: load_playbook, load_connector, load_function.
 *
 * Cache: 5-min ETag via Cache-Control (based on node updated_at).
 */
import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";
import { requireAllowlist } from "@/lib/auth/require-allowlist";

const POSTGRES_URL = process.env.POSTGRES_URL;

// ── Types ──────────────────────────────────────────────────────────────────

interface LoadResponse {
  type: string;
  name: string;
  content: string;
  metadata: Record<string, unknown>;
  edges: {
    dependsOn: string[];
    usedBy: string[];
    routesTo: string[];
  };
}

// ── Handler ────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; name: string }> }
) {
  const { type, name } = await params;

  // Validate type
  const validTypes = ["connector", "skill", "function", "playbook", "workflow"];
  if (!validTypes.includes(type)) {
    return NextResponse.json(
      { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
      { status: 400 }
    );
  }

  if (!POSTGRES_URL) {
    return NextResponse.json({ error: "DB not configured" }, { status: 500 });
  }

  const sql = postgres(POSTGRES_URL, { max: 1 });

  try {
    let content = "";
    let metadata: Record<string, unknown> = {};
    let updatedAt: Date | null = null;

    // Fetch content based on type
    switch (type) {
      case "connector": {
        const [row] = await sql`
          SELECT "content" FROM "library_skills"
          WHERE "connector_name" = ${name} AND "type" = 'connector'
          LIMIT 1
        `;
        if (row) {
          content = row.content || "";
        } else {
          // Fallback to connector row
          const [c] = await sql`
            SELECT "description", "tools", "tool_names", "version"
            FROM "library_connectors" WHERE "name" = ${name}
          `;
          if (!c) {
            return NextResponse.json({ error: `Connector '${name}' not found` }, { status: 404 });
          }
          content = `# ${name}\n\n${c.description}`;
          metadata = { tools: c.tools, toolNames: c.tool_names, version: c.version };
        }
        break;
      }

      case "skill": {
        const [row] = await sql`
          SELECT "content", "description", "version", "connector_name"
          FROM "library_skills"
          WHERE "name" = ${name}
          LIMIT 1
        `;
        if (!row) {
          return NextResponse.json({ error: `Skill '${name}' not found` }, { status: 404 });
        }
        content = row.content || "";
        metadata = { description: row.description, version: row.version, connectorName: row.connector_name };
        updatedAt = row.updated_at;
        break;
      }

      case "function": {
        const [row] = await sql`
          SELECT "signature", "domain", "dependencies", "description", "version"
          FROM "library_functions" WHERE "name" = ${name}
        `;
        if (!row) {
          return NextResponse.json({ error: `Function '${name}' not found` }, { status: 404 });
        }
        content = `# ${name}\n\nSignature: \`${row.signature || "unknown"}\`\n\n${row.description}`;
        metadata = {
          signature: row.signature,
          domain: row.domain,
          dependencies: row.dependencies,
          version: row.version,
        };
        break;
      }

      case "playbook": {
        const [row] = await sql`
          SELECT "content", "scope_connectors", "triggers", "workflows", "description"
          FROM "library_playbooks" WHERE "name" = ${name}
        `;
        if (!row) {
          return NextResponse.json({ error: `Playbook '${name}' not found` }, { status: 404 });
        }
        content = row.content || "";
        metadata = {
          scopeConnectors: row.scope_connectors,
          triggers: row.triggers,
          workflows: row.workflows,
          description: row.description,
        };
        break;
      }

      case "workflow": {
        const [row] = await sql`
          SELECT "name", "durable", "description", "playbook_name"
          FROM "library_workflows" WHERE "name" = ${name}
        `;
        if (!row) {
          return NextResponse.json({ error: `Workflow '${name}' not found` }, { status: 404 });
        }
        content = `# ${name}\n\nDurable: ${row.durable}\n\n${row.description}`;
        metadata = { durable: row.durable, playbookName: row.playbook_name };
        break;
      }
    }

    // Compute edges for this node
    const [dependsRows, usedByRows] = await Promise.all([
      sql`SELECT "to_node" FROM "library_edges" WHERE "from_node" = ${name} AND "from_type" = ${type}`,
      sql`SELECT "from_node", "edge_type" FROM "library_edges" WHERE "to_node" = ${name} AND "to_type" = ${type}`,
    ]);

    const dependsOn = dependsRows.map((r) => r.to_node);
    const usedBy = usedByRows.filter((r) => r.edge_type === "depends_on" || r.edge_type === "uses").map((r) => r.from_node);
    const routesTo = usedByRows.filter((r) => r.edge_type === "routes_to").map((r) => r.from_node);

    const response: LoadResponse = {
      type,
      name,
      content,
      metadata,
      edges: { dependsOn, usedBy, routesTo },
    };

    const etag = `"${Date.now().toString(36)}"`;

    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
        ETag: etag,
      },
    });
  } catch (err) {
    console.error("[library/load]", err);
    return NextResponse.json({ error: "Load failed" }, { status: 500 });
  } finally {
    await sql.end();
  }
}

export { requireAllowlist };
