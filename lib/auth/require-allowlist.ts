/**
 * lib/auth/require-allowlist.ts — Server helper to wrap API handlers
 * with auth + allowlist enforcement.
 *
 * PHASE A: Auth Allowlist Gate
 * Usage in any API route (app/api/.../route.ts):
 *
 *   import { requireAllowlist } from "@/lib/auth/require-allowlist";
 *
 *   export const GET = requireAllowlist(async (request) => {
 *     // handler body — guaranteed to be authenticated
 *   });
 *
 * The wrapper checks:
 * 1. Session exists (user is authenticated via next-auth)
 * 2. User email is in ALLOWED_EMAILS
 * 3. Guest users are rejected
 *
 * Returns 401 JSON if any check fails.
 */

import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { isAllowed } from "./allowlist";

/**
 * Check if the request has a valid NEPTUNE_INTERNAL_TOKEN Bearer token.
 * Used as a bypass for internal API-to-API calls (e.g., V2 → Chat).
 */
/**
 * Valid token names accepted for Bearer bypass, in priority order.
 * E2E: NEPTUNE_INTERNAL_TOKEN (Chat primary), NEPTUNE_TEST_TOKEN (V2 primary),
 *      NEPTUNE_E2E_TEST_TOKEN (CI/E2E shared).
 */
function hasValidInternalToken(request: Request | any): boolean {
  try {
    const authHeader = request?.headers?.get?.("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return false;

    // Accept any of the 3 Neptune internal token env vars
    const candidates = [
      process.env.NEPTUNE_INTERNAL_TOKEN,
      process.env.NEPTUNE_TEST_TOKEN,
      process.env.NEPTUNE_E2E_TEST_TOKEN,
    ];
    return candidates.some((expected) => !!(expected && token === expected));
  } catch {
    return false;
  }
}

/**
 * Wrap an API handler with auth + allowlist enforcement.
 * Uses a loose function signature to stay compatible with all Next.js
 * route handler variants (NextRequest vs Request, typed params vs generic).
 *
 * Allows bypass via Bearer NEPTUNE_INTERNAL_TOKEN for internal API calls.
 *
 * Returns 401 JSON response if the user is not authenticated or not in the allowlist.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function requireAllowlist<T extends (...args: any[]) => any>(handler: T): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (async (...args: any[]) => {
    // First argument is the request object
    const request = args[0];

    // Bypass: valid NEPTUNE_INTERNAL_TOKEN in Authorization header
    if (hasValidInternalToken(request)) {
      return handler(...args);
    }

    const session = await auth();

    // No session = not authenticated
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized", code: "NO_SESSION", message: "Authentication required. Please sign in." },
        { status: 401 }
      );
    }

    // Guest users are not allowed
    if (session.user.type === "guest") {
      return NextResponse.json(
        { error: "Forbidden", code: "GUEST_BLOCKED", message: "Guest access is disabled. Please sign in with an authorized account." },
        { status: 403 }
      );
    }

    // Check allowlist
    if (!isAllowed(session.user.email)) {
      return NextResponse.json(
        { error: "Forbidden", code: "NOT_ALLOWLISTED", message: "Your account is not authorized to access this resource." },
        { status: 403 }
      );
    }

    return handler(...args);
  }) as T;
}

/**
 * Reusable helper: call in a route handler to check auth inline.
 * Throws Response if unauthorized (for use in try/catch patterns).
 *
 * Returns the authenticated session on success.
 */
export async function checkAuth() {
  const session = await auth();

  if (!session?.user) {
    throw new Response(
      JSON.stringify({ error: "Unauthorized", code: "NO_SESSION" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  if (session.user.type === "guest") {
    throw new Response(
      JSON.stringify({ error: "Forbidden", code: "GUEST_BLOCKED" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!isAllowed(session.user.email)) {
    throw new Response(
      JSON.stringify({ error: "Forbidden", code: "NOT_ALLOWLISTED" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  return session.user;
}
