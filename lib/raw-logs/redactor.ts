/**
 * U7.2: Secret Redactor — strips API keys, tokens, and credentials from raw logs.
 *
 * Design: pattern-based regex matching. Runs BEFORE any log is written to storage.
 * Immutable rule: raw logs are NEVER modified after write, only redacted pre-write.
 */

import type { RedactionResult } from "./types";

// ── Redaction Rules ────────────────────────────────────────────────────────

const REDACTION_RULES: Array<{
  name: string;
  pattern: RegExp;
  replacement: string;
}> = [
  // API keys in standard formats
  {
    name: "bearer-token",
    pattern: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g,
    replacement: "Bearer [REDACTED]",
  },
  {
    name: "api-key-header",
    pattern: /(?:api[_-]?key|apikey|secret|token|password|auth)\s*[:=]\s*[^\s,;}\]"']+/gi,
    replacement: "$1: [REDACTED]",
  },
  {
    name: "sk-key",
    pattern: /sk-[A-Za-z0-9]{20,}/g,
    replacement: "sk-[REDACTED]",
  },
  {
    name: "github-token",
    pattern: /ghp_[A-Za-z0-9]{36,}/g,
    replacement: "ghp_[REDACTED]",
  },
  {
    name: "vercel-token",
    pattern: /vcp_[A-Za-z0-9]{20,}/g,
    replacement: "vcp_[REDACTED]",
  },
  {
    name: "jwt-token",
    pattern: /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g,
    replacement: "[JWT REDACTED]",
  },
  {
    name: "connection-string",
    pattern: /(?:postgres|mysql|mongodb|redis):\/\/[^\s"']+/gi,
    replacement: "[CONNECTION_STRING REDACTED]",
  },
  {
    name: "private-key",
    pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC )?PRIVATE KEY-----/g,
    replacement: "[PRIVATE_KEY REDACTED]",
  },
  {
    name: "email",
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: "[EMAIL REDACTED]",
  },
  {
    name: "credit-card",
    pattern: /\b(?:\d[ -]*?){13,16}\b/g,
    replacement: "[CC REDACTED]",
  },
  {
    name: "ip-address",
    pattern: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
    replacement: "[IP REDACTED]",
  },
];

// ── Public API ─────────────────────────────────────────────────────────────

export function redactSecrets(text: string): RedactionResult {
  let redacted = text;
  let totalMatches = 0;
  const matchedRules: string[] = [];

  for (const rule of REDACTION_RULES) {
    const matches = redacted.match(rule.pattern);
    if (matches && matches.length > 0) {
      redacted = redacted.replace(rule.pattern, rule.replacement);
      totalMatches += matches.length;
      matchedRules.push(rule.name);
    }
  }

  return {
    original: text,
    redacted,
    matchesFound: totalMatches,
    rules: matchedRules,
  };
}

/**
 * Redact an entire log entry object recursively.
 * Handles strings, objects, and arrays.
 */
export function redactLogEntry<T extends Record<string, unknown>>(
  entry: T
): T {
  const redacted = { ...entry };
  for (const key of Object.keys(redacted)) {
    const value = redacted[key];
    if (typeof value === "string") {
      const result = redactSecrets(value);
      (redacted as Record<string, unknown>)[key] = result.redacted;
    } else if (typeof value === "object" && value !== null) {
      try {
        const json = JSON.stringify(value);
        const result = redactSecrets(json);
        (redacted as Record<string, unknown>)[key] = JSON.parse(result.redacted);
      } catch {
        // Not serializable — skip
      }
    }
  }
  return redacted;
}
