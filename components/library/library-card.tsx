"use client";

/**
 * LibraryCard — Card component for knowledge items.
 * PHASE C: Knowledge Files Redesign — shadcn-based enterprise design.
 *
 * Renders a card with:
 *   - Icon (based on type)
 *   - Name (title)
 *   - Type badge
 *   - Action/tool count
 *   - Last updated timestamp
 *   - Quick actions (View, Edit, Execute)
 */

import {
  BookOpenIcon,
  BotIcon,
  Code2Icon,
  ExternalLinkIcon,
  FileTextIcon,
  FolderGit2Icon,
  FunctionSquareIcon,
  MoreHorizontalIcon,
  PlayIcon,
  PlugIcon,
  PencilIcon,
  TargetIcon,
  ZapIcon,
} from "lucide-react";
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type LibraryItemType =
  | "playbook"
  | "connector"
  | "skill"
  | "function"
  | "prd"
  | "wiki"
  | "file";

const TYPE_META: Record<LibraryItemType, { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
  playbook: { icon: FolderGit2Icon, label: "Playbook", color: "bg-amber-400/10 text-amber-400 border-amber-400/20" },
  connector: { icon: PlugIcon, label: "Connector", color: "bg-cyan-400/10 text-cyan-400 border-cyan-400/20" },
  skill: { icon: TargetIcon, label: "Skill", color: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20" },
  function: { icon: FunctionSquareIcon, label: "Function", color: "bg-violet-400/10 text-violet-400 border-violet-400/20" },
  prd: { icon: BookOpenIcon, label: "PRD", color: "bg-orange-400/10 text-orange-400 border-orange-400/20" },
  wiki: { icon: FileTextIcon, label: "Wiki", color: "bg-blue-400/10 text-blue-400 border-blue-400/20" },
  file: { icon: FileTextIcon, label: "File", color: "bg-muted text-muted-foreground border-border" },
};

export interface LibraryItem {
  id: string;
  name: string;
  type: LibraryItemType;
  description?: string;
  path?: string;
  actionCount?: number;
  toolCount?: number;
  updatedAt?: string;
  category?: string;
  domain?: string;
}

interface LibraryCardProps {
  item: LibraryItem;
  onView?: (item: LibraryItem) => void;
  onEdit?: (item: LibraryItem) => void;
  onExecute?: (item: LibraryItem) => void;
  className?: string;
}

export function LibraryCard({
  item,
  onView,
  onEdit,
  onExecute,
  className,
}: LibraryCardProps) {
  const meta = TYPE_META[item.type] ?? TYPE_META.file;
  const Icon = meta.icon;
  const formattedDate = item.updatedAt
    ? new Date(item.updatedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-200",
        "hover:shadow-[var(--shadow-float)] hover:border-border/60",
        "cursor-pointer",
        className
      )}
      onClick={() => onView?.(item)}
    >
      <CardContent className="p-4">
        {/* Top row: Icon + Type badge + Actions */}
        <div className="flex items-start justify-between gap-2">
          <div className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg border",
            meta.color
          )}>
            <Icon className="size-4" />
          </div>

          <div className="flex items-center gap-1.5">
            <Badge className={cn("h-5 px-1.5 text-[10px] font-medium border", meta.color)} variant="outline">
              {meta.label}
            </Badge>

            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  aria-label="More actions"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  size="icon"
                  variant="ghost"
                >
                  <MoreHorizontalIcon className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView?.(item); }}>
                  <ExternalLinkIcon className="size-3.5 mr-2" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit?.(item); }}>
                  <PencilIcon className="size-3.5 mr-2" />
                  Edit
                </DropdownMenuItem>
                {onExecute && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onExecute(item); }}>
                      <PlayIcon className="size-3.5 mr-2" />
                      Execute
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Name + Description */}
        <div className="mt-3">
          <h3 className="text-sm font-semibold leading-tight truncate">
            {item.name}
          </h3>
          {item.description && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {item.description}
            </p>
          )}
        </div>

        {/* Footer: Count + Date */}
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            {item.actionCount !== undefined && item.actionCount > 0 && (
              <span className="flex items-center gap-1">
                <ZapIcon className="size-3" />
                {item.actionCount} {item.actionCount === 1 ? "action" : "actions"}
              </span>
            )}
            {item.toolCount !== undefined && item.toolCount > 0 && (
              <span className="flex items-center gap-1">
                <Code2Icon className="size-3" />
                {item.toolCount} {item.toolCount === 1 ? "tool" : "tools"}
              </span>
            )}
            {item.domain && (
              <span className="flex items-center gap-1">
                <BotIcon className="size-3" />
                {item.domain}
              </span>
            )}
          </div>
          {formattedDate && (
            <span className="tabular-nums">{formattedDate}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
