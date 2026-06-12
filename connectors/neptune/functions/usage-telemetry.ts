/**
 * usage-telemetry.ts
 * Tracks skill/function usage counts, durations, and error patterns.
 * Used by /capabilities UI and annotation loop for continuous improvement.
 *
 * Phase 9 — Wired to Upstash telemetry collector
 * Phase 8 — Initial function stub
 */

export interface TelemetryEntry {
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

const telemetry: Map<string, TelemetryEntry> = new Map();

function getKey(skillOrFunction: string, connector: string): string {
  return `${connector}:${skillOrFunction}`;
}

export function recordUsage(params: {
  skillOrFunction: string;
  connector: string;
  domain: string;
  durationMs: number;
  error?: string;
}): TelemetryEntry {
  const key = getKey(params.skillOrFunction, params.connector);
  const existing = telemetry.get(key);

  const entry: TelemetryEntry = existing
    ? {
        ...existing,
        invocationCount: existing.invocationCount + 1,
        totalDurationMs: existing.totalDurationMs + params.durationMs,
        lastDurationMs: params.durationMs,
        lastUsed: new Date().toISOString(),
        errorCount: params.error ? existing.errorCount + 1 : existing.errorCount,
        lastError: params.error || existing.lastError,
        avgDurationMs: Math.round((existing.totalDurationMs + params.durationMs) / (existing.invocationCount + 1)),
      }
    : {
        skillOrFunction: params.skillOrFunction,
        connector: params.connector,
        domain: params.domain,
        invocationCount: 1,
        totalDurationMs: params.durationMs,
        lastDurationMs: params.durationMs,
        lastUsed: new Date().toISOString(),
        errorCount: params.error ? 1 : 0,
        lastError: params.error,
        avgDurationMs: params.durationMs,
      };

  telemetry.set(key, entry);
  return entry;
}

export function getTelemetry(options?: {
  connector?: string;
  domain?: string;
  sortBy?: "invocationCount" | "avgDurationMs" | "errorCount";
  limit?: number;
}): TelemetryEntry[] {
  let entries = Array.from(telemetry.values());

  if (options?.connector) {
    entries = entries.filter((e) => e.connector === options.connector);
  }
  if (options?.domain) {
    entries = entries.filter((e) => e.domain === options.domain);
  }

  const sortBy = options?.sortBy || "invocationCount";
  entries.sort((a, b) => (b[sortBy] as number) - (a[sortBy] as number));

  return options?.limit ? entries.slice(0, options.limit) : entries;
}

export function getTelemetrySummary(): {
  totalInvocations: number;
  totalErrors: number;
  uniqueSkills: number;
  topSkill: string;
  errorRate: number;
} {
  const entries = Array.from(telemetry.values());
  const totalInvocations = entries.reduce((s, e) => s + e.invocationCount, 0);
  const totalErrors = entries.reduce((s, e) => s + e.errorCount, 0);
  const top = entries.sort((a, b) => b.invocationCount - a.invocationCount)[0];

  return {
    totalInvocations,
    totalErrors,
    uniqueSkills: entries.length,
    topSkill: top ? `${top.connector}:${top.skillOrFunction}` : "N/A",
    errorRate: totalInvocations > 0 ? Math.round((totalErrors / totalInvocations) * 10000) / 100 : 0,
  };
}
