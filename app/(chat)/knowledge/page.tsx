/**
 * Knowledge Page — Memory + PRDs + Knowledge Graph with card-grid UI.
 * PHASE 3: Enterprise card-grid redesign with search, dark mode, responsive.
 */
import { auth } from "@/app/(auth)/auth";
import { KnowledgeCardGrid } from "./knowledge-card-grid";

export const metadata = {
  title: "Knowledge — Neptune",
  description: "Memory store, PRD archive, and knowledge graph artifacts.",
};

export default async function KnowledgePage() {
  const session = await auth();
  if (!session?.user) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">Sign in to access knowledge.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 border-b px-6 py-4">
        <h1 className="text-lg font-semibold">Knowledge</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Memory store &middot; PRD archive &middot; Knowledge graph &middot; Semantic search
        </p>
      </div>

      {/* Card Grid */}
      <div className="flex-1 overflow-y-auto">
        <KnowledgeCardGrid />
      </div>
    </div>
  );
}
