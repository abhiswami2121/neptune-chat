"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { KgEntity } from "@/lib/knowledge/types";

export default function RecentPage() {
  const [entities, setEntities] = useState<KgEntity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/wiki/search?q=*&limit=50");
        const data = await res.json();
        setEntities(
          (data.entities ?? []).sort(
            (a: KgEntity, b: KgEntity) =>
              new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          )
        );
      } catch {
        setEntities([]);
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <div className="mb-6">
        <Link href="/wiki" className="text-sm text-muted-foreground hover:underline">
          ← Back to Wiki
        </Link>
        <h1 className="text-2xl font-bold mt-2">Recently Learned</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Entities recently added or updated in the knowledge graph
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={`skel-${i}`} className="h-16 animate-pulse bg-muted rounded-lg" />
          ))}
        </div>
      ) : entities.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p>No entities yet — knowledge grows as lessons are learned</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entities.slice(0, 30).map((entity) => (
            <Link
              key={entity.id}
              href={`/wiki/${entity.id}`}
              className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className="shrink-0 text-xs">
                    {entity.type}
                  </Badge>
                  <span className="font-medium truncate">{entity.name}</span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(entity.updated_at).toLocaleDateString()}
                </span>
              </div>
              {entity.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                  {entity.description}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
