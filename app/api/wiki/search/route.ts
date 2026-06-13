import { type NextRequest, NextResponse } from "next/server";
import { searchEntities, vectorSearch } from "@/lib/knowledge/client";
import { generateEmbedding } from "@/lib/knowledge/embeddings";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") ?? "";
  const limit = parseInt(searchParams.get("limit") ?? "20");

  if (!query || query.length < 2) {
    return NextResponse.json({ entities: [], relations: [], total: 0 });
  }

  try {
    // Text search
    const textResults = await searchEntities(query, limit);

    // Vector search
    const embedding = await generateEmbedding(query);
    const vecResults = await vectorSearch(embedding, limit, 0.3);

    // Merge and deduplicate
    const entityMap = new Map<string, (typeof textResults)[0]>();
    for (const e of vecResults) entityMap.set(e.id, e);
    for (const e of textResults) {
      if (!entityMap.has(e.id)) entityMap.set(e.id, e);
    }

    const entities = Array.from(entityMap.values()).sort(
      (a, b) => b.confidence - a.confidence
    );

    return NextResponse.json({
      entities: entities.slice(0, limit),
      total: entityMap.size,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
