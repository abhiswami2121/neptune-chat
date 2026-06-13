"use client";

/**
 * LibraryTable — DataTable alternative view for knowledge items.
 * PHASE C: Knowledge Files Redesign — shadcn-based enterprise design.
 *
 * Features:
 *   - Sortable columns (click header)
 *   - Type badge with color coding
 *   - Action count + tool count columns
 *   - Last updated column
 *   - Row click → view detail
 *   - Skeleton loading state
 */

import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowUpDownIcon,
  ExternalLinkIcon,
} from "lucide-react";
import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { LibraryItem, LibraryItemType } from "./library-card";
import { EmptyState } from "./empty-state";

const TYPE_META: Record<LibraryItemType, { label: string; color: string }> = {
  playbook: { label: "Playbook", color: "bg-amber-400/10 text-amber-400 border-amber-400/20" },
  connector: { label: "Connector", color: "bg-cyan-400/10 text-cyan-400 border-cyan-400/20" },
  skill: { label: "Skill", color: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20" },
  function: { label: "Function", color: "bg-violet-400/10 text-violet-400 border-violet-400/20" },
  prd: { label: "PRD", color: "bg-orange-400/10 text-orange-400 border-orange-400/20" },
  wiki: { label: "Wiki", color: "bg-blue-400/10 text-blue-400 border-blue-400/20" },
  file: { label: "File", color: "bg-muted text-muted-foreground border-border" },
};

type SortField = "name" | "type" | "actionCount" | "updatedAt";
type SortDir = "asc" | "desc";

interface LibraryTableProps {
  items: LibraryItem[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onView?: (item: LibraryItem) => void;
  className?: string;
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div className="flex items-center gap-4 px-4 py-3" key={i}>
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-24 ml-auto" />
        </div>
      ))}
    </div>
  );
}

export function LibraryTable({
  items,
  loading = false,
  error = null,
  onRetry,
  onView,
  className,
}: LibraryTableProps) {
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const sortedItems = [...items].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortField) {
      case "name":
        return dir * a.name.localeCompare(b.name);
      case "type":
        return dir * a.type.localeCompare(b.type);
      case "actionCount":
        return dir * ((a.actionCount ?? 0) - (b.actionCount ?? 0));
      case "updatedAt":
        return dir * ((a.updatedAt ?? "").localeCompare(b.updatedAt ?? ""));
      default:
        return 0;
    }
  });

  if (loading) return <TableSkeleton />;
  if (error) return <EmptyState actionLabel="Retry" description={error} onAction={onRetry} title="Failed to load" variant="error" />;
  if (items.length === 0) return <EmptyState variant="empty" />;

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDownIcon className="size-3 ml-1 text-muted-foreground/40" />;
    return sortDir === "asc"
      ? <ArrowUpIcon className="size-3 ml-1" />
      : <ArrowDownIcon className="size-3 ml-1" />;
  };

  return (
    <div className={cn("rounded-lg border", className)}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[40%]">
              <button
                className="flex items-center text-xs font-medium hover:text-foreground transition-colors"
                onClick={() => handleSort("name")}
                type="button"
              >
                Name
                <SortIcon field="name" />
              </button>
            </TableHead>
            <TableHead className="w-[15%]">
              <button
                className="flex items-center text-xs font-medium hover:text-foreground transition-colors"
                onClick={() => handleSort("type")}
                type="button"
              >
                Type
                <SortIcon field="type" />
              </button>
            </TableHead>
            <TableHead className="w-[15%] text-right">
              <button
                className="flex items-center justify-end text-xs font-medium hover:text-foreground transition-colors ml-auto"
                onClick={() => handleSort("actionCount")}
                type="button"
              >
                Actions
                <SortIcon field="actionCount" />
              </button>
            </TableHead>
            <TableHead className="w-[20%] text-right">
              <button
                className="flex items-center justify-end text-xs font-medium hover:text-foreground transition-colors ml-auto"
                onClick={() => handleSort("updatedAt")}
                type="button"
              >
                Updated
                <SortIcon field="updatedAt" />
              </button>
            </TableHead>
            <TableHead className="w-[10%]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedItems.map((item) => {
            const typeMeta = TYPE_META[item.type] ?? TYPE_META.file;
            const formattedDate = item.updatedAt
              ? new Date(item.updatedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              : "—";

            return (
              <TableRow
                className="cursor-pointer transition-colors hover:bg-muted/40"
                key={item.id}
                onClick={() => onView?.(item)}
              >
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{item.name}</span>
                    {item.domain && (
                      <span className="text-[11px] text-muted-foreground">
                        {item.domain}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={cn("h-5 px-1.5 text-[10px] font-medium border", typeMeta.color)} variant="outline">
                    {typeMeta.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                  {item.actionCount ?? item.toolCount ?? "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                  {formattedDate}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    aria-label={`View ${item.name}`}
                    className="h-7 w-7"
                    onClick={(e) => { e.stopPropagation(); onView?.(item); }}
                    size="icon"
                    variant="ghost"
                  >
                    <ExternalLinkIcon className="size-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
