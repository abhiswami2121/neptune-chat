/**
 * lib/sentiment/detector.ts
 * U4.1 — Lightweight keyword-based sentiment detection for in-session self-healing.
 *
 * Detects user frustration / workflow failure signals from chat messages.
 * Used by: playbook-mod-proposal system, annotation loop.
 *
 * Design:
 * - Zero external dependencies (no NLP libraries)
 * - Configurable thresholds
 * - Returns structured SentimentResult with trigger details
 * - Intended for in-session use only (not stored beyond annotation)
 */

/** Severity levels for detected sentiment triggers */
export type SentimentLevel = "none" | "low" | "medium" | "high";

/** Structured result from sentiment detection */
export interface SentimentResult {
  /** Aggregated severity level */
  level: SentimentLevel;
  /** Overall sentiment score (-1.0 to 1.0, negative = frustration) */
  score: number;
  /** Which keyword categories were triggered */
  triggers: SentimentTrigger[];
  /** The specific keyword matches found */
  matches: string[];
  /** Whether this should trigger a self-healing proposal */
  shouldProposeMod: boolean;
  /** Template suggestion for the proposal if shouldProposeMod is true */
  proposalSuggestion?: string;
  /** Which domain/playbook this likely relates to */
  suggestedDomain?: string;
}

export interface SentimentTrigger {
  category: SentimentCategory;
  keywords: string[];
  weight: number;
}

export type SentimentCategory =
  | "error"
  | "frustration"
  | "broken"
  | "urgent"
  | "confusion"
  | "retry"
  | "negative_outcome";

// ── Keyword Lexicon ──────────────────────────────────────────────────────────

const KEYWORD_LEXICON: Record<SentimentCategory, { keywords: string[]; weight: number }> = {
  error: {
    keywords: [
      "error",
      "failed",
      "failure",
      "exception",
      "crash",
      "crashed",
      "timeout",
      "timed out",
      "500",
      "502",
      "503",
      "403",
      "401",
      "rate limit",
      "rate limited",
      "throttled",
      "rejected",
      "invalid",
      "malformed",
      "corrupt",
      "syntax error",
      "type error",
      "reference error",
      "undefined is not",
      "cannot read",
      "cannot find",
      "unexpected token",
      "unexpected end",
      "econnrefused",
      "eaddrinuse",
      "enotfound",
      "eaccess",
      "eperm",
      "enoent",
      "certificate",
    ],
    weight: 0.8,
  },
  frustration: {
    keywords: [
      "again",
      "still",
      "another",
      "come on",
      "seriously",
      "waste",
      "wasting",
      "useless",
      "terrible",
      "awful",
      "bad",
      "worst",
      "frustrat",
      "annoying",
      "ridiculous",
      "stupid",
      "wtf",
      "ffs",
      "sigh",
      "facepalm",
      "unbelievable",
      "unacceptable",
      "garbage",
      "trash",
      "nonsense",
      "every time",
    ],
    weight: 0.6,
  },
  broken: {
    keywords: [
      "broken",
      "not working",
      "doesn't work",
      "does not work",
      "won't work",
      "doesn't do",
      "does nothing",
      "broke",
      "break",
      "busted",
      "messed up",
      "screwed",
      "ruined",
      "destroyed",
      "dead",
      "died",
      "down",
      "offline",
      "stop working",
      "stopped working",
      "hasn't worked",
      "never works",
    ],
    weight: 0.9,
  },
  urgent: {
    keywords: [
      "urgent",
      "asap",
      "emergency",
      "critical",
      "blocker",
      "blocking",
      "showstopper",
      "production down",
      "prod down",
      "customer affected",
      "customer impact",
      "revenue loss",
      "data loss",
      "security",
      "breach",
      "p0",
      "p1",
      "severe",
      "immediately",
      "right now",
      "without delay",
      "cannot proceed",
      "stuck",
      "blocked",
      "halt",
      "halted",
    ],
    weight: 0.7,
  },
  confusion: {
    keywords: [
      "confused",
      "don't understand",
      "do not understand",
      "makes no sense",
      "doesn't make sense",
      "what happened",
      "why did",
      "why is",
      "how come",
      "what went wrong",
      "what's wrong",
      "whats wrong",
      "what is going on",
      "what's going on",
      "whats going on",
      "wrong direction",
      "off track",
      "lost",
      "going in circles",
      "round and round",
      "looping",
    ],
    weight: 0.4,
  },
  retry: {
    keywords: [
      "retry",
      "retried",
      "retrying",
      "try again",
      "tried again",
      "trying again",
      "attempt",
      "attempted",
      "re-attempt",
      "second attempt",
      "third attempt",
      "multiple attempts",
      "multiple tries",
      "over and over",
      "keep trying",
      "repeated",
      "repeat",
      "again and again",
      "still failing",
      "still not",
      "still broken",
      "still error",
    ],
    weight: 0.7,
  },
  negative_outcome: {
    keywords: [
      "didn't work",
      "did not work",
      "no luck",
      "unsuccessful",
      "didn't help",
      "did not help",
      "made it worse",
      "worse",
      "regression",
      "setback",
      "back to square",
      "starting over",
      "from scratch",
      "redo",
      "revert",
      "rollback",
      "rolled back",
      "undid",
      "undone",
      "broke more",
      "broke other",
      "side effect",
      "cascade",
      "chain reaction",
    ],
    weight: 0.6,
  },
};

// ── Domain-to-keyword mapping for suggesting relevant playbooks ──────────────

const DOMAIN_SIGNALS: Record<string, string[]> = {
  billing: [
    "charge", "payment", "billing", "card", "nmi", "subscription", "decline",
    "refund", "transaction", "vault", "invoice", "cvv", "225",
  ],
  "customer-support": [
    "customer", "ticket", "support", "triage", "complaint", "360",
  ],
  disputes: [
    "dispute", "credit", "bureau", "fcra", "negative", "delete", "challenge",
  ],
  engineering: [
    "code", "build", "deploy", "commit", "branch", "merge", "pr",
    "bug", "debug", "compile", "lint", "test", "type",
  ],
  "agent-orchestration": [
    "agent", "dispatch", "workflow", "skill", "routine", "playbook",
    "orchestrat", "spawn", "sandbox",
  ],
  "vps-ops": [
    "vps", "server", "cpu", "memory", "disk", "nginx", "pm2",
    "cert", "ssl", "domain", "dns",
  ],
  reporting: [
    "report", "analytics", "metrics", "dashboard", "query", "stats",
  ],
  marketing: [
    "campaign", "dialer", "sms", "email", "blast", "nurture",
  ],
};

// ── Detection Function ───────────────────────────────────────────────────────

/**
 * Counts keyword matches in a message, case-insensitive.
 * Returns matches count per category.
 */
function countMatches(
  message: string,
  keywords: string[]
): { count: number; matches: string[] } {
  const lower = message.toLowerCase();
  let count = 0;
  const matches: string[] = [];

  for (const kw of keywords) {
    if (lower.includes(kw.toLowerCase())) {
      count++;
      matches.push(kw);
    }
  }

  return { count, matches };
}

/**
 * Maps aggregate score to a severity level.
 */
function scoreToLevel(score: number): SentimentLevel {
  if (score <= -0.7) return "high";
  if (score <= -0.4) return "medium";
  if (score <= -0.15) return "low";
  return "none";
}

/**
 * Suggests a most likely domain based on keyword overlap.
 */
function suggestDomain(message: string): string | undefined {
  const lower = message.toLowerCase();
  let bestDomain: string | undefined;
  let bestScore = 0;

  for (const [domain, keywords] of Object.entries(DOMAIN_SIGNALS)) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestDomain = domain;
    }
  }

  return bestScore >= 2 ? bestDomain : undefined;
}

/**
 * Generates a proposal suggestion based on detected triggers.
 */
function generateProposalSuggestion(
  triggers: SentimentTrigger[],
  domain?: string
): string {
  const errorTriggers = triggers.filter((t) => t.category === "error");
  const brokenTriggers = triggers.filter((t) => t.category === "broken");
  const retryTriggers = triggers.filter((t) => t.category === "retry");

  if (errorTriggers.length > 0 && retryTriggers.length > 0) {
    return domain
      ? `Routine in '${domain}' playbook failed repeatedly due to errors. Consider updating anti-patterns or adding error-specific safeguards.`
      : "Routine failed repeatedly due to errors. Consider updating the relevant playbook's anti-patterns with error handling rules.";
  }

  if (brokenTriggers.length > 0) {
    return domain
      ? `User reported broken functionality in '${domain}' domain. Review the playbook's toolbox entries and verify connector health.`
      : "User reported broken functionality. Review the relevant playbook's toolbox and verify connector availability.";
  }

  if (errorTriggers.length > 0) {
    return domain
      ? `Errors detected in '${domain}' execution. Consider adding error-specific recovery routines to the playbook.`
      : "Errors detected in execution. Consider adding error-specific recovery routines to the relevant playbook.";
  }

  return domain
    ? `Multiple issues detected in '${domain}' domain. Review playbook for gaps in safeguards or operational knowledge.`
    : "Multiple execution issues detected. Review the relevant playbook for gaps.";
}

// ── Main Export ──────────────────────────────────────────────────────────────

/**
 * Detects sentiment from a user message and determines if a self-healing
 * proposal should be made.
 *
 * @param message - The user's chat message to analyze
 * @param sessionErrorCount - Number of errors seen in this session so far
 * @returns Structured SentimentResult
 */
export function detectSentiment(
  message: string,
  sessionErrorCount: number = 0
): SentimentResult {
  const triggers: SentimentTrigger[] = [];
  const allMatches: string[] = [];
  let weightedScore = 0;

  for (const [category, config] of Object.entries(KEYWORD_LEXICON)) {
    const { count, matches } = countMatches(message, config.keywords);

    if (count > 0) {
      triggers.push({
        category: category as SentimentCategory,
        keywords: matches,
        weight: config.weight,
      });
      allMatches.push(...matches);
      weightedScore += config.weight * count;
    }
  }

  // Normalize score to [-1, 0] range
  const maxPossibleScore = Math.max(weightedScore, 1);
  const score = -Math.min(weightedScore / (maxPossibleScore + 3), 1.0);

  const level = scoreToLevel(score);

  // Only propose a mod if:
  // - Medium or high severity sentiment
  // - OR at least 2+ error/failure/broken triggers
  // - OR session has seen 3+ errors
  const errorBrokenRetryCount = triggers.filter((t) =>
    ["error", "broken", "retry", "negative_outcome"].includes(t.category)
  ).length;

  const shouldProposeMod =
    level === "high" ||
    (level === "medium" && errorBrokenRetryCount >= 2) ||
    sessionErrorCount >= 3;

  const suggestedDomain = suggestDomain(message);

  const result: SentimentResult = {
    level,
    score,
    triggers,
    matches: allMatches,
    shouldProposeMod,
    suggestedDomain,
  };

  if (shouldProposeMod) {
    result.proposalSuggestion = generateProposalSuggestion(
      triggers,
      suggestedDomain
    );
  }

  return result;
}

/**
 * Quick check: does this message contain ANY negative sentiment?
 * Much cheaper than full detection — use for filtering.
 */
export function hasNegativeSentiment(message: string): boolean {
  const lower = message.toLowerCase();
  const quickNegativeWords = [
    "broken", "not working", "error", "failed", "wrong", "fix this",
    "doesn't work", "crash", "bug", "broke", "stuck",
  ];
  return quickNegativeWords.some((w) => lower.includes(w));
}

/**
 * Analyzes a session's annotation history to detect cross-session failure patterns.
 * Used by digest cron to surface repeat issues.
 */
export function detectRepeatFailures(
  recentAnnotations: Array<{ playbook: string; skillOrWorkflow: string; outcome: string; error?: string }>,
  threshold: number = 2
): Array<{ playbook: string; routine: string; failures: number; lastError?: string }> {
  const failureMap = new Map<string, { failures: number; lastError?: string }>();

  for (const ann of recentAnnotations) {
    if (ann.outcome === "failure") {
      const key = `${ann.playbook}::${ann.skillOrWorkflow}`;
      const existing = failureMap.get(key) || { failures: 0 };
      existing.failures++;
      existing.lastError = ann.error;
      failureMap.set(key, existing);
    }
  }

  return Array.from(failureMap.entries())
    .filter(([, v]) => v.failures >= threshold)
    .map(([key, v]) => {
      const [playbook, routine] = key.split("::");
      return { playbook, routine, failures: v.failures, lastError: v.lastError };
    });
}
