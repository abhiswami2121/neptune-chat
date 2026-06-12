/**
 * annotation-collector.ts
 * Captures execution outcomes and appends learnings to playbooks.
 * PB-D: After every run_workflow/execute_skill, this collects outcome data.
 *
 * Phase 8 — Neptune Custom Functions
 */

export interface Annotation {
  id: string;
  timestamp: string;
  domain: string;
  playbook: string;
  skillOrWorkflow: string;
  outcome: "success" | "partial" | "failure";
  durationMs: number;
  error?: string;
  learning?: string;
  toolsUsed: string[];
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
