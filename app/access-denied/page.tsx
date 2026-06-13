"use client";

/**
 * app/access-denied/page.tsx — Access Denied page.
 *
 * PHASE A: Auth Allowlist Gate
 *
 * Shown when a user is authenticated but their email is not in the
 * ALLOWED_EMAILS allowlist. Provides a branded error experience with
 * a Sign Out button to return to the login flow.
 */

import { ShieldOffIcon, LogOutIcon } from "lucide-react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function AccessDeniedPage() {
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="mx-auto w-full max-w-md px-4">
        {/* Logo mark */}
        <div className="mb-8 flex justify-center">
          <div className="flex size-12 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10">
            <ShieldOffIcon className="size-6 text-red-400" />
          </div>
        </div>

        {/* Content card */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-center shadow-[var(--shadow-float)] backdrop-blur-xl">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
            Access Denied
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Your account does not have permission to access Neptune Chat.
            This workspace is restricted to authorized personnel only.
          </p>

          <div className="mt-6 border-t border-zinc-800 pt-6">
            <p className="text-xs text-zinc-500">
              If you believe this is a mistake, please contact your
              workspace administrator to request access.
            </p>
          </div>

          {/* Sign Out button */}
          <div className="mt-8">
            <Button
              className="w-full gap-2"
              onClick={handleSignOut}
              size="lg"
              variant="outline"
            >
              <LogOutIcon className="size-4" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-zinc-600">
          Neptune Chat v3.2 · Grand Unification
        </p>
      </div>
    </div>
  );
}
