"use client";

/**
 * Phase 12.E — Agent Simulation Page
 *
 * Side-by-side comparison: "Bloated Mode" vs "Progressive Disclosure"
 * Shows tokens, tools, cost, discovery path, and hypothetical answer for
 * the same user query run through both agent configurations.
 *
 * Enter a query, click Simulate, and see the difference.
 */

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  ActivityIcon,
  BeakerIcon,
  CoinsIcon,
  CpuIcon,
  PlayIcon,
  ShrinkIcon,
  SparklesIcon,
  TimerIcon,
  ZapIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  ArrowRightIcon,
  LayersIcon,
  Loader2Icon,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface ModeResult {
  mode: "bloated" | "progressive";
  systemPromptTokens: number;
  systemPromptPreview?: string;
  toolsAvailable: string[];
  toolsCount: number;
  estimatedTotalTokens: number;
  estimatedCost: string;
  discoveryPath: string[];
  pathDepth: number;
  hypotheticalAnswer: string;
  latencyEstimate: string;
}

interface Comparison {
  tokenReduction: string;
  toolReduction: string;
  costSavings: string;
  winner: "progressive" | "bloated" | "tie";
  winnerReason: string;
}

interface SimulationData {
  query: string;
  bloated: ModeResult;
  progressive: ModeResult;
  comparison: Comparison;
}

// ── Mode Card Component ────────────────────────────────────────────────────

function ModeCard({
  result,
  isWinner,
  label,
}: {
  result: ModeResult;
  isWinner: boolean;
  label: string;
}) {
  const isProgressive = result.mode === "progressive";

  return (
    <Card className={isWinner ? "ring-2 ring-emerald-500/50" : undefined}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {isProgressive ? (
            <ShrinkIcon className="size-4 text-emerald-500" />
          ) : (
            <SparklesIcon className="size-4 text-blue-500" />
          )}
          <CardTitle className="text-base">{label}</CardTitle>
          {isWinner && (
            <Badge variant="secondary" className="ml-auto bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              Winner
            </Badge>
          )}
        </div>
        <CardDescription>
          {isProgressive
            ? "Starts minimal — discovers tools at runtime"
            : "Full catalog pre-loaded — all tools available immediately"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-3">
          <StatBox
            icon={<CpuIcon className="size-3.5" />}
            label="System Tokens"
            value={result.systemPromptTokens.toLocaleString()}
            color={isProgressive ? "emerald" : "blue"}
          />
          <StatBox
            icon={<ActivityIcon className="size-3.5" />}
            label="Total Tokens"
            value={result.estimatedTotalTokens.toLocaleString()}
            color={isProgressive ? "emerald" : "blue"}
          />
          <StatBox
            icon={<CoinsIcon className="size-3.5" />}
            label="Est. Cost"
            value={result.estimatedCost}
            color={isProgressive ? "emerald" : "blue"}
          />
          <StatBox
            icon={<TimerIcon className="size-3.5" />}
            label="Latency"
            value={result.latencyEstimate}
            color={isProgressive ? "emerald" : "blue"}
          />
        </div>

        {/* Tools */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1.5">
            Tools at Start ({result.toolsCount})
          </p>
          <div className="flex flex-wrap gap-1">
            {result.toolsAvailable.slice(0, 8).map((t) => (
              <Badge key={t} variant="outline" className="text-[10px] py-0 px-1.5">
                {t.length > 18 ? t.slice(0, 16) + "…" : t}
              </Badge>
            ))}
            {result.toolsAvailable.length > 8 && (
              <Badge variant="outline" className="text-[10px]">
                +{result.toolsAvailable.length - 8} more
              </Badge>
            )}
          </div>
        </div>

        {/* Discovery Path */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1.5">
            Discovery Path ({result.pathDepth} steps)
          </p>
          <div className="space-y-1">
            {result.discoveryPath.map((step, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <ArrowRightIcon className="size-3 mt-0.5 text-muted-foreground/60 shrink-0" />
                <span className="text-xs text-muted-foreground">{step}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Hypothetical Answer */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1">
            What the agent would do
          </p>
          <p className="text-xs text-muted-foreground/80 leading-relaxed italic">
            {result.hypotheticalAnswer}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatBox({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-${color}-500`}>{icon}</span>
      <div>
        <p className="text-[10px] text-muted-foreground leading-none">{label}</p>
        <p className="text-sm font-mono font-semibold leading-tight">{value}</p>
      </div>
    </div>
  );
}

// ── Main Page Component ────────────────────────────────────────────────────

export default function AgentSimPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SimulationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSimulate = useCallback(async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/agent-sim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || `HTTP ${res.status}`);
      }

      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleQuickQuery = useCallback((q: string) => {
    setQuery(q);
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <BeakerIcon className="size-5 text-primary" />
          <h1 className="text-xl font-bold">Agent Simulation</h1>
          <Badge className="ml-1 text-[10px]">Phase 12.E</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Side-by-side comparison: Bloated Mode (full catalog pre-loaded) vs Progressive Disclosure
          (3 loader tools discover capabilities at runtime).
        </p>
      </div>

      {/* Query Input */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <Textarea
              placeholder="Enter a user query to simulate, e.g. 'Process a refund for customer John Doe' or 'Deploy the latest build to production'"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={3}
              className="resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleSimulate();
                }
              }}
            />
            <div className="flex items-center gap-2">
              <Button onClick={handleSimulate} disabled={loading || !query.trim()}>
                {loading ? (
                  <>
                    <Loader2Icon className="size-4 mr-1.5 animate-spin" />
                    Simulating...
                  </>
                ) : (
                  <>
                    <PlayIcon className="size-4 mr-1.5" />
                    Simulate Query
                  </>
                )}
              </Button>
              <span className="text-[10px] text-muted-foreground">or Cmd+Enter</span>
            </div>

            {/* Quick Queries */}
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                Quick Queries
              </p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_QUERIES.map((q) => (
                  <Button
                    key={q.label}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => handleQuickQuery(q.query)}
                  >
                    {q.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-3">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-[400px] rounded-xl" />
          <Skeleton className="h-[400px] rounded-xl" />
        </div>
      )}

      {/* Results */}
      {data && !loading && (
        <div className="space-y-6">
          {/* Comparison Summary */}
          <Card className="bg-muted/20">
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center gap-4">
                <ComparisonBadge
                  icon={<TrendingDownIcon className="size-3.5" />}
                  label="Token Reduction"
                  value={data.comparison.tokenReduction}
                />
                <ComparisonBadge
                  icon={<LayersIcon className="size-3.5" />}
                  label="Tool Reduction"
                  value={data.comparison.toolReduction}
                />
                <ComparisonBadge
                  icon={<CoinsIcon className="size-3.5" />}
                  label="Cost Savings"
                  value={data.comparison.costSavings}
                />
                <Badge
                  variant="secondary"
                  className={
                    data.comparison.winner === "progressive"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  }
                >
                  {data.comparison.winner === "progressive" ? (
                    <TrendingDownIcon className="size-3 mr-1" />
                  ) : (
                    <TrendingUpIcon className="size-3 mr-1" />
                  )}
                  {data.comparison.winner === "progressive" ? "Progressive Wins" : "Bloated Wins"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                {data.comparison.winnerReason}
              </p>
            </CardContent>
          </Card>

          {/* Side by Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ModeCard
              result={data.bloated}
              isWinner={data.comparison.winner === "bloated"}
              label="Bloated Mode"
            />
            <ModeCard
              result={data.progressive}
              isWinner={data.comparison.winner === "progressive"}
              label="Progressive Disclosure"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ComparisonBadge({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-xs text-muted-foreground">{label}:</span>
      <span className="text-xs font-mono font-semibold">{value}</span>
    </div>
  );
}

const QUICK_QUERIES = [
  { label: "💳 Process Refund", query: "Process a refund for customer John Doe on transaction TXN-12345" },
  { label: "🚀 Deploy to Prod", query: "Deploy the latest build of neptune-chat to production" },
  { label: "📊 Morning Report", query: "Give me the morning pulse report for all active customers" },
  { label: "📝 Create PRD", query: "Create a PRD for a new feature that auto-generates Slack reports" },
  { label: "🔍 Customer Support", query: "Customer Jane Smith says her credit report has errors — help resolve" },
];
