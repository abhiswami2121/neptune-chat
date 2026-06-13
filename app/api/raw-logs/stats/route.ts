import { NextResponse } from "next/server";
import { getRawLogStats } from "@/lib/raw-logs/collector";

export async function GET() {
  try {
    const stats = await getRawLogStats();
    return NextResponse.json(stats);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
