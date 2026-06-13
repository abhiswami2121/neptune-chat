/**
 * GET  /api/workflow/[id] — Workflow execution status + history.
 * POST /api/workflow/[id] — Control a running workflow (pause/resume/cancel).
 *
 * U3.6: Workflow Engine — State machine with persistence.
 */

import { requireAllowlist } from "@/lib/auth/require-allowlist";
import type { ExecutionStatus } from "@/lib/workflow/types";
import { VALID_TRANSITIONS } from "@/lib/workflow/types";

// ── In-memory session store (production: Durable Object or DB table) ─────

interface WorkflowSessionRecord {
  id: string;
  workflowId: string;
  status: ExecutionStatus;
  task: string;
  startedAt: number;
  completedAt?: number;
  pausedAt?: number;
  cancelledAt?: number;
  currentNodeId?: string;
  nodeStatuses: Record<string, "pending" | "running" | "paused" | "done" | "error">;
  result?: string;
  error?: string;
}

const sessionStore = new Map<string, WorkflowSessionRecord>();

export { sessionStore as _workflowSessionStore };

// ── GET — Status lookup ──────────────────────────────────────────────────

export const GET = requireAllowlist(async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const session = sessionStore.get(id);

  if (!session) {
    return Response.json({ error: "Workflow session not found" }, { status: 404 });
  }

  return Response.json({
    id: session.id,
    workflowId: session.workflowId,
    status: session.status,
    task: session.task,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    pausedAt: session.pausedAt,
    cancelledAt: session.cancelledAt,
    currentNodeId: session.currentNodeId,
    nodeStatuses: session.nodeStatuses,
    durationMs: session.completedAt
      ? session.completedAt - session.startedAt
      : Date.now() - session.startedAt,
    result: session.result,
    error: session.error,
  });
});

// ── POST — Control (pause / resume / cancel) ─────────────────────────────

export const POST = requireAllowlist(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const session = sessionStore.get(id);

  if (!session) {
    return Response.json({ error: "Workflow session not found" }, { status: 404 });
  }

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validActions = ["pause", "resume", "cancel"];
  if (!body.action || !validActions.includes(body.action)) {
    return Response.json(
      { error: `Invalid action. Must be one of: ${validActions.join(", ")}` },
      { status: 400 }
    );
  }

  const currentStatus = session.status;
  const allowedTransitions = VALID_TRANSITIONS[currentStatus] || [];

  // Map action to target status
  const targetMap: Record<string, ExecutionStatus> = {
    pause: "paused",
    resume: "running",
    cancel: "cancelled",
  };
  const targetStatus = targetMap[body.action];

  if (!allowedTransitions.includes(targetStatus)) {
    return Response.json(
      {
        error: `Cannot transition from "${currentStatus}" to "${targetStatus}". Allowed: ${allowedTransitions.join(", ")}`,
      },
      { status: 409 }
    );
  }

  // Apply transition
  session.status = targetStatus;
  if (targetStatus === "paused") {
    session.pausedAt = Date.now();
  }
  if (targetStatus === "cancelled") {
    session.cancelledAt = Date.now();
    session.completedAt = Date.now();
  }

  return Response.json({
    id: session.id,
    previousStatus: currentStatus,
    status: session.status,
    action: body.action,
    message: `Workflow ${body.action}d successfully`,
  });
});
