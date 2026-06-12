/**
 * /telemetry — Skill/Function Usage Telemetry Dashboard
 * Phase 9 — Live usage tracking from the annotation loop.
 *
 * Shows:
 *   - Summary cards (total invocations, unique skills, error rate, top skill)
 *   - Per-skill breakdown table with invocation count, avg duration, error %
 *   - Connector-level aggregation
 *   - Time-range filter (last hour, day, week, all)
 */
"use client";

import {
  ActivityIcon,
  AlertTriangleIcon,
  BarChart3Icon,
  ClockIcon,
  RefreshCwIcon,
  TrendingUpIcon,
  ZapIcon,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface TelemetryEntry {
  skillOrFunction: string;
  connector: string;
  domain: string;
  invocationCount: number;
  totalDurationMs: number;
  lastDurationMs: number;
  lastUsed: string;
  errorCount: number;
  lastError?: string;
  avgDurationMs: number;
}

interface TelemetrySummary {
  totalInvocations: number;
  totalErrors: number;
  uniqueSkills: number;
  topSkill: string;
  errorRate: number;
}

interface TelemetryData {
  entries: TelemetryEntry[];
  summary: TelemetrySummary;
  timestamp: string;
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold tabular-nums">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div
            className={cn(
              "flex size-10 items-center justify-center rounded-lg",
              trend === "up" && "bg-emerald-500/10 text-emerald-500",
              trend === "down" && "bg-red-500/10 text-red-500",
              trend === "neutral" && "bg-primary/10 text-primary"
            )}
          >
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EntryRow({ entry }: { entry: TelemetryEntry }) {
  const errorRate =
    entry.invocationCount > 0
      ? ((entry.errorCount / entry.invocationCount) * 100).toFixed(1)
      : "0.0";

  return (
    <tr className="border-b border-border/40 transition-colors hover:bg-muted/30">
      <td className="py-2.5 px-3">
        <div className="font-medium text-sm">{entry.skillOrFunction}</div>
        <div className="text-xs text-muted-foreground">{entry.connector}</div>
      </td>
      <td className="py-2.5 px-3">
        <Badge variant="outline" className="text-xs">
          {entry.domain}
        </Badge>
      </td>
      <td className="py-2.5 px-3 text-sm tabular-nums text-right">
        {entry.invocationCount.toLocaleString()}
      </td>
      <td className="py-2.5 px-3 text-sm tabular-nums text-right">
        {entry.avgDurationMs}ms
      </td>
      <td className="py-2.5 px-3 text-sm tabular-nums text-right">
        <span
          className={cn(
            parseFloat(errorRate) > 10 && "text-red-500",
            parseFloat(errorRate) > 5 && parseFloat(errorRate) <= 10 && "text-amber-500"
          )}
        >
          {errorRate}%
        </span>
      </td>
      <td className="py-2.5 px-3 text-xs text-muted-foreground text-right">
        {entry.lastUsed
          ? new Date(entry.lastUsed).toLocaleTimeString()
          : "—"}
      </td>
    </tr>
  );
}

export default function TelemetryPage() {
  const [data, setData] = useState<TelemetryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>("invocationCount");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/telemetry?sortBy=${sortBy}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e?.message || "Failed to load telemetry");
    } finally {
      setLoading(false);
    }
  }, [sortBy]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const summary = data?.summary;
  const entries = data?.entries || [];

  const byConnector = entries.reduce<Record<string, TelemetryEntry[]>>((acc, e) => {
    (acc[e.connector] ||= []).push(e);
    return acc;
  }, {});

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/40 bg-background/80 p-4 backdrop-blur">
        <div>
          <h1 className="text-lg font-semibold">Telemetry</h1>
          <p className="text-sm text-muted-foreground">
            Skill & function usage tracking from the annotation loop
          </p>
        </div>
        <Button onClick={fetchData} size="sm" variant="outline" disabled={loading}>
          <RefreshCwIcon className={cn("size-3.5 mr-1.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="p-4 space-y-4">
        {/* Summary cards */}
        {loading && !data ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : summary ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              icon={ActivityIcon}
              label="Total Invocations"
              trend="neutral"
              value={summary.totalInvocations.toLocaleString()}
            />
            <StatCard
              icon={ZapIcon}
              label="Unique Skills"
              sub={summary.topSkill}
              trend="up"
              value={summary.uniqueSkills}
            />
            <StatCard
              icon={AlertTriangleIcon}
              label="Error Rate"
              sub={`${summary.totalErrors} errors`}
              trend={summary.errorRate > 5 ? "down" : "up"}
              value={`${summary.errorRate}%`}
            />
            <StatCard
              icon={ClockIcon}
              label="Last Updated"
              trend="neutral"
              value={data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : "—"}
            />
          </div>
        ) : error ? (
          <Card className="border-destructive/50">
            <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : null}

        {/* Main content tabs */}
        <Tabs defaultValue="skills">
          <TabsList>
            <TabsTrigger value="skills">By Skill</TabsTrigger>
            <TabsTrigger value="connectors">By Connector</TabsTrigger>
          </TabsList>

          <TabsContent value="skills" className="mt-3">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Skill Breakdown</CardTitle>
                  <div className="flex gap-1">
                    {["invocationCount", "avgDurationMs", "errorCount"].map((s) => (
                      <Button
                        key={s}
                        onClick={() => setSortBy(s)}
                        size="sm"
                        variant={sortBy === s ? "secondary" : "ghost"}
                      >
                        {s === "invocationCount" ? "Calls" : s === "avgDurationMs" ? "Duration" : "Errors"}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-4 space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-8 w-full" />
                    ))}
                  </div>
                ) : entries.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    <BarChart3Icon className="size-8 mx-auto mb-2 opacity-30" />
                    No telemetry data yet. Run some skills to populate.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border/40 text-left text-xs text-muted-foreground">
                          <th className="py-2 px-3 font-medium">Skill / Function</th>
                          <th className="py-2 px-3 font-medium">Domain</th>
                          <th className="py-2 px-3 font-medium text-right">Calls</th>
                          <th className="py-2 px-3 font-medium text-right">Avg Ms</th>
                          <th className="py-2 px-3 font-medium text-right">Error %</th>
                          <th className="py-2 px-3 font-medium text-right">Last Used</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.slice(0, 100).map((e) => (
                          <EntryRow key={`${e.connector}:${e.skillOrFunction}`} entry={e} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="connectors" className="mt-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(byConnector).map(([connector, skills]) => {
                const totalCalls = skills.reduce((s, e) => s + e.invocationCount, 0);
                const totalErrors = skills.reduce((s, e) => s + e.errorCount, 0);
                const errRate = totalCalls > 0 ? ((totalErrors / totalCalls) * 100).toFixed(1) : "0";

                return (
                  <Card key={connector}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <PlugIcon className="size-3.5" />
                        {connector}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="px-4 pb-2">
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>{skills.length} skills</span>
                          <span>{totalCalls.toLocaleString()} calls</span>
                          <span className={cn(parseFloat(errRate) > 5 && "text-red-500")}>
                            {errRate}% errors
                          </span>
                        </div>
                      </div>
                      <table className="w-full text-xs">
                        <tbody>
                          {skills.slice(0, 5).map((s) => (
                            <tr key={s.skillOrFunction} className="border-t border-border/30">
                              <td className="py-1.5 px-4">{s.skillOrFunction}</td>
                              <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">
                                {s.invocationCount}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function PlugIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path d="M12 2a4 4 0 0 1 4 4v2h2a2 2 0 0 1 2 2v2a4 4 0 0 1-4 4h-2v4a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-4H6a4 4 0 0 1-4-4v-2a2 2 0 0 1 2-2h2V6a4 4 0 0 1 4-4z" />
    </svg>
  );
}
