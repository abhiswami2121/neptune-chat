/**
 * lib/auth/allowlist.ts — Canonical ALLOWED_EMAILS list.
 *
 * PHASE A: Auth Allowlist Gate
 * Only these two users can access Neptune Chat. All guest access is blocked.
 * This is the single source of truth — referenced by middleware, auth callbacks,
 * and API route guards.
 *
 * LOCKED: Do not add emails here without explicit approval from Abhi or Jerry.
 */

export const ALLOWED_EMAILS: readonly string[] = [
  "abhiswami2121@gmail.com",
  "jerry.b.yirenkyi@gmail.com",
] as const;

export type AllowedEmail = (typeof ALLOWED_EMAILS)[number];

/** Check if an email (case-insensitive) is in the allowlist */
export function isAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  return ALLOWED_EMAILS.some((allowed) => allowed.toLowerCase() === normalized);
}
