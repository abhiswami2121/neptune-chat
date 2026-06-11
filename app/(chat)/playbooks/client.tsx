"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  FileText,
  BookOpen,
  FolderGit2,
  Brain,
  Plug,
  Wrench,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Folder,
  Loader2,
  ExternalLink,
  Search,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ── Types ──

interface TreeNode {
  id: string;
  label: string;
  type: "file" | "directory" | "link";
  path?: string;
  href?: string;
  children?: TreeNode[];
  icon?: string;
  metadata?: Record<string, any>;
}

interface PlaybookContent {
  path: string;
  frontmatter: Record<string, any>;
  content: string;
  sections: string[];
}

// ── Icon mapping ──

const ICON_MAP: Record<string, React.ReactNode> = {
  FileText: <FileText className="h-4 w-4" />,
  BookOpen: <BookOpen className="h-4 w-4" />,
  FolderGit2: <FolderGit2 className="h-4 w-4" />,
  Brain: <Brain className="h-4 w-4" />,
  Plug: <Plug className="h-4 w-4" />,
  Wrench: <Wrench className="h-4 w-4" />,
};

// ── Canonical section colors ──

const SECTION_COLORS: Record<string, string> = {
  "Operational Knowledge": "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
  "Business Context": "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800",
  "Anti-Patterns": "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
  Safeguards: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
  "Refinement Notes": "bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800",
};

const SECTION_LABELS = ["Operational Knowledge", "Business Context", "Anti-Patterns", "Safeguards", "Refinement Notes"];

// ── Main Component ──

export function PlaybooksClient() {
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [treeLoading, setTreeLoading] = useState(true);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [content, setContent] = useState<PlaybookContent | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["root", "skills-library", "org-newleaf"]));
  const [mobileTreeOpen, setMobileTreeOpen] = useState(false);

  // Fetch tree
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/playbooks");
        const data = await res.json();
        setTree(data.tree);
      } catch {
        // handle gracefully
      } finally {
        setTreeLoading(false);
      }
    })();
  }, []);

  // Load file content
  const loadContent = useCallback(async (path: string) => {
    setActiveFile(path);
    setContentLoading(true);
    setContent(null);
    try {
      const res = await fetch(`/api/playbooks?path=${encodeURIComponent(path)}`);
      if (res.ok) {
        setContent(await res.json());
      }
    } catch {
      // handle gracefully
    }
    setContentLoading(false);
  }, []);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Loading State ──
  if (treeLoading) {
    return (
      <div className="flex h-full">
        <div className="w-64 border-r p-4 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
        <div className="flex-1 p-8">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <p className="text-muted-foreground">Failed to load playbooks.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* ── Sidebar Tree (desktop) ── */}
      <div className="hidden sm:flex flex-col w-64 border-r bg-muted/20 shrink-0">
        <div className="border-b p-3">
          <h1 className="text-sm font-semibold">Playbooks</h1>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            System prompt → workspace → org → domains → skills
          </p>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2">
            <TreeRenderer
              node={tree}
              depth={0}
              expanded={expanded}
              onToggle={toggleExpand}
              activeFile={activeFile}
              onSelectFile={loadContent}
            />
          </div>
        </ScrollArea>
      </div>

      {/* ── Mobile dropdown tree ── */}
      <div className="sm:hidden w-full flex flex-col h-full">
        <div className="border-b p-3">
          <button
            onClick={() => setMobileTreeOpen(!mobileTreeOpen)}
            className="flex items-center gap-2 text-sm font-semibold w-full"
          >
            {mobileTreeOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Playbooks
          </button>
          {mobileTreeOpen && (
            <div className="mt-2 max-h-64 overflow-y-auto border rounded-lg p-2 bg-background">
              <TreeRenderer
                node={tree}
                depth={0}
                expanded={expanded}
                onToggle={toggleExpand}
                activeFile={activeFile}
                onSelectFile={(path) => {
                  loadContent(path);
                  setMobileTreeOpen(false);
                }}
              />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <ContentPanel content={content} loading={contentLoading} activeFile={activeFile} />
        </div>
      </div>

      {/* ── Desktop content panel ── */}
      <div className="hidden sm:block flex-1 overflow-y-auto">
        <ContentPanel content={content} loading={contentLoading} activeFile={activeFile} />
      </div>
    </div>
  );
}

// ── Recursive Tree Renderer ──

function TreeRenderer({
  node,
  depth,
  expanded,
  onToggle,
  activeFile,
  onSelectFile,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  activeFile: string | null;
  onSelectFile: (path: string) => void;
}) {
  const isDir = node.type === "directory";
  const isLink = node.type === "link";
  const isOpen = expanded.has(node.id);
  const isActive = activeFile === node.path;
  const iconName = node.icon;

  // Icon element
  let IconEl: React.ReactNode = null;
  if (isDir) {
    IconEl = isOpen ? (
      <FolderOpen className="h-3.5 w-3.5 text-amber-500 shrink-0" />
    ) : (
      <Folder className="h-3.5 w-3.5 text-amber-500 shrink-0" />
    );
  } else if (isLink) {
    IconEl = <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  } else if (iconName && ICON_MAP[iconName]) {
    IconEl = ICON_MAP[iconName];
  } else {
    IconEl = <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  }

  const handleClick = () => {
    if (isDir) {
      onToggle(node.id);
    } else if (isLink) {
      // Links are handled by Next Link
    } else if (node.path) {
      onSelectFile(node.path);
    }
  };

  const content = (
    <div
      className={cn(
        "flex items-center gap-1.5 px-1.5 py-1 rounded text-sm cursor-pointer transition-colors",
        "hover:bg-muted",
        isActive && "bg-primary/10 text-primary font-medium",
        !isDir && !isLink && "pl-[calc(0.375rem+1.25rem*var(--depth))]",
      )}
      style={{ "--depth": depth } as React.CSSProperties}
      onClick={handleClick}
    >
      {isDir && (isOpen ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />)}
      {IconEl}
      <span className="truncate text-xs">{node.label}</span>
      {node.metadata?.description && (
        <span className="hidden xl:inline text-[10px] text-muted-foreground truncate ml-auto">
          {node.metadata.description.length > 30
            ? node.metadata.description.slice(0, 30) + "…"
            : node.metadata.description}
        </span>
      )}
    </div>
  );

  return (
    <div>
      {isLink ? <Link href={node.href!} className="no-underline">{content}</Link> : content}
      {isDir && isOpen && node.children && (
        <div className="ml-1">
          {node.children.map((child) => (
            <TreeRenderer
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              activeFile={activeFile}
              onSelectFile={onSelectFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Content Panel ──

function ContentPanel({
  content,
  loading,
  activeFile,
}: {
  content: PlaybookContent | null;
  loading: boolean;
  activeFile: string | null;
}) {
  if (!activeFile) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-center">
        <div>
          <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Select a playbook from the tree</p>
          <p className="text-xs text-muted-foreground mt-1">
            Browse the hierarchical structure: System Prompt → Workspace → Organizations → Domains
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-96 w-full mt-4" />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <p className="text-sm text-destructive">Failed to load playbook content.</p>
      </div>
    );
  }

  const sections = content.sections || [content.content];

  return (
    <div className="p-4 sm:p-6 max-w-3xl">
      {/* Frontmatter */}
      {content.frontmatter && Object.keys(content.frontmatter).length > 0 && (
        <div className="mb-6 p-3 rounded-lg border bg-muted/30">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono">
            {Object.entries(content.frontmatter).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1">
                <span className="text-muted-foreground">{k}:</span>
                <span className="font-medium">
                  {Array.isArray(v) ? v.join(", ") : String(v)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content sections with color-coded highlights */}
      {sections.map((section, idx) => {
        const headingMatch = section.match(/^([^\n]+)/);
        const heading = headingMatch ? headingMatch[1].replace(/^#+\s*/, "").trim() : `Section ${idx + 1}`;
        const sectionBody = headingMatch ? section.slice(headingMatch[0].length).trim() : section;
        const isCanonical = SECTION_LABELS.some((l) => heading.includes(l));
        const colorClass = Object.entries(SECTION_COLORS).find(([k]) => heading.includes(k))?.[1];

        return (
          <div
            key={idx}
            className={cn(
              "mb-4 rounded-lg border p-4",
              isCanonical ? (colorClass || "bg-card border-border") : "bg-card border-border"
            )}
          >
            <h3 className="text-sm font-semibold mb-2 pb-1 border-b">{heading}</h3>
            <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed whitespace-pre-wrap">
              {sectionBody || "…"}
            </div>
          </div>
        );
      })}

      {/* Refinement Notes */}
      {content.frontmatter?.version && (
        <div className="mt-6 pt-4 border-t text-xs text-muted-foreground">
          <span>Version: {content.frontmatter.version}</span>
          {content.frontmatter.scope && (
            <span className="ml-3">Scope: {content.frontmatter.scope}</span>
          )}
        </div>
      )}
    </div>
  );
}
