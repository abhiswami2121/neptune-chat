/**
 * Workflows Page — Visual workflow builder with React Flow canvas.
 *
 * Features:
 * - Drag-and-drop node canvas (7 node types)
 * - Framer Motion animations (spring scale-in, edge data flow dots, pulse glow on run)
 * - DAG topological execution engine
 * - SSE real-time UI updates during execution
 * - Agent-driven workflow creation from natural language
 * - 5 starter templates
 * - Playbook auto-load when using connector tools
 */
import { auth } from "@/app/(auth)/auth";
import WorkflowPageClient from "@/components/workflow/WorkflowPageClient";

export default async function WorkflowsPage() {
  const session = await auth();
  return <WorkflowPageClient hasSession={!!session?.user} />;
}
