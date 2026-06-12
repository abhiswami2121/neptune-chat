"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Search,
  Wrench,
  Plug,
  BookOpen,
  Target,
  Zap,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Types
interface CapabilityItem {
  name: string;
  category: string;
  description: string;
  status: "connected" | "configured" | "disconnected" | "active" | "draft";
  actionCount: number;
  icon?: string;
}

interface CapabilitiesTree {
  tools: CapabilityItem[];
  connectors: CapabilityItem[];
  playbooks: CapabilityItem[];
  skills: CapabilityItem[];
  workflows: CapabilityItem[];
  summary: {
    totalTools: number;
    totalConnectors: number;
    connectedConnectors: number;
    totalPlaybooks: number;
    totalSkills: number;
    totalWorkflows: number;
    totalActions: number;
  };
}

const SECTION_CONFIG = {
  tools: { label: "Gatekeeper Tools", icon: Wrench, color: "blue" },
  connectors: { label: "Connectors", icon: Plug, color: "emerald" },
  playbooks: { label: "Playbooks", icon: BookOpen, color: "violet" },
  skills: { label: "Skills", icon: Target, color: "amber" },
  workflows: { label: "Workflows", icon: Zap, color: "rose" },
} as const;

const STATUS_ICON: Record<string, React.ComponentType<any>> = {
  connected: CheckCircle2,
  active: CheckCircle2,
  configured: AlertCircle,
  disconnected: XCircle,
  draft: AlertCircle,
};

const STATUS_COLOR: Record<string, string> = {
  connected: "text-emerald-500",
  active: "text-emerald-500",
  configured: "text-amber-500",
  disconnected: "text-red-400",
  draft: "text-muted-foreground",
};

export function CapabilitiesClient() {
  const [data, setData] = useState<CapabilitiesTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["tools", "connectors", "playbooks", "skills", "workflows"])
  );

  useEffect(() => {
    fetch("/api/capabilities")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const filteredData = useMemo(() => {
    if (!data) return null;
    if (!search.trim()) return data;

    const q = search.toLowerCase();
    const filter = (items: CapabilityItem[]) =>
      items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q)
      );

    return {
      ...data,
      tools: filter(data.tools),
      connectors: filter(data.connectors),
      playbooks: filter(data.playbooks),
      skills: filter(data.skills),
      workflows: filter(data.workflows),
    };
  }, [data, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle size={32} className="text-red-400 mb-3" />
        <p className="text-sm text-muted-foreground">Failed to load capabilities: {error}</p>
      </div>
    );
  }

  if (!filteredData) return null;

  const sections = Object.entries(SECTION_CONFIG) as [
    string,
    (typeof SECTION_CONFIG)[keyof typeof SECTION_CONFIG],
  ][];

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Search + Summary */}
      <div className="space-y-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search capabilities…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Summary pills */}
        {!search && data && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <SummaryPill label="Tools" count={data.summary.totalTools} color="blue" />
            <SummaryPill label="Connectors" count={data.summary.totalConnectors} sub={`${data.summary.connectedConnectors} connected`} color="emerald" />
            <SummaryPill label="Playbooks" count={data.summary.totalPlaybooks} color="violet" />
            <SummaryPill label="Skills" count={data.summary.totalSkills} color="amber" />
            <SummaryPill label="Workflows" count={data.summary.totalWorkflows} color="rose" />
            <SummaryPill label="Actions" count={data.summary.totalActions} color="slate" />
          </div>
        )}
      </div>

      {/* Sections */}
      {sections.map(([key, cfg]) => {
        const items = (filteredData as unknown as Record<string, CapabilityItem[]>)[key];
        if (!items || items.length === 0) return null;

        const Icon = cfg.icon;
        const isExpanded = expandedSections.has(key);

        return (
          <div key={key} className="rounded-xl border bg-card">
            <button
              onClick={() => toggleSection(key)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors rounded-t-xl"
            >
              <ChevronRight
                size={16}
                className={cn(
                  "text-muted-foreground transition-transform",
                  isExpanded && "rotate-90"
                )}
              />
              <Icon size={16} className="text-muted-foreground" />
              <span className="font-medium text-sm">{cfg.label}</span>
              <span className="text-xs text-muted-foreground ml-auto">
                {items.length} item{items.length !== 1 ? "s" : ""}
              </span>
            </button>

            {isExpanded && (
              <div className="border-t">
                <div className="divide-y">
                  {items.map((item) => (
                    <CapabilityRow key={`${item.category}-${item.name}`} item={item} />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SummaryPill({
  label,
  count,
  sub,
  color,
}: {
  label: string;
  count: number;
  sub?: string;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300",
    emerald: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300",
    violet: "bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300",
    amber: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300",
    rose: "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300",
    slate: "bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300",
  };
  return (
    <div className={cn("rounded-lg border px-3 py-2 text-center", colors[color] || colors.slate)}>
      <div className="text-lg font-bold">{count}</div>
      <div className="text-[10px] font-medium uppercase tracking-wider">{label}</div>
      {sub && <div className="text-[9px] opacity-70 mt-0.5">{sub}</div>}
    </div>
  );
}

function CapabilityRow({ item }: { item: CapabilityItem }) {
  const StatusIcon = STATUS_ICON[item.status] || AlertCircle;
  const statusColor = STATUS_COLOR[item.status] || "text-muted-foreground";

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors">
      <StatusIcon size={14} className={cn("shrink-0", statusColor)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{item.name}</span>
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
            {item.actionCount} action{item.actionCount !== 1 ? "s" : ""}
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate">{item.description}</p>
      </div>
      <span
        className={cn(
          "text-[10px] font-medium px-1.5 py-0.5 rounded capitalize shrink-0",
          item.status === "connected" || item.status === "active"
            ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600"
            : item.status === "configured"
              ? "bg-amber-50 dark:bg-amber-950/30 text-amber-600"
              : "bg-red-50 dark:bg-red-950/30 text-red-500"
        )}
      >
        {item.status}
      </span>
    </div>
  );
}
