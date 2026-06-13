"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { KgEntity } from "@/lib/knowledge/types";

const TYPE_COLORS: Record<string, string> = {
  Connector: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  Skill: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  Workflow: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  Domain: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  Pattern: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  Cardinal: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  Concept: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  Session: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  Lesson: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

export function EntityCard({ entity }: { entity: KgEntity }) {
  const badgeColor = TYPE_COLORS[entity.type] ?? TYPE_COLORS.Concept;

  return (
    <Link href={`/wiki/${entity.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <Badge className={badgeColor} variant="outline">
              {entity.type}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {Math.round(entity.confidence * 100)}%
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <h3 className="font-semibold text-sm truncate">{entity.name}</h3>
          {entity.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {entity.description}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
