import { NextResponse } from "next/server";
import {
  getEntityById,
  getRelationsForEntity,
  traverseGraph,
} from "@/lib/knowledge/client";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const entity = await getEntityById(id);
    if (!entity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    const relations = await getRelationsForEntity(id, "both", 50);
    const graph = await traverseGraph(id, 2);

    return NextResponse.json({
      entity,
      relations,
      graph,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
