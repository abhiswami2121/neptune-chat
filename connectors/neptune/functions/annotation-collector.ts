/**
 * annotation-collector.ts
 * Captures execution outcomes and appends learnings to playbooks.
 * PB-D: After every run_workflow/execute_skill, this collects outcome data.
 *
 * Phase 8 — Neptune Custom Functions
 * U4.1 — Extended with sentiment tracking + in_session_mod type
 */

/** The type of annotation — execution outcome or self-healing event */
export type AnnotationType = "execution" | "in_session_mod" | "sentiment";

export interface Annotation {
  id: string;
  timestamp: string;
  /** The type of annotation */
  type?: AnnotationType;
  domain: string;
  playbook: string;
  skillOrWorkflow: string;
  outcome: "success" | "partial" | "failure";
  durationMs: number;
  error?: string;
  learning?: string;
  toolsUsed: string[];
  /** U4.1: Sentiment data captured during execution */
  sentiment?: {
    level: "none" | "low" | "medium" | "high";
    score: number;
    triggers: string[];
  };
  /** U4.1: For in_session_mod annotations — the proposal ID */
  proposalId?: string;
  /** U4.1: Whether this annotation triggered a self-healing proposal */
  triggeredSelfHealing?: boolean;
}

export interface AnnotationSummary {
  domain: string;
  totalExecutions: number;
  successRate: number;
  avgDurationMs: number;
  topErrors: Array<{ error: string; count: number }>;
  topLearnings: string[];
}

let annotations: Annotation[] = [];

export function collectAnnotation(annotation: Omit<Annotation, "id" | "timestamp">): Annotation {
  const record: Annotation = {
    ...annotation,
    id: `annot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  };
  annotations.push(record);
  return record;
}

export function getAnnotations(options?: {
  domain?: string;
  since?: string;
  limit?: number;
}): Annotation[] {
  let results = [...annotations];
  if (options?.domain) {
    results = results.filter((a) => a.domain === options.domain);
  }
  if (options?.since) {
    results = results.filter((a) => a.timestamp >= options.since!);
  }
  results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  if (options?.limit) {
    results = results.slice(0, options.limit);
  }
  return results;
}

export function getAnnotationSummary(domain?: string): AnnotationSummary[] {
  const target = domain ? annotations.filter((a) => a.domain === domain) : annotations;
  const byDomain = new Map<string, Annotation[]>();
  for (const a of target) {
    const list = byDomain.get(a.domain) || [];
    list.push(a);
    byDomain.set(a.domain, list);
  }

  return Array.from(byDomain.entries()).map(([dom, anns]) => {
    const successes = anns.filter((a) => a.outcome === "success").length;
    const errors = anns
      .filter((a) => a.error)
      .reduce((acc, a) => {
        const key = a.error!.slice(0, 80);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    return {
      domain: dom,
      totalExecutions: anns.length,
      successRate: anns.length > 0 ? Math.round((successes / anns.length) * 100) : 0,
      avgDurationMs: anns.length > 0 ? Math.round(anns.reduce((s, a) => s + a.durationMs, 0) / anns.length) : 0,
      topErrors: Object.entries(errors)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([error, count]) => ({ error, count })),
      topLearnings: anns
        .filter((a) => a.learning)
        .slice(0, 5)
        .map((a) => a.learning!),
    };
  });
}

export function clearAnnotations(): void {
  annotations = [];
}

// ── U4.1: Self-Healing Extended Functions ────────────────────────────────────

/**
 * Collect an in-session playbook modification annotation.
 * Used by propose-mod, approve-mod, and revert-mod APIs.
 */
export function collectModAnnotation(params: {
  domain: string;
  playbook: string;
  action: "proposed" | "approved" | "rejected" | "reverted";
  proposalId: string;
  reason: string;
  diffLineCount?: number;
  sentiment?: Annotation["sentiment"];
}): Annotation {
  return collectAnnotation({
    type: "in_session_mod",
    domain: params.domain,
    playbook: params.playbook,
    skillOrWorkflow: `self-healing:${params.action}-mod`,
    outcome: params.action === "rejected" || params.action === "reverted" ? "partial" : "success",
    durationMs: 0,
    learning: `Mod ${params.action}: ${params.reason}${params.diffLineCount ? ` (${params.diffLineCount} lines)` : ""}`,
    toolsUsed: ["sentiment-detector", "playbook-writer", "diff-engine"],
    proposalId: params.proposalId,
    sentiment: params.sentiment,
    triggeredSelfHealing: true,
  });
}

/**
 * Collect a sentiment-only annotation (no proposal triggered).
 */
export function collectSentimentAnnotation(params: {
  domain: string;
  message: string;
  level: "none" | "low" | "medium" | "high";
  score: number;
  triggers: string[];
}): Annotation {
  return collectAnnotation({
    type: "sentiment",
    domain: params.domain,
    playbook: "PLAYBOOK-ROUTER.md",
    skillOrWorkflow: "sentiment-detector",
    outcome: params.level === "high" ? "failure" : params.level === "medium" ? "partial" : "success",
    durationMs: 0,
    learning: `Sentiment detected: ${params.level} (score: ${params.score.toFixed(2)})`,
    toolsUsed: ["sentiment-detector"],
    sentiment: {
      level: params.level,
      score: params.score,
      triggers: params.triggers,
    },
    triggeredSelfHealing: params.level === "high" || params.level === "medium",
  });
}

/**
 * Get annotations of a specific type.
 */
export function getAnnotationsByType(
  type: AnnotationType,
  options?: { domain?: string; since?: string; limit?: number }
): Annotation[] {
  let results = annotations.filter((a) => a.type === type);
  if (options?.domain) {
    results = results.filter((a) => a.domain === options.domain);
  }
  if (options?.since) {
    results = results.filter((a) => a.timestamp >= options.since!);
  }
  results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  if (options?.limit) {
    results = results.slice(0, options.limit);
  }
  return results;
}

/**
 * Get self-healing statistics from in_session_mod annotations.
 */
export function getSelfHealingStats(): {
  totalProposals: number;
  approved: number;
  rejected: number;
  reverted: number;
  byDomain: Record<string, { proposed: number; approved: number; rejected: number }>;
} {
  const mods = annotations.filter((a) => a.type === "in_session_mod");
  const byDomain: Record<string, { proposed: number; approved: number; rejected: number }> = {};

  for (const mod of mods) {
    const d = byDomain[mod.domain] || { proposed: 0, approved: 0, rejected: 0 };
    if (mod.skillOrWorkflow.includes("proposed")) d.proposed++;
    if (mod.skillOrWorkflow.includes("approved")) d.approved++;
    if (mod.skillOrWorkflow.includes("rejected")) d.rejected++;
    byDomain[mod.domain] = d;
  }

  return {
    totalProposals: mods.filter((a) => a.skillOrWorkflow.includes("proposed")).length,
    approved: mods.filter((a) => a.skillOrWorkflow.includes("approved")).length,
    rejected: mods.filter((a) => a.skillOrWorkflow.includes("rejected")).length,
    reverted: mods.filter((a) => a.skillOrWorkflow.includes("reverted")).length,
    byDomain,
  };
}
