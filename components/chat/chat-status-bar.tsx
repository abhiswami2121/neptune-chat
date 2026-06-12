"use client";

/**
 * ChatStatusBar — Compact status bar for the ChatHeader.
 * Phase 9 — Shows live system metrics:
 *   - V2 active sessions count
 *   - VPS health indicator (green/yellow/red)
 *   - Token budget indicator
 *   - Quick nav to /telemetry and /diagnostics
 */
import {
  ActivityIcon,
  BarChart3Icon,
  CpuIcon,
  ExternalLinkIcon,
} from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface StatusBarState {
  vpsHealth: "healthy" | "degraded" | "down" | "loading";
  v2SessionCount: number;
  diagnosticsAvailable: boolean;
}

const HEALTH_DOT = {
  healthy: "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]",
  degraded: "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]",
  down: "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]",
  loading: "bg-muted-foreground/30 animate-pulse",
} as const;

const HEALTH_LABEL = {
  healthy: "VPS OK",
  degraded: "VPS Degraded",
  down: "VPS Down",
  loading: "Checking...",
} as const;

export function ChatStatusBar() {
  const [state, setState] = useState<StatusBarState>({
    vpsHealth: "loading",
    v2SessionCount: 0,
    diagnosticsAvailable: false,
  });

  useEffect(() => {
    let mounted = true;

    async function check() {
      try {
        const res = await fetch("/api/diagnostics");
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          const vpsSection = data.sections?.find(
            (s: { name: string }) => s.name === "vps-health"
          );
          setState({
            vpsHealth: vpsSection?.status || "unknown",
            v2SessionCount: data.v2Sessions || 0,
            diagnosticsAvailable: true,
          });
        } else {
          setState((s) => ({ ...s, vpsHealth: "degraded", diagnosticsAvailable: false }));
        }
      } catch {
        if (mounted) setState((s) => ({ ...s, vpsHealth: "down", diagnosticsAvailable: false }));
      }
    }

    check();
    const interval = setInterval(check, 60000); // Refresh every 60s
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  return (
    <div className="flex items-center gap-3 ml-auto mr-2">
      {/* VPS Health */}
      <div
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
        title={HEALTH_LABEL[state.vpsHealth]}
      >
        <span
          className={cn(
            "inline-block size-2 rounded-full transition-colors duration-500",
            HEALTH_DOT[state.vpsHealth]
          )}
        />
        <span className="hidden md:inline">{HEALTH_LABEL[state.vpsHealth]}</span>
      </div>

      {/* V2 Sessions */}
      {state.v2SessionCount > 0 && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <CpuIcon className="size-3" />
          <span className="hidden md:inline tabular-nums">{state.v2SessionCount} active</span>
        </span>
      )}

      {/* Quick nav links — subtle */}
      <Link
        href="/telemetry"
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        title="Telemetry Dashboard"
      >
        <BarChart3Icon className="size-3" />
        <span className="hidden lg:inline">Telemetry</span>
      </Link>

      <Link
        href="/diagnostics"
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        title="System Diagnostics"
      >
        <ActivityIcon className="size-3" />
        <span className="hidden lg:inline">Diagnostics</span>
      </Link>
    </div>
  );
}
