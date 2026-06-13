"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EntityCard } from "@/components/wiki/entity-card";
import type { KgEntity } from "@/lib/knowledge/types";
import { ENTITY_TYPES } from "@/lib/knowledge/types";

export default function WikiPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [entities, setEntities] = useState<KgEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/wiki/search?q=${encodeURIComponent(query || "*")}&limit=50`
        );
        const data = await res.json();
        let results = data.entities ?? [];
        if (selectedType) {
          results = results.filter((e: KgEntity) => e.type === selectedType);
        }
        setEntities(results);
      } catch {
        setEntities([]);
      }
      setLoading(false);
    }
    loadAll();
  }, [query, selectedType]);

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Top Nav */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">🧠 Knowledge Graph Wiki</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse what Neptune knows — Playbooks (HOW) + KG (WHAT) + Raw Logs (WHEN)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push("/wiki/recent")}
            className="text-sm px-3 py-1.5 rounded-md border hover:bg-muted transition-colors"
          >
            Recent
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <kbd className="absolute right-3 top-2.5 text-xs text-muted-foreground border rounded px-1.5 py-0.5">
          ⌘K
        </kbd>
        <Input
          placeholder="Search the knowledge graph... (try 'billing', 'cardinal', 'deploy')"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full"
        />
      </div>

      {/* Type Filter Sidebar + Main Grid */}
      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-48 shrink-0 hidden md:block">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
            Entity Types
          </h3>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setSelectedType(null)}
              className={`w-full text-left text-sm px-2 py-1 rounded ${
                !selectedType ? "bg-primary/10 font-medium" : "hover:bg-muted"
              }`}
            >
              All Types
            </button>
            {ENTITY_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedType(type)}
                className={`w-full text-left text-sm px-2 py-1 rounded ${
                  selectedType === type ? "bg-primary/10 font-medium" : "hover:bg-muted"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Main Grid */}
        <div className="flex-1">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={`skel-${i}`}
                  className="h-32 animate-pulse bg-muted rounded-lg"
                />
              ))}
            </div>
          ) : entities.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <p className="text-lg font-medium">No entities found</p>
              <p className="text-sm mt-2">
                {query
                  ? `No results for "${query}"`
                  : "The knowledge graph is empty. Entities will appear as lessons are learned."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {entities.map((entity) => (
                <EntityCard key={entity.id} entity={entity} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
