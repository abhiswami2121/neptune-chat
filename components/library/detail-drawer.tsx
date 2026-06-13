"use client";

/**
 * DetailDrawer — Sheet drawer for viewing/editing knowledge item details.
 * PHASE C: Knowledge Files Redesign — shadcn-based enterprise design.
 *
 * Opens a Sheet from the right showing:
 *   - Header with icon + name + type badge + close button
 *   - Metadata section (domain, path, last updated)
 *   - Description / documentation content
 *   - Action buttons: Edit, Execute, Copy path
 *   - Tabbed content viewer (Raw Markdown / Preview)
 */

import {
  CopyIcon,
  ExternalLinkIcon,
  PencilIcon,
  PlayIcon,
  XIcon,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { LibraryItem, LibraryItemType } from "./library-card";

const TYPE_META: Record<LibraryItemType, { label: string; color: string }> = {
  playbook: { label: "Playbook", color: "bg-amber-400/10 text-amber-400 border-amber-400/20" },
  connector: { label: "Connector", color: "bg-cyan-400/10 text-cyan-400 border-cyan-400/20" },
  skill: { label: "Skill", color: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20" },
  function: { label: "Function", color: "bg-violet-400/10 text-violet-400 border-violet-400/20" },
  prd: { label: "PRD", color: "bg-orange-400/10 text-orange-400 border-orange-400/20" },
  wiki: { label: "Wiki", color: "bg-blue-400/10 text-blue-400 border-blue-400/20" },
  file: { label: "File", color: "bg-muted text-muted-foreground border-border" },
};

interface DetailDrawerProps {
  item: LibraryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (item: LibraryItem) => void;
  onExecute?: (item: LibraryItem) => void;
}

export function DetailDrawer({
  item,
  open,
  onOpenChange,
  onEdit,
  onExecute,
}: DetailDrawerProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  useEffect(() => {
    if (!item || !open) return;

    // Load file content for playbooks, connectors, skills
    if (item.path) {
      setLoadingContent(true);
      setContent(null);

      const endpoint = (() => {
        if (item.type === "connector") return `/api/connectors/${item.id}/playbook`;
        if (item.type === "skill") return `/api/skills/${item.name ?? item.id}`;
        if (item.type === "wiki") return `/api/wiki?path=${encodeURIComponent(item.path)}`;
        return null;
      })();

      if (endpoint) {
        fetch(endpoint)
          .then((res) => res.ok ? res.json() : null)
          .then((data) => {
            if (data) {
              setContent(
                data.rawMarkdown ?? data.documentation ?? data.content ?? JSON.stringify(data, null, 2)
              );
            }
          })
          .catch(() => setContent("Failed to load content"))
          .finally(() => setLoadingContent(false));
      } else {
        setLoadingContent(false);
        setContent(item.description ?? "No additional content available.");
      }
    } else {
      setContent(item.description ?? "No content available.");
    }
  }, [item, open]);

  if (!item) return null;

  const meta = TYPE_META[item.type] ?? TYPE_META.file;
  const formattedDate = item.updatedAt
    ? new Date(item.updatedAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const handleCopyPath = () => {
    if (item.path) {
      navigator.clipboard.writeText(item.path);
      toast.success("Path copied to clipboard");
    }
  };

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full sm:max-w-xl lg:max-w-2xl p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="px-6 py-5 border-b space-y-4">
          <div className="flex items-start gap-3">
            <div className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl border",
              meta.color
            )}>
              <ExternalLinkIcon className="size-4" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base font-semibold truncate">
                {item.name}
              </SheetTitle>
              <SheetDescription className="text-xs mt-0.5">
                <Badge className={cn("h-5 px-1.5 text-[10px] font-medium border mt-1", meta.color)} variant="outline">
                  {meta.label}
                </Badge>
              </SheetDescription>
            </div>
            <Button
              aria-label="Close"
              className="h-8 w-8"
              onClick={() => onOpenChange(false)}
              size="icon"
              variant="ghost"
            >
              <XIcon className="size-4" />
            </Button>
          </div>

          {/* Meta bar */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {item.domain && (
              <span>Domain: <span className="text-foreground font-medium">{item.domain}</span></span>
            )}
            {item.actionCount !== undefined && (
              <span>{item.actionCount} actions</span>
            )}
            {item.path && (
              <>
                <Separator className="h-3" orientation="vertical" />
                <button
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors font-mono text-[11px]"
                  onClick={handleCopyPath}
                  type="button"
                >
                  {item.path}
                  <CopyIcon className="size-3" />
                </button>
              </>
            )}
            {formattedDate && (
              <>
                <Separator className="h-3" orientation="vertical" />
                <span>{formattedDate}</span>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1">
            {onEdit && (
              <Button
                className="gap-2 h-8 text-xs"
                onClick={() => onEdit(item)}
                size="sm"
                variant="outline"
              >
                <PencilIcon className="size-3.5" />
                Edit
              </Button>
            )}
            {onExecute && (
              <Button
                className="gap-2 h-8 text-xs"
                onClick={() => onExecute(item)}
                size="sm"
              >
                <PlayIcon className="size-3.5" />
                Execute
              </Button>
            )}
            {item.path && (
              <Button
                className="gap-2 h-8 text-xs"
                onClick={handleCopyPath}
                size="sm"
                variant="ghost"
              >
                <CopyIcon className="size-3.5" />
                Copy Path
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <Tabs className="h-full flex flex-col" defaultValue="preview">
            <div className="px-6 pt-2">
              <TabsList className="h-8">
                <TabsTrigger className="text-xs h-7" value="preview">Preview</TabsTrigger>
                <TabsTrigger className="text-xs h-7" value="raw">Raw</TabsTrigger>
                <TabsTrigger className="text-xs h-7" value="meta">Metadata</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent className="flex-1 px-6 py-4 mt-0 overflow-hidden" value="preview">
              <ScrollArea className="h-full pr-4">
                {loadingContent ? (
                  <div className="space-y-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton className="h-4 w-full" key={i} style={{ width: `${80 + Math.random() * 20}%` }} />
                    ))}
                  </div>
                ) : (
                  <div className="prose prose-sm prose-zinc dark:prose-invert max-w-none">
                    {content ? (
                      <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/30 rounded-lg p-4 overflow-x-auto">
                        {content}
                      </pre>
                    ) : (
                      <p className="text-sm text-muted-foreground">{item.description ?? "No content available."}</p>
                    )}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent className="flex-1 px-6 py-4 mt-0 overflow-hidden" value="raw">
              <ScrollArea className="h-full pr-4">
                {content ? (
                  <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/30 rounded-lg p-4 overflow-x-auto">
                    {content}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground">No raw content available.</p>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent className="flex-1 px-6 py-4 mt-0 overflow-hidden" value="meta">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-3 text-sm">
                  {Object.entries({
                    ID: item.id,
                    Name: item.name,
                    Type: meta.label,
                    Domain: item.domain ?? "—",
                    Path: item.path ?? "—",
                    "Action Count": item.actionCount ?? "—",
                    "Tool Count": item.toolCount ?? "—",
                    "Last Updated": formattedDate ?? "—",
                    Category: item.category ?? "—",
                    Description: item.description ?? "—",
                  }).map(([key, value]) => (
                    <div className="flex gap-3" key={key}>
                      <span className="w-28 shrink-0 text-muted-foreground text-xs">{key}</span>
                      <span className="text-xs font-medium break-all">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
