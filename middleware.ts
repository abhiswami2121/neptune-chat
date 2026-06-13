/**
 * middleware.ts — Root-level Next.js middleware.
 *
 * PHASE A: Auth Allowlist Gate
 *
 * Enforces authentication on protected routes by checking the next-auth
 * session cookie. The auth() callback in app/(auth)/auth.ts handles the
 * allowlist check (blocking guests + non-allowlisted emails).
 *
 * Protected: /chat, /library, /vault, /tools, /connectors, /skills,
 *            /playbooks, /memory, /knowledge, /workflows, /reports,
 *            /v2-sessions, /settings
 *
 * Public: /login, /register, /api/auth/*, /access-denied, /_next, /favicon.ico
 */

import { auth } from "@/app/(auth)/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/api/auth",
  "/access-denied",
  "/_next",
  "/favicon.ico",
  "/api/vercel",
] as const;

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow public paths (login, register, auth API, access-denied)
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // If user is not authenticated, redirect to login
  if (!req.auth?.user) {
    const loginUrl = new URL(`${BASE_PATH}/login`, req.url);
    loginUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(loginUrl);
  }

  // If guest user somehow got through (should be caught by auth callback),
  // redirect to access-denied as a safety net
  if (req.auth.user.type === "guest") {
    const deniedUrl = new URL(`${BASE_PATH}/access-denied`, req.url);
    return NextResponse.redirect(deniedUrl);
  }

  return NextResponse.next();
});

/** Configure which paths the middleware runs on */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - Public assets (images, fonts, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
