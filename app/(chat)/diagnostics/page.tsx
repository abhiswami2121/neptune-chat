/**
 * /diagnostics — System Health Dashboard
 * Phase 9 — Real-time system diagnostics with health indicators.
 *
 * Shows:
 *   - Overall system status (healthy / degraded / down)
 *   - VPS health: agent API reachable, disk, memory
 *   - Connector health: which connectors are configured
 *   - Telemetry health: invocation counts, error rates
 *   - Auto-refresh every 30s
 */
"use client";

import {
  CheckCircle2Icon,
  ClockIcon,
  CpuIcon,
  HardDriveIcon,
  MemoryStickIcon,
  RefreshCwIcon,
  ServerCrashIcon,
  ShieldAlertIcon,
  WifiIcon,
  XCircleIcon,
  AlertTriangleIcon,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface DiagnosticSection {
  status: "healthy" | "degraded" | "down" | "unknown";
  name: string;
  details: Record<string, unknown>;
  checkedAt: string;
}

interface DiagnosticsData {
  status: "healthy" | "degraded" | "down";
  timestamp: string;
  sections: DiagnosticSection[];
  summary: {
    healthy: number;
    degraded: number;
    down: number;
  };
}

const STATUS_ICONS = {
  healthy: CheckCircle2Icon,
  degraded: AlertTriangleIcon,
  down: XCircleIcon,
  unknown: ClockIcon,
} as const;

const STATUS_COLORS = {
  healthy: "text-emerald-500 bg-emerald-500/10",
  degraded: "text-amber-500 bg-amber-500/10",
  down: "text-red-500 bg-red-500/10",
  unknown: "text-muted-foreground bg-muted",
} as const;

function OverallBanner({ status }: { status: DiagnosticsData["status"] }) {
  const Icon = STATUS_ICONS[status];
  const colorClass = STATUS_COLORS[status];
  const labels = {
    healthy: "All Systems Operational",
    degraded: "System Degraded — Some Checks Failing",
    down: "System Down — Critical Failure",
  };

  return (
    <Card className={cn("border-2", status === "down" && "border-destructive")}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn("flex size-10 items-center justify-center rounded-full", colorClass)}>
            <Icon className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{labels[status]}</h2>
            <p className="text-sm text-muted-foreground">
              Last checked: {new Date().toLocaleTimeString()}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionCard({ section }: { section: DiagnosticSection }) {
  const Icon = STATUS_ICONS[section.status];
  const colorClass = STATUS_COLORS[section.status];
  const titleMap: Record<string, string> = {
    "vps-health": "VPS Health",
    "connector-health": "Connector Health",
    "telemetry-health": "Telemetry Health",
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <div className={cn("flex size-6 items-center justify-center rounded", colorClass)}>
              <Icon className="size-3.5" />
            </div>
            {titleMap[section.name] || section.name}
          </CardTitle>
          <Badge
            variant="outline"
            className={cn(
              "text-xs",
              section.status === "healthy" && "border-emerald-500/50 text-emerald-600",
              section.status === "degraded" && "border-amber-500/50 text-amber-600",
              section.status === "down" && "border-red-500/50 text-red-600"
            )}
          >
            {section.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {Object.entries(section.details).map(([key, value]) => {
            let displayValue = String(value);
            if (typeof value === "object" && value !== null) {
              displayValue = JSON.stringify(value).slice(0, 120);
            }

            return (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-mono">{key}</span>
                <span className="font-mono text-foreground/80 max-w-[60%] truncate">
                  {displayValue}
                </span>
              </div>
            );
          })}
          <div className="pt-2 text-[10px] text-muted-foreground text-right">
            Checked: {new Date(section.checkedAt).toLocaleTimeString()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DiagnosticsPage() {
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/diagnostics");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e?.message || "Failed to load diagnostics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/40 bg-background/80 p-4 backdrop-blur">
        <div>
          <h1 className="text-lg font-semibold">Diagnostics</h1>
          <p className="text-sm text-muted-foreground">
            System health and operational status
          </p>
        </div>
        <Button onClick={fetchData} size="sm" variant="outline" disabled={loading}>
          <RefreshCwIcon className={cn("size-3.5 mr-1.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="p-4 space-y-4">
        {loading && !data ? (
          <>
            <Skeleton className="h-20 w-full rounded-lg" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-40 rounded-lg" />
              ))}
            </div>
          </>
        ) : error ? (
          <Card className="border-destructive/50">
            <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : data ? (
          <>
            <OverallBanner status={data.status} />

            {/* Summary bar */}
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1">
                <CheckCircle2Icon className="size-3 text-emerald-500" />
                {data.summary.healthy} healthy
              </span>
              <span className="flex items-center gap-1">
                <AlertTriangleIcon className="size-3 text-amber-500" />
                {data.summary.degraded} degraded
              </span>
              <span className="flex items-center gap-1">
                <XCircleIcon className="size-3 text-red-500" />
                {data.summary.down} down
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {data.sections.map((section) => (
                <SectionCard key={section.name} section={section} />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
