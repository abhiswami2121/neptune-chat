"use client";

/**
 * FileTreeNav — Recursive tree view of playbooks, connectors, and skills.
 *
 * U2.2 Progressive Disclosure — Visual file tree side menu.
 * Uses shadcn/ui Collapsible primitive.
 *
 * Props:
 *   root: "playbooks" | "connectors" | "skills"
 *   collapsed: boolean — sidebar collapsed state (shows only icons when true)
 */

import {
  BookOpen,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Plug,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface FileTreeNode {
  name: string;
  type: "directory" | "file";
  path: string;
  children?: FileTreeNode[];
  description?: string;
  icon?: string;
}

interface FileTreeResponse {
  root: string;
  tree: FileTreeNode;
  total: number;
}

interface FileTreeNavProps {
  root: "playbooks" | "connectors" | "skills";
  collapsed?: boolean;
  className?: string;
}

// ── Icon mapping ─────────────────────────────────────────────────────────────

function getIcon(iconHint?: string, isOpen?: boolean) {
  switch (iconHint) {
    case "book":
      return <BookOpen size={16} />;
    case "plug":
      return <Plug size={16} />;
    case "sparkles":
      return <Sparkles size={16} />;
    case "folder":
      return isOpen ? <FolderOpen size={16} /> : <Folder size={16} />;
    default:
      return <FileText size={16} />;
  }
}

// ── Loading skeleton ─────────────────────────────────────────────────────────

function TreeSkeleton({ depth = 0 }: { depth?: number }) {
  return (
    <div className={cn("space-y-1 py-1", depth > 0 && "ml-4")}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 px-2 py-1.5">
          <Skeleton className="h-3 w-3 rounded" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

// ── Recursive TreeNode ───────────────────────────────────────────────────────

function TreeNode({
  node,
  collapsed: sidebarCollapsed,
  depth = 0,
}: {
  node: FileTreeNode;
  collapsed: boolean;
  depth?: number;
}) {
  const [open, setOpen] = useState(false);
  const isDirectory = node.type === "directory";
  const hasChildren = node.children && node.children.length > 0;

  // Format display name: strip extensions and make human-readable
  const displayName = node.type === "file"
    ? node.name.replace(/\.(md|mdx)$/, "").replace(/^playbook-/, "").replace(/-/g, " ")
    : node.name.replace(/-/g, " ");

  // If sidebar is collapsed, only show root-level icons
  if (sidebarCollapsed && depth > 0) return null;

  if (isDirectory && hasChildren) {
    return (
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger
          className={cn(
            "flex items-center gap-2 w-full px-2 py-1.5 text-left rounded-md text-sm",
            "hover:bg-muted/50 transition-colors group",
            "min-h-[44px]", // 44px touch target
            sidebarCollapsed && "justify-center px-0"
          )}
        >
          <ChevronRight
            size={14}
            className={cn(
              "shrink-0 transition-transform text-muted-foreground",
              open && "rotate-90"
            )}
          />
          <span className={cn("shrink-0 text-muted-foreground group-hover:text-foreground transition-colors")}>
            {getIcon(node.icon, open)}
          </span>
          {!sidebarCollapsed && (
            <span className="font-medium truncate capitalize">{displayName}</span>
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className={cn("ml-3 border-l border-border/50 pl-2")}>
            {node.children!.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                collapsed={sidebarCollapsed}
                depth={depth + 1}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  // Leaf file node — clickable link
  const href = `/library/${node.path}`;

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm",
        "hover:bg-muted/50 transition-colors group",
        "min-h-[44px]", // 44px touch target
        sidebarCollapsed && "justify-center px-0",
        depth > 0 && "ml-4"
      )}
      title={node.description || displayName}
    >
      <span className={cn("shrink-0 text-muted-foreground group-hover:text-foreground transition-colors")}>
        {getIcon(node.icon)}
      </span>
      {!sidebarCollapsed && (
        <div className="flex flex-col min-w-0">
          <span className="truncate capitalize">{displayName}</span>
          {node.description && (
            <span className="text-[10px] text-muted-foreground truncate">
              {node.description.slice(0, 60)}
            </span>
          )}
        </div>
      )}
    </Link>
  );

  // Empty directory — render as simple item
  return null;
}

// ── Main FileTreeNav Component ───────────────────────────────────────────────

export function FileTreeNav({ root, collapsed = false, className }: FileTreeNavProps) {
  const [tree, setTree] = useState<FileTreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchTree() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/file-tree?root=${root}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: FileTreeResponse = await res.json();
        if (!cancelled) setTree(data.tree);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchTree();
    return () => { cancelled = true; };
  }, [root]);

  if (loading) {
    return (
      <div className={cn("py-1", className)}>
        {!collapsed && (
          <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {root}
          </div>
        )}
        <TreeSkeleton />
        <TreeSkeleton depth={1} />
      </div>
    );
  }

  if (error || !tree) {
    return (
      <div className={cn("py-1", className)}>
        {!collapsed && (
          <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {root}
          </div>
        )}
        <div className="px-2 py-1 text-xs text-muted-foreground">
          {error ? `⚠ ${error}` : "Empty"}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("py-1", className)} data-tree-root={root}>
      {!collapsed && (
        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {tree.name}
        </div>
      )}
      {tree.children?.map((child) => (
        <TreeNode
          key={child.path}
          node={child}
          collapsed={collapsed}
          depth={0}
        />
      ))}
    </div>
  );
}

export default FileTreeNav;
