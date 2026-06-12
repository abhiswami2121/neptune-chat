/**
 * Capabilities Page — Live introspection tree of all Neptune capabilities.
 * PHASE 5: Discovery UI. Shows tools, connectors, playbooks, skills, workflows.
 */
import { auth } from "@/app/(auth)/auth";
import { CapabilitiesClient } from "./capabilities-client";

export const metadata = {
  title: "Capabilities — Neptune",
  description: "Live introspection of all agent capabilities, tools, connectors, and workflows.",
};

export default async function CapabilitiesPage() {
  const session = await auth();
  if (!session?.user) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <p className="text-muted-foreground">Sign in to view capabilities.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 border-b px-6 py-4">
        <h1 className="text-lg font-semibold">Capabilities</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Live introspection &middot; Tools &middot; Connectors &middot; Playbooks &middot; Skills &middot; Workflows
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        <CapabilitiesClient />
      </div>
    </div>
  );
}
