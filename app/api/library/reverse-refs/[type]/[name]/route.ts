/**
 * GET /api/library/reverse-refs/:type/:name — Returns all nodes that reference a target node.
 *
 * Used by LibraryTree edge visualization on hover.
 * Shows which connectors, functions, skills, and playbooks depend on the given node.
 *
 * Cache: 5-min ETag via Cache-Control.
 */
import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";
import { requireAllowlist } from "@/lib/auth/require-allowlist";

const POSTGRES_URL = process.env.POSTGRES_URL;

// ── Types ──────────────────────────────────────────────────────────────────

interface ReverseRef {
  from: string;
  fromType: string;
  edgeType: string;
  weight: number;
}

interface ReverseRefsResponse {
  target: {
    type: string;
    name: string;
  };
  refs: ReverseRef[];
  total: number;
}

// ── Handler ────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; name: string }> }
) {
  const { type, name } = await params;

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
    const rows = await sql`
      SELECT "from_node", "from_type", "edge_type", "weight"
      FROM "library_edges"
      WHERE "to_node" = ${name} AND "to_type" = ${type}
      ORDER BY "weight" DESC, "from_node"
    `;

    const refs: ReverseRef[] = rows.map((r) => ({
      from: r.from_node,
      fromType: r.from_type,
      edgeType: r.edge_type,
      weight: r.weight,
    }));

    const response: ReverseRefsResponse = {
      target: { type, name },
      refs,
      total: refs.length,
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
    console.error("[library/reverse-refs]", err);
    return NextResponse.json({ error: "Reverse refs query failed" }, { status: 500 });
  } finally {
    await sql.end();
  }
}

export { requireAllowlist };
