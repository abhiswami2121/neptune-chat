/**
 * app/api/telemetry/route.ts
 * Phase 9 — Live telemetry API for skill/function usage tracking.
 * GET: returns usage telemetry data from in-memory store.
 * POST: records a new telemetry event (called by annotation loop).
 */
import { NextResponse } from "next/server";
import {
  getTelemetry,
  getTelemetrySummary,
  recordUsage,
  type TelemetryEntry,
} from "@/connectors/neptune/functions/usage-telemetry";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const connector = searchParams.get("connector") || undefined;
  const domain = searchParams.get("domain") || undefined;
  const sortBy = (searchParams.get("sortBy") as "invocationCount" | "avgDurationMs" | "errorCount") || "invocationCount";
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined;

  const entries: TelemetryEntry[] = getTelemetry({ connector, domain, sortBy, limit });
  const summary = getTelemetrySummary();

  return NextResponse.json({
    entries,
    summary,
    timestamp: new Date().toISOString(),
    filters: { connector, domain, sortBy, limit },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { skillOrFunction, connector, domain, durationMs, error } = body;

    if (!skillOrFunction || !connector || !domain || typeof durationMs !== "number") {
      return NextResponse.json(
        { error: "Missing required fields: skillOrFunction, connector, domain, durationMs" },
        { status: 400 }
      );
    }

    const entry = recordUsage({ skillOrFunction, connector, domain, durationMs, error });
    return NextResponse.json({ recorded: entry, timestamp: new Date().toISOString() }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to record telemetry" }, { status: 500 });
  }
}
