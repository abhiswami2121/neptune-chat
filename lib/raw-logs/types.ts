/**
 * U7.2: Raw Log Type Definitions
 *
 * Schema for the raw log entry — immutable audit trail of every chat turn.
 * Written to Redis (hot, 24h TTL) + Postgres (cold, permanent).
 */

// ── Core Log Entry ────────────────────────────────────────────────────────

export interface RawLogEntry {
  id: string; // turnId (UUID)
  sessionId: string;
  timestamp: string; // ISO 8601
  userId: string;
  userMessage: string;
  systemPromptHash: string; // SHA-256 hash, not full prompt (privacy + space)
  loadedPlaybook?: string;
  loadedRoutine?: string;
  knowledgeQueries: KgQueryRecord[];
  toolCalls: ToolCallRecord[];
  reasoning: string; // chain of thought (redacted)
  finalResponse: string; // truncated to 8KB
  outcomes: TurnOutcome;
  annotations: string[];
  knowledgeUpdates: KgUpdateRecord[];
}

export interface KgQueryRecord {
  query: string;
  results: string[]; // entity IDs found
  durationMs?: number;
}

export interface ToolCallRecord {
  tool: string;
  input: unknown;
  output: unknown;
  durationMs: number;
  error?: string;
}

export interface TurnOutcome {
  success: boolean;
  durationMs: number;
  errors: ErrorRecord[];
}

export interface ErrorRecord {
  code?: string;
  message: string;
  tool?: string;
}

export interface KgUpdateRecord {
  entityId: string;
  change: string; // description of what changed
}

// ── API Types ──────────────────────────────────────────────────────────────

export interface RawLogQuery {
  sessionId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface RawLogStats {
  totalEntries: number;
  totalSessions: number;
  totalToolCalls: number;
  avgDurationMs: number;
  successRate: number;
  hotEntries: number; // in Redis
  coldEntries: number; // in Postgres
}

// ── Redactor Types ─────────────────────────────────────────────────────────

export interface RedactionRule {
  name: string;
  pattern: RegExp;
  replacement: string;
}

export interface RedactionResult {
  original: string;
  redacted: string;
  matchesFound: number;
  rules: string[];
}
