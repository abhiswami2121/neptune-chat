/**
 * GET /api/integrations — dynamic connector listing from the registry.
 * Returns ALL 13 connectors with status, tools, playbook references.
 */
import { NextResponse } from "next/server";
import { getIntegrationSummaries } from "@/lib/connectors/catalog";

export async function GET() {
  const summaries = getIntegrationSummaries();

  const connected = summaries.filter((s) => s.status === "connected");
  const configured = summaries.filter((s) => s.status === "configured");
  const disconnected = summaries.filter((s) => s.status === "disconnected");

  return NextResponse.json({
    total: summaries.length,
    connected: connected.length,
    configured: configured.length,
    disconnected: disconnected.length,
    integrations: summaries.map((s) => ({
      name: s.name,
      id: s.id,
      status: s.status,
      tools: s.tools,
      toolNames: s.toolNames,
      description: s.description,
      playbook: s.playbook,
      brandColor: s.brandColor,
      details: s.details,
    })),
    fullList: summaries.map((s) => s.name),
  });
}
