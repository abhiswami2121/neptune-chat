"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ProvenanceChip } from "@/components/wiki/provenance-link";
import type { KgEntity, KgRelation } from "@/lib/knowledge/types";

export default function EntityDetailPage() {
  const { entityId } = useParams<{ entityId: string }>();
  const [entity, setEntity] = useState<KgEntity | null>(null);
  const [relations, setRelations] = useState<KgRelation[]>([]);
  const [relatedEntities, setRelatedEntities] = useState<KgEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/wiki/entity/${entityId}`);
        if (!res.ok) throw new Error("Entity not found");
        const data = await res.json();
        setEntity(data.entity);
        setRelations(data.relations ?? []);
        setRelatedEntities(data.graph?.entities?.filter((e: KgEntity) => e.id !== entityId) ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load entity");
      }
      setLoading(false);
    }
    if (entityId) load();
  }, [entityId]);

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="h-64 animate-pulse bg-muted rounded-lg" />
      </div>
    );
  }

  if (error || !entity) {
    return (
      <div className="container mx-auto p-6 max-w-4xl text-center">
        <h1 className="text-2xl font-bold">Entity Not Found</h1>
        <p className="text-muted-foreground mt-2">{error}</p>
        <Link href="/wiki" className="text-primary hover:underline mt-4 inline-block">
          ← Back to Wiki
        </Link>
      </div>
    );
  }

  const facts = Object.entries(entity.properties ?? {});

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Link href="/wiki" className="hover:underline">Wiki</Link>
        <span>/</span>
        <span>{entity.type}</span>
        <span>/</span>
        <span className="text-foreground font-medium truncate">{entity.name}</span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline">{entity.type}</Badge>
          <span className="text-sm text-muted-foreground">
            Confidence: {Math.round(entity.confidence * 100)}%
          </span>
        </div>
        <h1 className="text-3xl font-bold">{entity.name}</h1>
        {entity.description && (
          <p className="text-muted-foreground mt-2">{entity.description}</p>
        )}
      </div>

      {/* Provenance */}
      <div className="mb-6">
        <ProvenanceChip provenance={entity.provenance} />
      </div>

      {/* Facts Table */}
      {facts.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <h2 className="font-semibold">Facts</h2>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {facts.map(([key, value]) => (
                <div key={key} className="flex justify-between py-2 text-sm">
                  <span className="font-medium text-muted-foreground">{key}</span>
                  <span className="max-w-80 text-right truncate">
                    {typeof value === "string" ? value : JSON.stringify(value)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Relations */}
      {relations.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <h2 className="font-semibold">Relations ({relations.length})</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {relations.slice(0, 20).map((rel) => (
                <div
                  key={rel.id}
                  className="flex items-center gap-2 text-sm py-1 border-b last:border-0"
                >
                  <Badge variant="secondary" className="text-xs">
                    {rel.type}
                  </Badge>
                  <span className="text-muted-foreground">
                    {rel.from_entity_id === entity.id ? "→" : "←"}
                  </span>
                  <Link
                    href={`/wiki/${rel.from_entity_id === entity.id ? rel.to_entity_id : rel.from_entity_id}`}
                    className="hover:underline truncate"
                  >
                    {rel.from_entity_id === entity.id ? rel.to_entity_id : rel.from_entity_id}
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Related Entities */}
      {relatedEntities.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Related Entities ({relatedEntities.length})</h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {relatedEntities.slice(0, 10).map((e) => (
                <Link
                  key={e.id}
                  href={`/wiki/${e.id}`}
                  className="flex items-center gap-2 text-sm p-2 rounded hover:bg-muted transition-colors"
                >
                  <Badge variant="outline" className="text-xs shrink-0">
                    {e.type}
                  </Badge>
                  <span className="truncate">{e.name}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Back Link */}
      <div className="mt-8 text-center">
        <Link href="/wiki" className="text-sm text-muted-foreground hover:underline">
          ← Back to Knowledge Graph
        </Link>
      </div>
    </div>
  );
}
