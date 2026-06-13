/**
 * app/api/research/status/route.ts
 * U5.5 — Research Engine Status
 *
 * GET: Check which research sources are available and which API keys are missing.
 * Used by the UI to show source availability and prompt for key staging.
 */
import { NextResponse } from "next/server";
import { checkSourceAvailability, getMissingApiKeys } from "@/lib/research/parallel-engine";

export async function GET() {
  const sources = checkSourceAvailability();
  const missingKeys = getMissingApiKeys();

  const availableCount = sources.filter((s) => s.configured).length;
  const totalCount = sources.length;

  return NextResponse.json({
    sources: sources.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      configured: s.configured,
      weight: s.weight,
      requiresKey: s.type === "api" ? s.apiKeyEnv : null,
    })),
    stats: {
      total: totalCount,
      available: availableCount,
      unavailable: totalCount - availableCount,
      minimumRequired: 2,
      meetsMinimum: availableCount >= 2,
    },
    missingKeys,
    stagingInstructions: missingKeys.length > 0
      ? {
          message: `${missingKeys.length} API key(s) need to be configured.`,
          howTo: "Set these environment variables in your Vercel project settings:",
          keys: missingKeys,
          vercelProjectUrl: "https://vercel.com/neptune-chat/settings/environment-variables",
        }
      : null,
    timestamp: new Date().toISOString(),
  });
}
