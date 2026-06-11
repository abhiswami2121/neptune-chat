"use client";
/**
 * ToolCallGrouper — groups consecutive same-tool calls in a message's parts
 * and auto-collapses after a configurable threshold.
 *
 * U1.1 Query Fatigue Safeguards: when the same tool fires 3+ times within
 * a short window, calls 3+ auto-collapse into a summary card.
 * First 2 calls render normally. User can click to expand if curious.
 *
 * Also handles Routine Progress single-card rendering for Customer 360 routines.
 */
import { useMemo, useState, type ReactNode } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { LayersIcon, ChevronDownIcon } from "lucide-react";

export interface ToolPartLike {
  type: string;
  toolCallId?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  index?: number;
}

export interface ToolCallGroup {
  toolName: string;
  displayName: string;
  parts: ToolPartLike[];
  /** Whether this group exceeds the auto-collapse threshold */
  isCollapsed: boolean;
  /** Max parts to show before collapsing (default 2) */
  collapseAfter: number;
  /** Display priority from tool config: high | normal | low */
  displayPriority: "high" | "normal" | "low";
}

/**
 * Configuration for tool display behavior, keyed by tool name pattern.
 * Can be extended dynamically from connector manifests.
 */
export interface ToolDisplayConfig {
  displayPriority: "high" | "normal" | "low";
  autoCollapseAfter: number; // 0 = never collapse
}

/** Default config for most tools */
const DEFAULT_DISPLAY_CONFIG: ToolDisplayConfig = {
  displayPriority: "normal",
  autoCollapseAfter: 0, // never auto-collapse by default
};

/**
 * Tools that are known to fire rapidly and should be treated as low-priority.
 * These are query/read-heavy tools. Updated dynamically from connector manifests.
 */
const LOW_PRIORITY_TOOL_PATTERNS = new Set([
  "queryEntity",
  "countEntity",
  "queryDatabase",
  "b44_query",
  "b44_count",
  "b44_stream",
  "query_warehouse",
  "validated_query",
  "reportingHub",
]);

/**
 * Tools that are part of a routine and should be grouped under a routine card.
 */
const ROUTINE_TOOL_PATTERNS: Record<string, { routine: string; color: string }> = {
  "customer360": { routine: "Customer 360", color: "#7C3AED" },
  "base44.customer360": { routine: "Customer 360", color: "#7C3AED" },
  "cross_system_lookup": { routine: "Customer 360", color: "#7C3AED" },
  "b44_customer_360": { routine: "Customer 360", color: "#7C3AED" },
};

/** Track tool call timestamps for density calculation */
const toolCallTimestamps: Map<string, number[]> = new Map();

/** Record a tool call for density tracking */
export function recordToolCall(toolName: string): void {
  const now = Date.now();
  const timestamps = toolCallTimestamps.get(toolName) || [];
  timestamps.push(now);
  // Keep only last 60 seconds
  const cutoff = now - 60_000;
  const recent = timestamps.filter((t) => t > cutoff);
  toolCallTimestamps.set(toolName, recent);
}

/** Get tool call density (calls per minute) */
export function getToolCallDensity(): { callsPerMinute: number; highActivity: boolean } {
  const now = Date.now();
  const cutoff = now - 60_000;
  let total = 0;
  for (const [, timestamps] of toolCallTimestamps) {
    total += timestamps.filter((t) => t > cutoff).length;
  }
  return {
    callsPerMinute: total,
    highActivity: total > 15,
  };
}

/**
 * Resolve the display config for a given tool name.
 */
export function getToolDisplayConfig(toolName: string): ToolDisplayConfig {
  const baseName = toolName.includes(".")
    ? toolName.split(".").slice(1).join(".")
    : toolName;

  if (LOW_PRIORITY_TOOL_PATTERNS.has(baseName)) {
    return {
      displayPriority: "low",
      autoCollapseAfter: 2,
    };
  }

  return DEFAULT_DISPLAY_CONFIG;
}

/**
 * Check if a tool is part of a recognized routine.
 */
export function getToolRoutine(toolName: string): { routine: string; color: string } | null {
  const baseName = toolName.includes(".")
    ? toolName.split(".").slice(1).join(".")
    : toolName;
  return ROUTINE_TOOL_PATTERNS[baseName] || ROUTINE_TOOL_PATTERNS[toolName] || null;
}

/**
 * Group consecutive same-tool parts within a message's parts array.
 * Non-tool parts break groups. Each group of same-tool calls gets a summary.
 */
export function groupToolCalls(
  parts: ToolPartLike[]
): Array<{ kind: "tool-group"; group: ToolCallGroup } | { kind: "single"; part: ToolPartLike; config: ToolDisplayConfig; routine: { routine: string; color: string } | null }> {
  const result: Array<
    | { kind: "tool-group"; group: ToolCallGroup }
    | { kind: "single"; part: ToolPartLike; config: ToolDisplayConfig; routine: { routine: string; color: string } | null }
  > = [];

  let i = 0;
  while (i < parts.length) {
    const part = parts[i];
    const type = part.type;

    // Only group tool-* parts
    if (!type || !type.startsWith("tool-")) {
      result.push({
        kind: "single",
        part,
        config: DEFAULT_DISPLAY_CONFIG,
        routine: null,
      });
      i++;
      continue;
    }

    const toolName = type.replace("tool-", "");
    const config = getToolDisplayConfig(toolName);
    const routine = getToolRoutine(toolName);

    // Check if next parts are same tool
    let j = i + 1;
    while (j < parts.length && parts[j].type === type) {
      j++;
    }

    const groupSize = j - i;

    if (groupSize >= 3 && config.autoCollapseAfter > 0) {
      // Group collapse
      const groupParts = parts.slice(i, j).map((p, idx) => ({ ...p, index: idx }));
      const displayName = toolName
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (s) => s.toUpperCase())
        .replace(/V 2/g, "V2")
        .replace(/Prd/g, "PRD")
        .replace(/Url/g, "URL")
        .replace(/Mcp/g, "MCP")
        .trim();

      result.push({
        kind: "tool-group",
        group: {
          toolName,
          displayName,
          parts: groupParts,
          isCollapsed: true,
          collapseAfter: config.autoCollapseAfter,
          displayPriority: config.displayPriority,
        },
      });
      i = j;
    } else {
      // Render individually
      for (let k = i; k < j; k++) {
        result.push({
          kind: "single",
          part: parts[k],
          config,
          routine,
        });
      }
      i = j;
    }
  }

  return result;
}

// ── Collapsed Tool Group UI Component ──────────────────────────────────

interface CollapsedToolGroupProps {
  group: ToolCallGroup;
  renderPart: (part: ToolPartLike) => ReactNode;
}

export function CollapsedToolGroup({ group, renderPart }: CollapsedToolGroupProps) {
  const [expanded, setExpanded] = useState(false);
  const { toolName, displayName, parts, collapseAfter } = group;

  const visibleParts = parts.slice(0, collapseAfter);
  const hiddenParts = parts.slice(collapseAfter);
  const isLowPriority = group.displayPriority === "low";

  return (
    <div className="space-y-2" data-tool-group={toolName}>
      {/* First N parts render normally */}
      {visibleParts.map((part) => (
        <div key={part.toolCallId || `tool-${part.index}`}>
          {renderPart(part)}
        </div>
      ))}

      {/* Collapsed summary card */}
      <Collapsible
        open={expanded}
        onOpenChange={setExpanded}
        className={cn(
          "group not-prose rounded-md border",
          isLowPriority
            ? "border-muted/50 bg-muted/20"
            : "border-amber-200/50 bg-amber-50/20 dark:border-amber-800/30 dark:bg-amber-950/20"
        )}
      >
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-3 text-xs">
          <div className="flex items-center gap-2">
            <LayersIcon
              className={cn(
                "size-3.5",
                isLowPriority ? "text-muted-foreground" : "text-amber-600"
              )}
            />
            <span className="font-medium text-muted-foreground">
              {hiddenParts.length} more{" "}
              <span className="text-foreground/80">{displayName}</span> calls
              {isLowPriority && (
                <span className="ml-1.5 text-[10px] text-muted-foreground/60">
                  (auto-collapsed)
                </span>
              )}
            </span>
          </div>
          <ChevronDownIcon
            className={cn(
              "size-3.5 text-muted-foreground transition-transform duration-200",
              expanded && "rotate-180"
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 px-3 pb-3 pt-0">
          {hiddenParts.map((part) => (
            <div key={part.toolCallId || `tool-collapsed-${part.index}`}>
              {renderPart(part)}
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ── Tool Call Density Gauge ────────────────────────────────────────────

interface ToolCallDensityGaugeProps {
  className?: string;
}

export function ToolCallDensityGauge({ className }: ToolCallDensityGaugeProps) {
  const density = getToolCallDensity();
  if (!density.highActivity) return null;

  const level = density.callsPerMinute > 30 ? "very_high" : "high";

  return (
    <div
      className={cn(
        "rounded-md border px-2.5 py-1 text-[11px]",
        level === "very_high"
          ? "border-red-200/60 bg-red-50/40 text-red-700 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-400"
          : "border-amber-200/60 bg-amber-50/40 text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-400",
        className
      )}
    >
      {level === "very_high"
        ? `⚠️ High tool activity (${density.callsPerMinute}/min) — auto-batching active`
        : `Tool activity: ${density.callsPerMinute}/min`}
    </div>
  );
}
