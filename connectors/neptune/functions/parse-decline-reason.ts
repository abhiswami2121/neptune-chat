/**
 * parse-decline-reason.ts
 * Classifies NMI decline codes into HARD, SOFT, or CONFIG categories.
 * Used by billing-flow domain for automated decline handling.
 *
 * Phase 8 — Neptune Custom Functions
 */

export type DeclineCategory = "HARD" | "SOFT" | "CONFIG" | "UNKNOWN";

export interface DeclineResult {
  code: string;
  category: DeclineCategory;
  description: string;
  retryable: boolean;
  action: string;
}

const DECLINE_MAP: Record<string, DeclineResult> = {
  "201": { code: "201", category: "HARD", description: "Do Not Honor", retryable: false, action: "Send billing link for new card. Do NOT retry." },
  "202": { code: "202", category: "SOFT", description: "Insufficient Funds", retryable: true, action: "Enqueue in Smart Retry Engine (3-5 day delay)." },
  "204": { code: "204", category: "CONFIG", description: "Blocked/Issuer Declined MCC", retryable: true, action: "Investigate velocity or MCC issue. Wait 24h if velocity." },
  "222": { code: "222", category: "HARD", description: "Account Closed", retryable: false, action: "New card mandatory. Route to billing link recovery." },
  "223": { code: "223", category: "SOFT", description: "Expired Card", retryable: false, action: "Send card update billing link. Do not retry same card." },
  "225": { code: "225", category: "CONFIG", description: "CVV2 Mismatch", retryable: true, action: "Fix CVV token pass-through. If stale, send billing link." },
  "251": { code: "251", category: "HARD", description: "Declined", retryable: false, action: "New card required. SMS recovery link." },
  "253": { code: "253", category: "HARD", description: "Pick Up Card (Special Fraud)", retryable: false, action: "Special fraud flag. New card needed. SMS recovery link." },
  "300": { code: "300", category: "CONFIG", description: "Validation Error", retryable: true, action: "Parse error payload, fix request, retry ONCE." },
  "400": { code: "400", category: "CONFIG", description: "Bad Request", retryable: true, action: "Reconstruct request schema, retry with corrected params." },
};

export function parseDeclineReason(code: string, responseText?: string): DeclineResult {
  const known = DECLINE_MAP[code];
  if (known) return known;

  // Heuristic classification for unknown codes
  const category: DeclineCategory = code.startsWith("2") ? "SOFT" : "UNKNOWN";
  return {
    code,
    category,
    description: responseText || "Unknown decline reason",
    retryable: category === "SOFT",
    action: "Investigate decline reason before retrying.",
  };
}

export function isHardDecline(code: string): boolean {
  return DECLINE_MAP[code]?.category === "HARD";
}

export function isRetryable(code: string): boolean {
  return DECLINE_MAP[code]?.retryable ?? false;
}
