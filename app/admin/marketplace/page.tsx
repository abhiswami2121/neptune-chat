"use client";

/**
 * Phase 13.C — Skill Discovery Marketplace
 *
 * 4-tab marketplace: Our Library, Vercel Skills, Community, Recently Added.
 * Each external skill card: Preview, Test in Sandbox, Adopt to Library.
 *
 * Architecture: reads from /api/library/graph, /api/marketplace/vercel-search,
 * /api/marketplace/community-search, and library_skills ORDER BY created_at.
 */

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  SearchIcon,
  PackageIcon,
  BookOpenIcon,
  DownloadIcon,
  BeakerIcon,
  ExternalLinkIcon,
  ZapIcon,
  ClockIcon,
  CoinsIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  Loader2Icon,
  StoreIcon,
  GlobeIcon,
  UsersIcon,
  SparklesIcon,
  ArrowRightIcon,
  GitBranchIcon,
  CpuIcon,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface LibrarySkill {
  id: string;
  name: string;
  type: string;
  label: string;
  metadata: {
    description: string;
    domain?: string;
    tools?: number;
    toolNames?: string[];
    version?: string;
    constraints?: Record<string, unknown>;
  };
}

interface ExternalSkill {
  name: string;
  description: string;
  source: string;
  author?: string;
  stars?: number;
  tags: string[];
  url: string;
}

interface SandboxComparison {
  current: { skills: string[]; tokensEstimated: number; latencyEstimatedMs: number; costEstimatedUsd: string };
  withNewSkill: { skills: string[]; tokensEstimated: number; latencyEstimatedMs: number; costEstimatedUsd: string };
  diff: { tokensDelta: number; latencyDeltaMs: number; costDeltaUsd: string; skillsAdded: number };
  newSkill: { url: string; name: string; estimatedTokens: number; estimatedLatencyMs: number; estimatedCostUsd: string };
  recommendation: string;
}

// ── Stat Display ───────────────────────────────────────────────────────────

function StatRow({ label, current, newVal, delta, isPositive }: {
  label: string; current: string | number; newVal: string | number; delta: string | number; isPositive: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono">{String(current)}</span>
        <ArrowRightIcon className="size-3 text-muted-foreground" />
        <span className="text-xs font-mono font-semibold">{String(newVal)}</span>
        <span className={`text-[10px] font-mono ${isPositive ? "text-emerald-500" : "text-amber-500"}`}>
          ({String(delta)})
        </span>
      </div>
    </div>
  );
}

// ── Skill Card Component ───────────────────────────────────────────────────

function SkillCard({
  skill,
  isExternal,
  onTest,
  onAdopt,
  testing,
  adopting,
}: {
  skill: ExternalSkill | LibrarySkill;
  isExternal: boolean;
  onTest?: (skill: ExternalSkill) => void;
  onAdopt?: (skill: ExternalSkill) => void;
  testing?: boolean;
  adopting?: boolean;
}) {
  const ext = skill as ExternalSkill;
  const lib = skill as LibrarySkill;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {isExternal ? (
                <GlobeIcon className="size-4 text-blue-500" />
              ) : (
                <PackageIcon className="size-4 text-primary" />
              )}
              <CardTitle className="text-sm truncate">
                {isExternal ? ext.name : lib.label || lib.name}
              </CardTitle>
            </div>
            <CardDescription className="text-xs mt-1 line-clamp-2">
              {isExternal ? ext.description : lib.metadata?.description}
            </CardDescription>
          </div>
          {isExternal && ext.stars != null && (
            <Badge variant="outline" className="text-[10px] shrink-0 ml-2">
              ⭐ {ext.stars}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Tags */}
        {isExternal && ext.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {ext.tags.slice(0, 5).map((t) => (
              <Badge key={t} variant="secondary" className="text-[9px] py-0 px-1.5">{t}</Badge>
            ))}
          </div>
        )}

        {/* Source / Tools */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {isExternal ? (
            <>
              <GitBranchIcon className="size-3" />
              <span className="truncate">{ext.source || ext.url}</span>
            </>
          ) : (
            <>
              <span className="font-mono">{lib.type}</span>
              {lib.metadata?.tools != null && <span>· {lib.metadata.tools} tools</span>}
              {lib.metadata?.version && <span>· v{lib.metadata.version}</span>}
            </>
          )}
        </div>

        {/* External skill actions */}
        {isExternal && (
          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7 flex-1"
              onClick={() => window.open(ext.url, "_blank")}
            >
              <ExternalLinkIcon className="size-3 mr-1" />
              Preview
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7 flex-1"
              onClick={() => onTest?.(ext)}
              disabled={testing}
            >
              {testing ? (
                <Loader2Icon className="size-3 mr-1 animate-spin" />
              ) : (
                <BeakerIcon className="size-3 mr-1" />
              )}
              Test
            </Button>
            <Button
              variant="default"
              size="sm"
              className="text-xs h-7 flex-1"
              onClick={() => onAdopt?.(ext)}
              disabled={adopting}
            >
              {adopting ? (
                <Loader2Icon className="size-3 mr-1 animate-spin" />
              ) : (
                <DownloadIcon className="size-3 mr-1" />
              )}
              Adopt
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Page Component ────────────────────────────────────────────────────

export default function MarketplacePage() {
  const [activeTab, setActiveTab] = useState("library");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Library data
  const [libraryNodes, setLibraryNodes] = useState<LibrarySkill[]>([]);
  const [librarySummary, setLibrarySummary] = useState<Record<string, number>>({});

  // Vercel search results
  const [vercelResults, setVercelResults] = useState<ExternalSkill[]>([]);
  const [vercelSearched, setVercelSearched] = useState(false);

  // Community search results
  const [communityResults, setCommunityResults] = useState<ExternalSkill[]>([]);

  // Recently added
  const [recentSkills, setRecentSkills] = useState<LibrarySkill[]>([]);

  // Sandbox test state
  const [testSkill, setTestSkill] = useState<ExternalSkill | null>(null);
  const [testQuery, setTestQuery] = useState("");
  const [testResult, setTestResult] = useState<SandboxComparison | null>(null);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  // Adoption state
  const [adoptingSkill, setAdoptingSkill] = useState<string | null>(null);
  const [adoptMessage, setAdoptMessage] = useState<string | null>(null);

  // ── Load library on mount ──────────────────────────────────────────────────
  useEffect(() => {
    loadLibrary();
    loadRecent();
  }, []);

  const loadLibrary = useCallback(async () => {
    try {
      const res = await fetch("/api/library/graph");
      const data = await res.json();
      setLibraryNodes(data.nodes || []);
      setLibrarySummary(data.summary?.byType || {});
    } catch (err) {
      console.error("Failed to load library:", err);
    }
  }, []);

  const loadRecent = useCallback(async () => {
    try {
      // Fetch skills sorted by created_at from the graph API
      const res = await fetch("/api/library/graph");
      const data = await res.json();
      const skills = (data.nodes || []).filter((n: any) => n.type === "skill");
      // Sort by name as proxy for recency (skills have created_at in metadata)
      setRecentSkills(skills.slice(-12).reverse());
    } catch (err) {
      console.error("Failed to load recent:", err);
    }
  }, []);

  // ── Vercel search ──────────────────────────────────────────────────────────
  const searchVercel = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/marketplace/vercel-search?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();
      setVercelResults(data.results || []);
      setVercelSearched(true);
    } catch (err) {
      setError("Vercel search failed");
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  // ── Community search ───────────────────────────────────────────────────────
  const searchCommunity = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/marketplace/community-search?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();
      setCommunityResults(data.results || []);
    } catch (err) {
      setError("Community search failed");
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  // ── Search across relevant tabs ────────────────────────────────────────────
  const handleSearch = useCallback(() => {
    if (activeTab === "vercel") searchVercel();
    else if (activeTab === "community") searchCommunity();
  }, [activeTab, searchVercel, searchCommunity]);

  // ── Sandbox test ───────────────────────────────────────────────────────────
  const handleTest = useCallback(async (skill: ExternalSkill) => {
    setTestSkill(skill);
    setTestResult(null);
    setTestError(null);
    setTesting(true);

    try {
      const currentSkills = libraryNodes
        .filter((n) => n.type === "connector")
        .map((n) => n.name);

      const res = await fetch("/api/marketplace/sandbox-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentSkills: currentSkills.slice(0, 10),
          newSkillUrl: skill.url || `https://github.com/${skill.source}`,
          newSkillName: skill.name,
          query: testQuery || `Test query for ${skill.name}`,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }, [libraryNodes, testQuery]);

  // ── Adopt skill ────────────────────────────────────────────────────────────
  const handleAdopt = useCallback(async (skill: ExternalSkill) => {
    setAdoptingSkill(skill.name);
    setAdoptMessage(null);

    try {
      const res = await fetch("/api/marketplace/adopt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrl: skill.url || `https://github.com/${skill.source}`,
          targetCategory: skill.tags?.[0] || "general",
          skillName: skill.name,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setAdoptMessage(`✅ Adopted "${skill.name}" — refresh library to see it.`);
        loadLibrary(); // Refresh library
      } else {
        setAdoptMessage(`❌ ${data.error || "Adoption failed"}`);
      }
    } catch (err) {
      setAdoptMessage(`❌ ${err instanceof Error ? err.message : "Error"}`);
    } finally {
      setAdoptingSkill(null);
    }
  }, [loadLibrary]);

  // ── Filtered library based on search ───────────────────────────────────────
  const filteredLibrary = useMemo(() => {
    if (!searchQuery.trim()) return libraryNodes;
    const q = searchQuery.toLowerCase();
    return libraryNodes.filter(
      (n) =>
        (n.label || n.name).toLowerCase().includes(q) ||
        (n.metadata?.description || "").toLowerCase().includes(q)
    );
  }, [libraryNodes, searchQuery]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <StoreIcon className="size-5 text-primary" />
          <h1 className="text-xl font-bold">Skill Marketplace</h1>
          <Badge className="text-[10px]">Phase 13</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Discover, test, and adopt skills. Browse our library, search Vercel skills.sh,
          explore community repos, and run sandbox tests before adopting.
        </p>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <SearchIcon className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-9"
          />
        </div>
        <Button onClick={handleSearch} disabled={loading || !searchQuery.trim()}>
          {loading ? <Loader2Icon className="size-4 animate-spin" /> : <SearchIcon className="size-4" />}
          <span className="ml-1.5">Search</span>
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4">
          <TabsTrigger value="library" className="text-xs">
            <BookOpenIcon className="size-3.5 mr-1" />
            Our Library
            <Badge variant="secondary" className="ml-1 text-[9px] px-1">{libraryNodes.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="vercel" className="text-xs">
            <ZapIcon className="size-3.5 mr-1" />
            Vercel Skills
          </TabsTrigger>
          <TabsTrigger value="community" className="text-xs">
            <UsersIcon className="size-3.5 mr-1" />
            Community
          </TabsTrigger>
          <TabsTrigger value="recent" className="text-xs">
            <SparklesIcon className="size-3.5 mr-1" />
            Recently Added
          </TabsTrigger>
        </TabsList>

        {/* ── Our Library Tab ───────────────────────────────────────────────── */}
        <TabsContent value="library" className="space-y-4">
          {/* Library summary */}
          <div className="flex flex-wrap gap-3">
            {Object.entries(librarySummary).map(([type, count]) => (
              <Badge key={type} variant="outline" className="text-xs">
                {type}: {count}
              </Badge>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredLibrary.slice(0, 24).map((node) => (
              <Card key={node.id} className="hover:shadow-sm transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <PackageIcon className="size-3.5 text-primary" />
                    <CardTitle className="text-sm truncate">{node.label || node.name}</CardTitle>
                    <Badge variant="secondary" className="text-[9px] ml-auto">{node.type}</Badge>
                  </div>
                  <CardDescription className="text-xs line-clamp-2">
                    {node.metadata?.description || "—"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                    {node.metadata?.domain && (
                      <Badge variant="outline" className="text-[9px]">{node.metadata.domain}</Badge>
                    )}
                    {node.metadata?.tools != null && (
                      <span className="font-mono">{node.metadata.tools} tools</span>
                    )}
                    {node.metadata?.version && <span>v{node.metadata.version}</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {filteredLibrary.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No skills found.</p>
          )}
        </TabsContent>

        {/* ── Vercel Skills Tab ─────────────────────────────────────────────── */}
        <TabsContent value="vercel" className="space-y-4">
          {!vercelSearched && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Search for skills from Vercel skills.sh marketplace. Try: "react", "billing", "slack"
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {vercelResults.map((skill, i) => (
              <SkillCard
                key={`${skill.name}-${i}`}
                skill={skill}
                isExternal
                onTest={handleTest}
                onAdopt={handleAdopt}
                testing={testing && testSkill?.name === skill.name}
                adopting={adoptingSkill === skill.name}
              />
            ))}
          </div>
          {vercelSearched && vercelResults.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No results found. Try a different search query.
            </p>
          )}
        </TabsContent>

        {/* ── Community Tab ──────────────────────────────────────────────────── */}
        <TabsContent value="community" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {communityResults.map((skill, i) => (
              <SkillCard
                key={`${skill.name}-${i}`}
                skill={skill}
                isExternal
                onTest={handleTest}
                onAdopt={handleAdopt}
                testing={testing && testSkill?.name === skill.name}
                adopting={adoptingSkill === skill.name}
              />
            ))}
          </div>
          {communityResults.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Search for skills from community repos (GitHub). Sources: vercel-labs/agent-skills, anthropics/skills, awesome-claude-skills.
            </p>
          )}
        </TabsContent>

        {/* ── Recently Added Tab ─────────────────────────────────────────────── */}
        <TabsContent value="recent" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentSkills.map((node) => (
              <Card key={node.id} className="hover:shadow-sm transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <SparklesIcon className="size-3.5 text-amber-500" />
                    <CardTitle className="text-sm truncate">{node.label || node.name}</CardTitle>
                    <Badge variant="secondary" className="text-[9px] ml-auto">{node.type}</Badge>
                  </div>
                  <CardDescription className="text-xs line-clamp-2">
                    {node.metadata?.description || "—"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-[10px] text-muted-foreground">
                    {node.metadata?.domain && <span>Domain: {node.metadata.domain}</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Sandbox Test Comparison Modal ───────────────────────────────────── */}
      {testSkill && (
        <Card className="mt-6 border-blue-500/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <BeakerIcon className="size-4 text-blue-500" />
              <CardTitle className="text-base">Sandbox Test: {testSkill.name}</CardTitle>
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setTestSkill(null)}>
                <XCircleIcon className="size-4" />
              </Button>
            </div>
            <CardDescription>
              Comparing current skills vs current + {testSkill.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Test query input */}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Test query (e.g., 'Process a billing refund')"
                value={testQuery}
                onChange={(e) => setTestQuery(e.target.value)}
                className="flex-1 text-sm"
              />
              <Button onClick={() => handleTest(testSkill)} disabled={testing} size="sm">
                {testing ? <Loader2Icon className="size-4 animate-spin" /> : "Run Test"}
              </Button>
            </div>

            {/* Test results */}
            {testResult && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-xs font-semibold mb-2">Current ({testResult.current.skills.length} skills)</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between"><span>Tokens:</span><span className="font-mono">{testResult.current.tokensEstimated.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>Latency:</span><span className="font-mono">{testResult.current.latencyEstimatedMs}ms</span></div>
                      <div className="flex justify-between"><span>Cost:</span><span className="font-mono">${testResult.current.costEstimatedUsd}</span></div>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                    <p className="text-xs font-semibold mb-2">With {testSkill.name} ({testResult.withNewSkill.skills.length} skills)</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between"><span>Tokens:</span><span className="font-mono">{testResult.withNewSkill.tokensEstimated.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>Latency:</span><span className="font-mono">{testResult.withNewSkill.latencyEstimatedMs}ms</span></div>
                      <div className="flex justify-between"><span>Cost:</span><span className="font-mono">${testResult.withNewSkill.costEstimatedUsd}</span></div>
                    </div>
                  </div>
                </div>

                {/* Deltas */}
                <div className="space-y-1">
                  <StatRow
                    label="Tokens"
                    current={testResult.current.tokensEstimated.toLocaleString()}
                    newVal={testResult.withNewSkill.tokensEstimated.toLocaleString()}
                    delta={`${testResult.diff.tokensDelta > 0 ? "+" : ""}${testResult.diff.tokensDelta}`}
                    isPositive={testResult.diff.tokensDelta <= 0}
                  />
                  <StatRow
                    label="Latency"
                    current={`${testResult.current.latencyEstimatedMs}ms`}
                    newVal={`${testResult.withNewSkill.latencyEstimatedMs}ms`}
                    delta={`${testResult.diff.latencyDeltaMs > 0 ? "+" : ""}${testResult.diff.latencyDeltaMs}ms`}
                    isPositive={testResult.diff.latencyDeltaMs <= 0}
                  />
                  <StatRow
                    label="Cost"
                    current={`$${testResult.current.costEstimatedUsd}`}
                    newVal={`$${testResult.withNewSkill.costEstimatedUsd}`}
                    delta={`$${testResult.diff.costDeltaUsd}`}
                    isPositive={parseFloat(testResult.diff.costDeltaUsd) <= 0}
                  />
                </div>

                {/* Recommendation */}
                <div className={`p-3 rounded-lg text-xs ${
                  testResult.recommendation.startsWith("⚠️")
                    ? "bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200"
                    : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200"
                }`}>
                  {testResult.recommendation}
                </div>

                {/* Quick Adopt from test */}
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleAdopt(testSkill)}
                  disabled={!!adoptingSkill}
                  className="w-full"
                >
                  {adoptingSkill ? <Loader2Icon className="size-3.5 mr-1 animate-spin" /> : <DownloadIcon className="size-3.5 mr-1" />}
                  Adopt {testSkill.name} to Library
                </Button>
              </div>
            )}

            {testError && (
              <p className="text-sm text-destructive">{testError}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Adopt message toast */}
      {adoptMessage && (
        <div className={`fixed bottom-6 right-6 p-4 rounded-lg shadow-lg text-sm ${
          adoptMessage.startsWith("✅") ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200" : "bg-destructive/10 text-destructive"
        }`}>
          {adoptMessage}
        </div>
      )}

      {/* Error display */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-3">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
