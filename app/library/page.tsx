/**
 * /library — Enterprise Knowledge Files Library
 *
 * PHASE C: Knowledge Files Redesign — shadcn-based enterprise design.
 *
 * Features:
 *   - LibraryToolbar: Search, Filter, Sort, ViewToggle (grid/table)
 *   - Tabbed: Playbooks | Connectors | Skills | Functions | PRDs | Wiki | Secrets
 *   - LibraryGrid (card view) + LibraryTable (table view) toggle
 *   - DetailDrawer: opens a Sheet with item details, edit, execute
 *   - Live counts from API endpoints
 *   - Responsive: 1 col mobile, 2 tablet, 3 desktop
 *   - Skeleton loading + Empty state + Dark mode parity
 */
"use client";

import {
  BookOpenIcon,
  FileTextIcon,
  FolderGit2Icon,
  FunctionSquareIcon,
  PlugIcon,
  ShieldIcon,
  SparklesIcon,
  TargetIcon,
  ZapIcon,
} from "lucide-react";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/library/empty-state";
import { DetailDrawer } from "@/components/library/detail-drawer";
import { LibraryCard, type LibraryItem } from "@/components/library/library-card";
import { LibraryGrid } from "@/components/library/library-grid";
import { LibraryTable } from "@/components/library/library-table";
import { LibraryToolbar, type ViewMode } from "@/components/library/library-toolbar";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface PlaybookEntry {
  domain: string;
  path: string;
  priority: string;
  routines_count: number;
  connectors: string[];
  description: string;
  intent_tags: string[];
}

interface ConnectorEntry {
  name: string;
  path: string;
  version: string;
  tools: number;
  primary_domain: string;
  description: string;
  mcp: boolean;
  custom_client: boolean;
  also_in: string[];
  dependencies: string[];
}

interface SkillEntry {
  name: string;
  version: string;
  path: string;
  primary_domain: string;
  also_in: string[];
  dependencies: string[];
  kind: string;
}

interface FunctionEntry {
  function_name: string;
  category: string;
  parent_connector: string;
  associated_playbooks: string[];
}

// ── Shared state per tab ─────────────────────────────────────────────────────

function useTabState() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name-asc");
  const [filterCategory, setFilterCategory] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const handleView = useCallback((item: LibraryItem) => {
    setSelectedItem(item);
    setDetailOpen(true);
  }, []);

  return {
    search, setSearch,
    sortBy, setSortBy,
    filterCategory, setFilterCategory,
    viewMode, setViewMode,
    selectedItem, setSelectedItem,
    detailOpen, setDetailOpen,
    handleView,
  };
}

// ── Playbooks Tab ─────────────────────────────────────────────────────────────

function PlaybooksTab() {
  const [data, setData] = useState<PlaybookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tab = useTabState();

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    // Static playbook list from skills API
    const playbooks: PlaybookEntry[] = [
      { domain: "Billing", path: "playbooks/billing", priority: "P0", routines_count: 4, connectors: ["nmi","hyperswitch","base44","slack","ghl"], description: "Payment processing, refunds, CoF health audits", intent_tags: ["refund","charge","payment","decline"] },
      { domain: "Customer Support", path: "playbooks/customer-support", priority: "P0", routines_count: 2, connectors: ["base44","slack","ghl","vapi","linear","nmi","hyperswitch"], description: "Customer 360, ticket triage, escalations", intent_tags: ["ticket","support","look up","customer"] },
      { domain: "Disputes", path: "playbooks/disputes", priority: "P0", routines_count: 2, connectors: ["forth","base44","slack"], description: "Credit disputes, FCRA letters, evidence submission", intent_tags: ["dispute","credit report","fcra","bureau"] },
      { domain: "Agent Orchestration", path: "playbooks/agent-orchestration", priority: "P1", routines_count: 3, connectors: ["base44","github","vercel","slack"], description: "Agent routing, dispatch, multi-agent coordination", intent_tags: ["orchestrate","dispatch","handoff"] },
      { domain: "Deploy (Vercel+GitHub)", path: "playbooks/deploy-vercel-github", priority: "P1", routines_count: 2, connectors: ["github","vercel","slack"], description: "Vercel deployments, GitHub PR workflows", intent_tags: ["ship","deploy","merge","release"] },
      { domain: "Engineering", path: "playbooks/engineering", priority: "P1", routines_count: 3, connectors: ["github","vercel","wiki"], description: "Code review, refactoring, PRDs, architecture", intent_tags: ["code review","architecture","PRD"] },
      { domain: "Reporting", path: "playbooks/reporting", priority: "P1", routines_count: 3, connectors: ["base44","slack","wiki"], description: "Operational dashboards, morning pulse", intent_tags: ["reporting","dashboard","analytics"] },
      { domain: "Vercel Discipline", path: "playbooks/vercel-discipline", priority: "P1", routines_count: 3, connectors: ["vercel","github"], description: "Vercel deployment standards, security patterns", intent_tags: ["vercel","deploy","env","build"] },
      { domain: "VPS Ops", path: "playbooks/vps-ops", priority: "P1", routines_count: 3, connectors: ["base44","slack"], description: "VPS management, pm2, nginx, Cloudflare", intent_tags: ["VPS","pm2","server","health"] },
      { domain: "HR", path: "playbooks/HR", priority: "P2", routines_count: 2, connectors: ["slack","wiki","base44"], description: "Team management, onboarding, compliance", intent_tags: ["HR","team","personnel"] },
      { domain: "Marketing", path: "playbooks/marketing", priority: "P2", routines_count: 2, connectors: ["ghl","slack","vapi","base44"], description: "Campaigns, lead nurture, content strategy", intent_tags: ["marketing","campaign","lead"] },
    ];
    setData(playbooks);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const items: LibraryItem[] = useMemo(() => data.map((pb) => ({
    id: pb.path,
    name: pb.domain,
    type: "playbook" as const,
    description: pb.description,
    path: pb.path,
    actionCount: pb.routines_count,
    domain: pb.priority,
    updatedAt: undefined,
  })), [data]);

  const filtered = useMemo(() => {
    let list = items;
    if (tab.search) {
      const q = tab.search.toLowerCase();
      list = list.filter((i) =>
        i.name.toLowerCase().includes(q) ||
        (i.description ?? "").toLowerCase().includes(q)
      );
    }
    if (tab.sortBy === "name-asc") list.sort((a, b) => a.name.localeCompare(b.name));
    else if (tab.sortBy === "name-desc") list.sort((a, b) => b.name.localeCompare(a.name));
    return list;
  }, [items, tab.search, tab.sortBy]);

  return (
    <div className="space-y-4">
      <LibraryToolbar
        filterCategory={tab.filterCategory}
        onFilterChange={tab.setFilterCategory}
        onSearchChange={tab.setSearch}
        onSortChange={tab.setSortBy}
        onViewModeChange={tab.setViewMode}
        searchQuery={tab.search}
        sortBy={tab.sortBy}
        totalCount={filtered.length}
        viewMode={tab.viewMode}
      />
      {tab.viewMode === "grid" ? (
        <LibraryGrid
          error={error}
          items={filtered}
          loading={loading}
          onRetry={fetchData}
          onView={tab.handleView}
        />
      ) : (
        <LibraryTable
          error={error}
          items={filtered}
          loading={loading}
          onRetry={fetchData}
          onView={tab.handleView}
        />
      )}
      <DetailDrawer
        item={tab.selectedItem}
        onOpenChange={tab.setDetailOpen}
        open={tab.detailOpen}
      />
    </div>
  );
}

// ── Connectors Tab ────────────────────────────────────────────────────────────

function ConnectorsTab() {
  const [data, setData] = useState<ConnectorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tab = useTabState();

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/skills")
      .then((r) => r.json())
      .then((json) => {
        setData(json.connectors || []);
        setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const items: LibraryItem[] = useMemo(() => data.map((c) => ({
    id: c.name,
    name: c.name.replace("-connector", ""),
    type: "connector" as const,
    description: c.description || `${c.tools} tools for ${c.primary_domain}`,
    path: c.path,
    actionCount: c.tools,
    domain: c.primary_domain,
    updatedAt: undefined,
  })), [data]);

  const filtered = useMemo(() => {
    let list = items;
    if (tab.search) {
      const q = tab.search.toLowerCase();
      list = list.filter((i) =>
        i.name.toLowerCase().includes(q) ||
        (i.description ?? "").toLowerCase().includes(q) ||
        (i.domain ?? "").toLowerCase().includes(q)
      );
    }
    if (tab.sortBy === "name-asc") list.sort((a, b) => a.name.localeCompare(b.name));
    else if (tab.sortBy === "name-desc") list.sort((a, b) => b.name.localeCompare(a.name));
    return list;
  }, [items, tab.search, tab.sortBy]);

  return (
    <div className="space-y-4">
      <LibraryToolbar
        filterCategory={tab.filterCategory}
        onFilterChange={tab.setFilterCategory}
        onSearchChange={tab.setSearch}
        onSortChange={tab.setSortBy}
        onViewModeChange={tab.setViewMode}
        searchQuery={tab.search}
        sortBy={tab.sortBy}
        totalCount={filtered.length}
        viewMode={tab.viewMode}
      />
      {tab.viewMode === "grid" ? (
        <LibraryGrid
          error={error}
          items={filtered}
          loading={loading}
          onRetry={fetchData}
          onView={tab.handleView}
        />
      ) : (
        <LibraryTable
          error={error}
          items={filtered}
          loading={loading}
          onRetry={fetchData}
          onView={tab.handleView}
        />
      )}
      <DetailDrawer
        item={tab.selectedItem}
        onOpenChange={tab.setDetailOpen}
        open={tab.detailOpen}
      />
    </div>
  );
}

// ── Skills Tab ────────────────────────────────────────────────────────────────

function SkillsTab() {
  const [data, setData] = useState<SkillEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tab = useTabState();

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/skills")
      .then((r) => r.json())
      .then((json) => {
        const all = [
          ...(json.connectors || []).map((c: SkillEntry) => ({ ...c, kind: "connector" })),
          ...(json.functions || []).map((f: SkillEntry) => ({ ...f, kind: "function" })),
          ...(json.capabilities || []).map((c: SkillEntry) => ({ ...c, kind: "capability" })),
        ];
        setData(all);
        setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const items: LibraryItem[] = useMemo(() => data.map((s) => ({
    id: s.name + s.kind,
    name: s.name,
    type: (s.kind === "connector" ? "connector" : s.kind === "function" ? "function" : "skill") as LibraryItem["type"],
    description: `Domain: ${s.primary_domain}`,
    path: s.path,
    domain: s.primary_domain,
    updatedAt: undefined,
  })), [data]);

  const filtered = useMemo(() => {
    let list = items;
    if (tab.filterCategory !== "all") {
      list = list.filter((i) => i.type === tab.filterCategory);
    }
    if (tab.search) {
      const q = tab.search.toLowerCase();
      list = list.filter((i) =>
        i.name.toLowerCase().includes(q) ||
        (i.description ?? "").toLowerCase().includes(q)
      );
    }
    if (tab.sortBy === "name-asc") list.sort((a, b) => a.name.localeCompare(b.name));
    else if (tab.sortBy === "name-desc") list.sort((a, b) => b.name.localeCompare(a.name));
    return list;
  }, [items, tab.search, tab.sortBy, tab.filterCategory]);

  return (
    <div className="space-y-4">
      <LibraryToolbar
        filterCategory={tab.filterCategory}
        onFilterChange={tab.setFilterCategory}
        onSearchChange={tab.setSearch}
        onSortChange={tab.setSortBy}
        onViewModeChange={tab.setViewMode}
        searchQuery={tab.search}
        sortBy={tab.sortBy}
        totalCount={filtered.length}
        viewMode={tab.viewMode}
      />
      {tab.viewMode === "grid" ? (
        <LibraryGrid
          error={error}
          items={filtered}
          loading={loading}
          onRetry={fetchData}
          onView={tab.handleView}
        />
      ) : (
        <LibraryTable
          error={error}
          items={filtered}
          loading={loading}
          onRetry={fetchData}
          onView={tab.handleView}
        />
      )}
      <DetailDrawer
        item={tab.selectedItem}
        onOpenChange={tab.setDetailOpen}
        open={tab.detailOpen}
      />
    </div>
  );
}

// ── Functions Tab ─────────────────────────────────────────────────────────────

function FunctionsTab() {
  const [data, setData] = useState<FunctionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tab = useTabState();

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/function-registry?limit=200")
      .then((r) => r.json())
      .then((json) => {
        setData(json.functions || []);
        setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const items: LibraryItem[] = useMemo(() => data.map((f) => ({
    id: f.function_name,
    name: f.function_name,
    type: "function" as const,
    description: `Category: ${f.category} · Connector: ${f.parent_connector.replace("connectors/", "")}`,
    path: f.parent_connector,
    domain: f.category,
    actionCount: f.associated_playbooks?.length ?? 0,
  })), [data]);

  const filtered = useMemo(() => {
    let list = items;
    if (tab.filterCategory !== "all") {
      list = list.filter((i) => i.domain === tab.filterCategory);
    }
    if (tab.search) {
      const q = tab.search.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q));
    }
    if (tab.sortBy === "name-asc") list.sort((a, b) => a.name.localeCompare(b.name));
    else if (tab.sortBy === "name-desc") list.sort((a, b) => b.name.localeCompare(a.name));
    else if (tab.sortBy === "updated-desc") list.sort((a, b) => b.name.localeCompare(a.name));
    return list;
  }, [items, tab.search, tab.sortBy, tab.filterCategory]);

  // Get unique categories for filter
  const categories = useMemo(() => Array.from(new Set(data.map((f) => f.category))), [data]);

  return (
    <div className="space-y-4">
      <LibraryToolbar
        filterCategory={tab.filterCategory}
        onFilterChange={tab.setFilterCategory}
        onSearchChange={tab.setSearch}
        onSortChange={tab.setSortBy}
        onViewModeChange={tab.setViewMode}
        searchQuery={tab.search}
        sortBy={tab.sortBy}
        totalCount={filtered.length}
        viewMode={tab.viewMode}
      />
      {tab.viewMode === "grid" ? (
        <LibraryGrid
          error={error}
          items={filtered}
          loading={loading}
          onRetry={fetchData}
          onView={tab.handleView}
        />
      ) : (
        <LibraryTable
          error={error}
          items={filtered}
          loading={loading}
          onRetry={fetchData}
          onView={tab.handleView}
        />
      )}
      <DetailDrawer
        item={tab.selectedItem}
        onOpenChange={tab.setDetailOpen}
        open={tab.detailOpen}
      />
    </div>
  );
}

// ── PRDs Tab ──────────────────────────────────────────────────────────────────

function PRDsTab() {
  const [data, setData] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tab = useTabState();

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/prds")
      .then((r) => r.json())
      .then((json) => {
        setData((json.prds || []).map((p: { name: string; description: string; category: string }) => ({
          id: p.name,
          name: p.name.replace(".md", ""),
          type: "prd" as const,
          description: p.description,
          domain: p.category,
        })));
        setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    let list = data;
    if (tab.search) {
      const q = tab.search.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q));
    }
    return list;
  }, [data, tab.search]);

  return (
    <div className="space-y-4">
      <LibraryToolbar
        filterCategory={tab.filterCategory}
        onFilterChange={tab.setFilterCategory}
        onSearchChange={tab.setSearch}
        onSortChange={tab.setSortBy}
        onViewModeChange={tab.setViewMode}
        searchQuery={tab.search}
        sortBy={tab.sortBy}
        totalCount={filtered.length}
        viewMode={tab.viewMode}
      />
      {tab.viewMode === "grid" ? (
        <LibraryGrid
          error={error}
          items={filtered}
          loading={loading}
          onRetry={fetchData}
          onView={tab.handleView}
        />
      ) : (
        <LibraryTable
          error={error}
          items={filtered}
          loading={loading}
          onRetry={fetchData}
          onView={tab.handleView}
        />
      )}
      <DetailDrawer
        item={tab.selectedItem}
        onOpenChange={tab.setDetailOpen}
        open={tab.detailOpen}
      />
    </div>
  );
}

// ── Wiki Tab ──────────────────────────────────────────────────────────────────

function WikiTab() {
  const [data, setData] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tab = useTabState();

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/wiki")
      .then((r) => r.json())
      .then((json) => {
        const items: LibraryItem[] = [];
        if (json.tree) {
          for (const [category, pages] of Object.entries(json.tree)) {
            if (Array.isArray(pages)) {
              for (const page of pages as Array<{ name: string; path: string }>) {
                items.push({
                  id: page.path,
                  name: page.name.replace(".md", ""),
                  type: "wiki" as const,
                  description: `Category: ${category}`,
                  path: page.path,
                  domain: category,
                });
              }
            }
          }
        }
        setData(items);
        setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    let list = data;
    if (tab.search) {
      const q = tab.search.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q));
    }
    return list;
  }, [data, tab.search]);

  return (
    <div className="space-y-4">
      <LibraryToolbar
        filterCategory={tab.filterCategory}
        onFilterChange={tab.setFilterCategory}
        onSearchChange={tab.setSearch}
        onSortChange={tab.setSortBy}
        onViewModeChange={tab.setViewMode}
        searchQuery={tab.search}
        sortBy={tab.sortBy}
        totalCount={filtered.length}
        viewMode={tab.viewMode}
      />
      {tab.viewMode === "grid" ? (
        <LibraryGrid
          error={error}
          items={filtered}
          loading={loading}
          onRetry={fetchData}
          onView={tab.handleView}
        />
      ) : (
        <LibraryTable
          error={error}
          items={filtered}
          loading={loading}
          onRetry={fetchData}
          onView={tab.handleView}
        />
      )}
      <DetailDrawer
        item={tab.selectedItem}
        onOpenChange={tab.setDetailOpen}
        open={tab.detailOpen}
      />
    </div>
  );
}

// ── Main Library Page ─────────────────────────────────────────────────────────

export default function LibraryPage() {
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    // Fetch live counts
    Promise.allSettled([
      fetch("/api/skills").then((r) => r.json()),
      fetch("/api/function-registry?limit=1").then((r) => r.json()),
      fetch("/api/prds").then((r) => r.json()),
      fetch("/api/wiki").then((r) => r.json()),
    ]).then(([skillsRes, funcRes, prdsRes, wikiRes]) => {
      const counts: Record<string, number> = {};
      if (skillsRes.status === "fulfilled") {
        counts.skills = skillsRes.value.summary?.totalSkills ?? 0;
        counts.connectors = skillsRes.value.connectors?.length ?? 0;
      }
      if (funcRes.status === "fulfilled") {
        counts.functions = funcRes.value.summary?.total_functions ?? funcRes.value.pagination?.total ?? 0;
      }
      if (prdsRes.status === "fulfilled") {
        counts.prds = prdsRes.value.count ?? 0;
      }
      if (wikiRes.status === "fulfilled") {
        const tree = wikiRes.value.tree ?? {};
        counts.wiki = Object.values(tree).reduce((sum: number, pages: unknown) => {
          return sum + (Array.isArray(pages) ? pages.length : 0);
        }, 0);
      }
      setTabCounts(counts);
    }).catch(() => {});
  }, []);

  const tabs = [
    { value: "playbooks", label: "Playbooks", icon: FolderGit2Icon, count: 11 },
    { value: "connectors", label: "Connectors", icon: PlugIcon, count: tabCounts.connectors ?? 14 },
    { value: "skills", label: "Skills", icon: TargetIcon, count: tabCounts.skills ?? 28 },
    { value: "functions", label: "Functions", icon: FunctionSquareIcon, count: tabCounts.functions ?? 199 },
    { value: "prds", label: "PRDs", icon: BookOpenIcon, count: tabCounts.prds ?? 4 },
    { value: "wiki", label: "Wiki", icon: FileTextIcon, count: tabCounts.wiki ?? 12 },
  ];

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Library</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Knowledge files — Playbooks · Connectors · Skills · Functions · PRDs · Wiki
        </p>
      </div>

      <Tabs className="w-full" defaultValue="playbooks">
        <TabsList className="mb-6 h-auto flex-wrap gap-1 bg-transparent p-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                className="min-h-[44px] data-[state=active]:bg-muted data-[state=active]:shadow-sm rounded-lg"
                key={tab.value}
                value={tab.value}
              >
                <Icon className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">{tab.label}</span>
                <Badge className="ml-2 h-5 px-1.5 text-[10px] tabular-nums" variant="secondary">
                  {tab.count}
                </Badge>
              </TabsTrigger>
            );
          })}
          <TabsTrigger
            asChild
            className="min-h-[44px] data-[state=active]:bg-muted data-[state=active]:shadow-sm rounded-lg"
            value="secrets"
          >
            <Link href="/library/secrets">
              <ShieldIcon className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Secrets</span>
              <Badge className="ml-2 h-5 px-1.5 text-[10px]" variant="secondary">
                🔒
              </Badge>
            </Link>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="playbooks"><PlaybooksTab /></TabsContent>
        <TabsContent value="connectors"><ConnectorsTab /></TabsContent>
        <TabsContent value="skills"><SkillsTab /></TabsContent>
        <TabsContent value="functions"><FunctionsTab /></TabsContent>
        <TabsContent value="prds"><PRDsTab /></TabsContent>
        <TabsContent value="wiki"><WikiTab /></TabsContent>
        <TabsContent value="secrets">
          <div className="flex items-center justify-center py-16">
            <EmptyState
              actionLabel="View Secrets"
              description="Manage API keys, tokens, and environment secrets."
              title="Secrets Management"
              variant="empty"
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
