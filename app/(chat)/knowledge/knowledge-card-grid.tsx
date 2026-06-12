"use client";

import { useState, useMemo } from "react";
import {
  Search,
  FileText,
  Brain,
  BookOpen,
  Calendar,
  Tag,
  ExternalLink,
  Clock,
  Star,
  Grid3X3,
  List,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ---- Types ----

interface KnowledgeItem {
  id: string;
  title: string;
  description: string;
  category: "prd" | "memory" | "playbook" | "skill" | "doc";
  tags: string[];
  updatedAt: string;
  size?: string;
  starred?: boolean;
}

// ---- Mock data (real data would come from API / KG) ----

const MOCK_KNOWLEDGE: KnowledgeItem[] = [
  {
    id: "prd-hermes-ai-computer",
    title: "Hermès AI Computer — Full PRD & Phase Plan",
    description: "Canonical PRD and phased roadmap for Hermès as NewLeaf's premium mobile-first AI computer.",
    category: "prd",
    tags: ["hermes", "ai-computer", "roadmap", "p0"],
    updatedAt: "2026-06-10",
    starred: true,
  },
  {
    id: "prd-base44-two-lane",
    title: "Base44 Two-Lane Workflow — MCP Editor vs CLI Sandbox",
    description: "Jarvis's canonical deploy architecture with MCP direct path and CLI sandbox path.",
    category: "prd",
    tags: ["base44", "mcp", "sandbox", "deploy"],
    updatedAt: "2026-06-09",
    starred: true,
  },
  {
    id: "prd-nmi-golden-vault",
    title: "NMI Golden Vault Architecture",
    description: "How NewLeaf stores cards and charges recurring payments via NMI customer vault.",
    category: "prd",
    tags: ["nmi", "billing", "vault", "payments"],
    updatedAt: "2026-06-08",
  },
  {
    id: "prd-smart-retry",
    title: "Smart Retry Engine",
    description: "15-minute scheduled retry job that recovers soft declines with intelligent routing.",
    category: "prd",
    tags: ["billing", "retry", "recovery"],
    updatedAt: "2026-06-07",
  },
  {
    id: "mem-session-5e07",
    title: "Session 5e078595e981 — Auth Gate + Sidebar Overhaul",
    description: "Running session: implementing allowlist gate and enterprise sidebar for Neptune.",
    category: "memory",
    tags: ["session", "auth", "sidebar", "active"],
    updatedAt: "2026-06-12",
  },
  {
    id: "mem-jarvis-operating-rules",
    title: "Jarvis Operating Rules",
    description: "Non-negotiable rules for Kimi Jarvis — approval gates, banned operations, propose-then-approve pattern.",
    category: "memory",
    tags: ["jarvis", "rules", "governance"],
    updatedAt: "2026-06-11",
    starred: true,
  },
  {
    id: "playbook-billing-flow",
    title: "Billing Flow Playbook (P0)",
    description: "Domain playbook for billing operations — NMI transactions, recovery wizards, payment retry logic.",
    category: "playbook",
    tags: ["billing", "p0", "nmi", "payments"],
    updatedAt: "2026-06-10",
  },
  {
    id: "playbook-credit-disputes",
    title: "Credit Disputes Playbook (P0)",
    description: "Domain playbook for credit dispute processing — dispute rounds, credit reports, negative items.",
    category: "playbook",
    tags: ["disputes", "p0", "credit", "compliance"],
    updatedAt: "2026-06-09",
  },
  {
    id: "skill-author",
    title: "Skill Author — Wrap API Endpoints into Tools",
    description: "Autonomous skill authoring for wrapping API endpoints into tool definitions with playbooks.",
    category: "skill",
    tags: ["authoring", "tools", "api", "automation"],
    updatedAt: "2026-06-08",
  },
  {
    id: "doc-nmi-cvv-225",
    title: "NMI CVV 225 Recovery Wizard Fix (2026-05-05)",
    description: "P0 production fix for recovery wizard billing link failures with NMI code 225 'Invalid CVV'.",
    category: "doc",
    tags: ["nmi", "cvv", "fix", "p0", "production"],
    updatedAt: "2026-05-05",
  },
  {
    id: "prd-neptune-u3",
    title: "Neptune U3 Enhancement — Full Specification",
    description: "Complete U3 orchestration upgrade spec covering connectors, workflows, steering, and telemetry.",
    category: "prd",
    tags: ["neptune", "u3", "orchestration", "spec"],
    updatedAt: "2026-06-12",
    starred: true,
  },
  {
    id: "mem-agent-roster",
    title: "Agent Roster & Specializations",
    description: "Complete list of NewLeaf agents — what each specializes in, routing rules, skill matrix.",
    category: "memory",
    tags: ["agents", "roster", "routing"],
    updatedAt: "2026-06-06",
  },
];

// ---- Category config ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ComponentType<any>; color: string }> = {
  prd: { label: "PRD", icon: FileText, color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30" },
  memory: { label: "Memory", icon: Brain, color: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30" },
  playbook: { label: "Playbook", icon: BookOpen, color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30" },
  skill: { label: "Skill", icon: Star, color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30" },
  doc: { label: "Doc", icon: FileText, color: "text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/30" },
};

// ---- Component ----

export function KnowledgeCardGrid() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const filtered = useMemo(() => {
    let items = MOCK_KNOWLEDGE;
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (categoryFilter) {
      items = items.filter((item) => item.category === categoryFilter);
    }
    return items;
  }, [search, categoryFilter]);

  const categories = useMemo(() => {
    const counts: Record<string, number> = {};
    MOCK_KNOWLEDGE.forEach((item) => {
      counts[item.category] = (counts[item.category] || 0) + 1;
    });
    return Object.entries(counts).sort(([, a], [, b]) => b - a);
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search knowledge…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {/* View toggle */}
          <button
            onClick={() => setViewMode("grid")}
            className={cn(
              "p-2 rounded-lg border text-muted-foreground hover:bg-muted transition-colors",
              viewMode === "grid" && "bg-muted text-foreground border-primary/30"
            )}
            aria-label="Grid view"
          >
            <Grid3X3 size={14} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "p-2 rounded-lg border text-muted-foreground hover:bg-muted transition-colors",
              viewMode === "list" && "bg-muted text-foreground border-primary/30"
            )}
            aria-label="List view"
          >
            <List size={14} />
          </button>
        </div>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setCategoryFilter(null)}
          className={cn(
            "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
            !categoryFilter
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background text-muted-foreground hover:bg-muted border-border"
          )}
        >
          All ({MOCK_KNOWLEDGE.length})
        </button>
        {categories.map(([cat, count]) => {
          const cfg = CATEGORY_CONFIG[cat];
          const Icon = cfg?.icon || FileText;
          return (
            <button
              key={cat}
              onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                categoryFilter === cat
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground hover:bg-muted border-border"
              )}
            >
              <Icon size={12} />
              {cfg?.label || cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        {filtered.length} item{filtered.length !== 1 ? "s" : ""}
        {search && ` matching "${search}"`}
      </p>

      {/* Card Grid / List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search size={32} className="text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No knowledge items found.</p>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-xs text-primary hover:underline mt-1"
            >
              Clear search
            </button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((item) => (
            <KnowledgeCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <KnowledgeRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Card ----

function KnowledgeCard({ item }: { item: KnowledgeItem }) {
  const cfg = CATEGORY_CONFIG[item.category];
  const Icon = cfg?.icon || FileText;

  return (
    <div className="group relative rounded-xl border bg-card hover:shadow-md hover:border-primary/20 transition-all duration-200 flex flex-col">
      {/* Card header */}
      <div className="p-4 pb-2 flex items-start justify-between gap-2">
        <div className={cn("flex size-8 items-center justify-center rounded-lg shrink-0", cfg.color)}>
          <Icon size={15} />
        </div>
        <div className="flex items-center gap-1">
          {item.starred && <Star size={12} className="text-amber-500 fill-amber-500" />}
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Card body */}
      <div className="px-4 pb-3 flex-1">
        <h3 className="font-medium text-sm leading-snug mb-1 line-clamp-2">
          {item.title}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
          {item.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {item.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground font-medium"
            >
              {tag}
            </span>
          ))}
          {item.tags.length > 3 && (
            <span className="text-[10px] text-muted-foreground">+{item.tags.length - 3}</span>
          )}
        </div>
      </div>

      {/* Card footer */}
      <div className="px-4 py-2.5 border-t bg-muted/30 flex items-center justify-between rounded-b-xl">
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <Calendar size={10} />
          {item.updatedAt}
        </span>
        <button
          className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label={`Open ${item.title}`}
        >
          <ExternalLink size={10} />
          Open
        </button>
      </div>
    </div>
  );
}

// ---- Row (list view) ----

function KnowledgeRow({ item }: { item: KnowledgeItem }) {
  const cfg = CATEGORY_CONFIG[item.category];
  const Icon = cfg?.icon || FileText;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
      <div className={cn("flex size-8 items-center justify-center rounded-lg shrink-0", cfg.color)}>
        <Icon size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium truncate">{item.title}</h4>
          {item.starred && <Star size={10} className="text-amber-500 fill-amber-500 shrink-0" />}
        </div>
        <p className="text-xs text-muted-foreground truncate">{item.description}</p>
      </div>
      <div className="hidden sm:flex flex-wrap gap-1 shrink-0">
        {item.tags.slice(0, 2).map((tag) => (
          <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">
            {tag}
          </span>
        ))}
      </div>
      <span className="text-[10px] text-muted-foreground shrink-0 hidden md:inline-flex items-center gap-1">
        <Clock size={10} />
        {item.updatedAt}
      </span>
    </div>
  );
}
