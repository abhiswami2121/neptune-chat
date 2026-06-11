/**
 * Connectors Page — dynamic grid of connector cards from registry.
 * U1.3: Includes inventory wrap progress data for per-connector progress bars.
 */
import { auth } from "@/app/(auth)/auth";
import { cookies } from "next/headers";
import { initConnectors, manifests } from "@/lib/connectors/init";
import {
  CONNECTOR_INVENTORY,
  getInventoryCoverage,
  getInventoryEntry,
} from "@/lib/connectors/inventory";
import { ConnectorsClient } from "./client";

export default async function ConnectorsPage() {
  // Force dynamic rendering to bypass CDN cache
  cookies();
  const session = await auth();
  if (!session?.user) {
    return (
      <div className="p-8 text-muted-foreground">
        Sign in to manage connectors.
      </div>
    );
  }

  // Ensure registry is populated (server-side)
  initConnectors();

  const connectors = manifests.map((m) => {
    const inventory = getInventoryEntry(m.id);
    return {
      id: m.id,
      name: m.name,
      description: m.description,
      brandColor: m.brandColor,
      capabilities: m.capabilities, // pass full capability objects
      toolCount: m.capabilities.length,
      envKeys: m.envKeys,
      status: m.getStatus(),
      docs: m.docs,
      playbookPath: m.playbookPath,
      /** U1.3: Wrap progress data */
      wrapped: inventory?.wrapped ?? m.capabilities.length,
      total: inventory?.total ?? m.capabilities.length,
      priority: inventory?.priority ?? "P1",
      surface: inventory?.surface ?? "",
    };
  });

  // Add VPS as a connector entry
  const vpsInventory = getInventoryEntry("vps");
  if (vpsInventory && !connectors.find((c) => c.id === "vps")) {
    connectors.push({
      id: "vps",
      name: "VPS Functions",
      description: "hostingerBridge, claude-agent-api, hermes-api, pm2",
      brandColor: "#6366f1",
      capabilities: [],
      toolCount: vpsInventory.wrapped,
      envKeys: [],
      status: { connected: true, message: `${vpsInventory.wrapped} of ${vpsInventory.total}+ functions wrapped` },
      docs: undefined,
      playbookPath: "",
      wrapped: vpsInventory.wrapped,
      total: vpsInventory.total,
      priority: vpsInventory.priority,
      surface: vpsInventory.surface,
    });
  }

  const counts = {
    total: connectors.length,
    connected: connectors.filter((c) => c.status.connected).length,
    notConfigured: connectors.filter((c) => !c.status.connected).length,
  };

  const coverage = getInventoryCoverage();

  return (
    <ConnectorsClient
      connectors={connectors}
      counts={counts}
      inventory={{
        totalWrapped: coverage.totalWrapped,
        totalAvailable: coverage.totalAvailable,
        coveragePercent: coverage.coveragePercent,
        byPriority: coverage.byPriority,
      }}
    />
  );
}
