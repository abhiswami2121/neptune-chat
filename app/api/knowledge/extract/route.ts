import { type NextRequest, NextResponse } from "next/server";
import { extractFromRecentLogs } from "@/lib/knowledge/extractor";
import { getKgStats } from "@/lib/knowledge/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const hoursBack = body.hoursBack ?? 24;
    const limit = body.limit ?? 50;

    const result = await extractFromRecentLogs(hoursBack, limit);
    const kgStats = await getKgStats();

    return NextResponse.json({
      ...result,
      kgStats,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  // Lightweight trigger — runs extraction
  const { searchParams } = new URL(req.url);
  const hoursBack = parseInt(searchParams.get("hoursBack") ?? "24");
  const limit = parseInt(searchParams.get("limit") ?? "50");

  try {
    const result = await extractFromRecentLogs(hoursBack, limit);
    const kgStats = await getKgStats();
    return NextResponse.json({ ...result, kgStats });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
