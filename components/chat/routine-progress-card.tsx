"use client";
/**
 * RoutineProgressCard — renders Customer 360 (and other multi-step routines)
 * as a SINGLE progress card instead of 10+ individual tool call cards.
 *
 * U1.1 Query Fatigue Safeguards: when a routine fires, show one card with
 * sub-steps instead of overwhelming the UI with individual tool calls.
 */
import { useMemo } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  ClockIcon,
  Loader2,
  UserIcon,
  WrenchIcon,
} from "lucide-react";

export interface RoutineStep {
  toolName: string;
  displayName: string;
  status: "pending" | "running" | "completed" | "error";
  summary?: string;
  toolCallId?: string;
}

interface RoutineProgressCardProps {
  routineName: string;
  routineDisplayName: string;
  steps: RoutineStep[];
  isComplete: boolean;
  color?: string;
  className?: string;
}

const ROUTINE_COLORS: Record<string, string> = {
  "Customer 360": "#7C3AED",
  "Billing Audit": "#0891B2",
  "Dispute Resolution": "#D97706",
  "Enrollment": "#059669",
  "Compliance Check": "#DC2626",
  "Default": "#6B7280",
};

export function RoutineProgressCard({
  routineName,
  routineDisplayName,
  steps,
  isComplete,
  color,
  className,
}: RoutineProgressCardProps) {
  const accentColor = color || ROUTINE_COLORS[routineDisplayName] || ROUTINE_COLORS["Default"];
  const completedSteps = steps.filter((s) => s.status === "completed").length;
  const totalSteps = steps.length;
  const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  const summary = useMemo(() => {
    if (isComplete) {
      const summarySteps = steps
        .filter((s) => s.summary)
        .map((s) => s.summary)
        .join("; ");
      return summarySteps || `Completed ${completedSteps}/${totalSteps} steps`;
    }
    return `${completedSteps}/${totalSteps} steps complete`;
  }, [isComplete, completedSteps, totalSteps, steps]);

  return (
    <Collapsible
      className={cn(
        "group not-prose mb-4 w-full rounded-md border overflow-hidden",
        className
      )}
      defaultOpen={!isComplete}
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Color accent bar */}
          <div
            className="w-1 self-stretch rounded-full shrink-0"
            style={{ backgroundColor: accentColor }}
          />
          <div className="flex items-center gap-2 min-w-0">
            <UserIcon className="size-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">
                  {routineDisplayName}
                </span>
                {!isComplete && (
                  <Loader2 className="size-3.5 animate-spin text-muted-foreground shrink-0" />
                )}
                {isComplete && (
                  <CheckCircleIcon className="size-3.5 text-green-600 shrink-0" />
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">{summary}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {/* Progress bar */}
          <div className="hidden sm:flex items-center gap-1.5">
            <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progress}%`,
                  backgroundColor: accentColor,
                }}
              />
            </div>
            <span className="text-[11px] text-muted-foreground tabular-nums w-8 text-right">
              {progress}%
            </span>
          </div>
          <ChevronDownIcon className="size-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="border-t">
        <div className="divide-y divide-border/30">
          {steps.map((step, i) => (
            <div
              key={step.toolCallId || `step-${i}`}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                step.status === "running" && "bg-muted/30"
              )}
            >
              {/* Step status icon */}
              <div className="shrink-0">
                {step.status === "completed" && (
                  <CheckCircleIcon className="size-4 text-green-600" />
                )}
                {step.status === "running" && (
                  <Loader2 className="size-4 animate-spin text-primary" />
                )}
                {step.status === "error" && (
                  <div className="size-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <span className="text-[10px] text-red-600 font-bold">!</span>
                  </div>
                )}
                {step.status === "pending" && (
                  <ClockIcon className="size-4 text-muted-foreground/40" />
                )}
              </div>

              {/* Step name */}
              <span
                className={cn(
                  "flex-1 truncate",
                  step.status === "completed" && "text-muted-foreground",
                  step.status === "running" && "font-medium",
                  step.status === "pending" && "text-muted-foreground/50"
                )}
              >
                {step.displayName}
              </span>

              {/* Step summary */}
              {step.summary && (
                <span className="text-xs text-muted-foreground truncate max-w-[200px] hidden md:inline">
                  {step.summary}
                </span>
              )}

              {/* Wrench icon for completed steps */}
              <WrenchIcon className="size-3 text-muted-foreground/30 shrink-0" />
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
