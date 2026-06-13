/**
 * WorkflowList — Browseable list of all workflow definitions.
 *
 * U3.6 Workflow Engine — Shows 5 starter YAML workflows + user-created ones.
 * Supports: search, category filter, status badges, quick-run button.
 */

"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Play,
  Clock,
  Zap,
  Brain,
  GitBranch,
  ArrowUpFromLine,
  Shuffle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WorkflowDefinition } from "@/lib/workflow/types";
import { BUILTIN_TEMPLATES } from "@/lib/workflow/templates";

const CATEGORY_COLORS: Record<string, string> = {
  Operations: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  Finance: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  CRM: "bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800",
  Communication: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  Engineering: "bg-slate-50 dark:bg-slate-950/30 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NODE_ICONS: Record<string, React.ComponentType<any>> = {
  trigger: Zap,
  action: Play,
  ai: Brain,
  conditional: GitBranch,
  parallel: GitBranch,
  transform: Shuffle,
  output: ArrowUpFromLine,
};

interface WorkflowListProps {
  onSelectWorkflow?: (wf: WorkflowDefinition) => void;
  onRunWorkflow?: (wf: WorkflowDefinition) => void;
  className?: string;
}

export default function WorkflowList({
  onSelectWorkflow,
  onRunWorkflow,
  className,
}: WorkflowListProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const workflows = BUILTIN_TEMPLATES as WorkflowDefinition[];

  const filtered = useMemo(() => {
    let items = workflows;
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (w) =>
          w.name.toLowerCase().includes(q) ||
          w.description.toLowerCase().includes(q) ||
          w.category.toLowerCase().includes(q)
      );
    }
    if (categoryFilter) {
      items = items.filter((w) => w.category === categoryFilter);
    }
    return items;
  }, [search, categoryFilter, workflows]);

  const categories = useMemo(() => {
    const counts: Record<string, number> = {};
    workflows.forEach((w) => {
      counts[w.category] = (counts[w.category] || 0) + 1;
    });
    return Object.entries(counts).sort(([, a], [, b]) => b - a);
  }, [workflows]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search workflows…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setCategoryFilter(null)}
          className={cn(
            "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
            !categoryFilter
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background text-muted-foreground hover:bg-muted border-border"
          )}
        >
          All ({workflows.length})
        </button>
        {categories.map(([cat, count]) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
              categoryFilter === cat
                ? "bg-primary text-primary-foreground border-primary"
                : cn(
                    "bg-background text-muted-foreground hover:bg-muted border-border",
                    CATEGORY_COLORS[cat]
                  )
            )}
          >
            {cat} ({count})
          </button>
        ))}
      </div>

      {/* Workflow cards */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No workflows match your search.
          </p>
        )}
        {filtered.map((wf) => {
          const nodeCount = wf.nodes?.length || 0;
          const nodeTypes = [
            ...new Set((wf.nodes || []).map((n) => n.data?.nodeType).filter(Boolean)),
          ];
          const catColor = CATEGORY_COLORS[wf.category] || CATEGORY_COLORS.Operations;

          return (
            <div
              key={wf.id}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors cursor-pointer"
              onClick={() => onSelectWorkflow?.(wf)}
            >
              {/* Node type icons */}
              <div className="flex items-center gap-0.5 shrink-0">
                {nodeTypes.slice(0, 4).map((type) => {
                  const Icon = NODE_ICONS[type as string];
                  if (!Icon) return null;
                  return (
                    <div
                      key={type}
                      className="flex size-5 items-center justify-center rounded bg-muted"
                      title={type}
                    >
                      <Icon size={10} className="text-muted-foreground" />
                    </div>
                  );
                })}
                {nodeTypes.length > 4 && (
                  <span className="text-[9px] text-muted-foreground ml-0.5">
                    +{nodeTypes.length - 4}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium truncate">{wf.name}</h4>
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium border shrink-0", catColor)}>
                    {wf.category}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {wf.description}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock size={9} />
                    {nodeCount} node{nodeCount !== 1 ? "s" : ""}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {wf.source === "agent" ? "AI-generated" : "Template"}
                  </span>
                </div>
              </div>

              {/* Run button */}
              {onRunWorkflow && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRunWorkflow(wf);
                  }}
                  title="Run workflow"
                >
                  <Play size={12} />
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
