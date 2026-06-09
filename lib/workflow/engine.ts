/**
 * Workflow Execution Engine — DAG topological execution with SSE streaming.
 *
 * Features:
 * - Topological sort of nodes into execution layers
 * - Sequential execution within layers, parallel across layers
 * - SSE streaming for real-time UI updates
 * - Playbook auto-load: when a node uses a connector tool, loads PLAYBOOK context
 * - Error handling: per-node error capture + workflow continuation options
 */

import type {
  WorkflowNode,
  WorkflowEdge,
  NodeExecution,
  WorkflowExecution,
} from "./types";

// ── Topological Sort ───────────────────────────────────────────────────────

/**
 * Sorts nodes into execution layers using Kahn's algorithm.
 * Nodes with no dependencies (triggers) go in layer 0.
 * Nodes that depend on completed nodes go in subsequent layers.
 */
export function topologicalSort(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): WorkflowNode[][] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  // Initialize
  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  // Build graph
  for (const edge of edges) {
    const existing = adjacency.get(edge.source) || [];
    existing.push(edge.target);
    adjacency.set(edge.source, existing);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  // Find all source nodes (in-degree 0)
  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) queue.push(nodeId);
  }

  const layers: WorkflowNode[][] = [];
  const processed = new Set<string>();

  while (queue.length > 0) {
    const layer: WorkflowNode[] = [];
    const layerSize = queue.length;

    for (let i = 0; i < layerSize; i++) {
      const nodeId = queue.shift()!;
      if (processed.has(nodeId)) continue;
      processed.add(nodeId);

      const node = nodeMap.get(nodeId);
      if (node) layer.push(node);

      // Reduce in-degree of neighbors
      for (const neighbor of adjacency.get(nodeId) || []) {
        const newDegree = (inDegree.get(neighbor) || 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      }
    }

    if (layer.length > 0) layers.push(layer);
  }

  return layers;
}

// ── Node Execution ─────────────────────────────────────────────────────────

/**
 * Executes a single node. The actual tool call is delegated to the agent
 * via the SSE stream — this function prepares the execution context.
 */
export function prepareNodeExecution(
  node: WorkflowNode,
  previousResults: Map<string, unknown>
): {
  toolName: string;
  params: Record<string, unknown>;
  systemPrompt: string;
} {
  const params = { ...node.data.params };

  // Resolve references to previous node outputs (e.g., $prev.slack_channel)
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value.startsWith("$prev.")) {
      const ref = value.slice(6);
      // Find the most recent result with this key
      for (const [nodeId, result] of previousResults) {
        if (result && typeof result === "object" && ref in (result as Record<string, unknown>)) {
          params[key] = (result as Record<string, unknown>)[ref];
          break;
        }
      }
    }
  }

  // Build playbook-aware system prompt
  let systemPrompt = `Execute workflow step: ${node.data.label}`;

  if (node.data.connectorId) {
    systemPrompt += `\nConnector: ${node.data.connectorId}`;
    systemPrompt += `\nRefer to the ${node.data.connectorId} PLAYBOOK.md for operational context, anti-patterns, and safeguards.`;
  }

  if (node.data.nodeType === "ai") {
    systemPrompt += `\nAI Prompt: ${node.data.prompt || "Complete the task described."}`;
  }

  if (node.data.nodeType === "conditional") {
    systemPrompt += `\nCondition: ${node.data.condition || "evaluate truthiness"}`;
  }

  return {
    toolName: node.data.toolName || `${node.data.connectorId}.${node.data.label.toLowerCase()}`,
    params,
    systemPrompt,
  };
}

// ── SSE Stream ─────────────────────────────────────────────────────────────

export interface SSEEvent {
  type: "node_start" | "node_progress" | "node_done" | "node_error" | "workflow_done";
  nodeId?: string;
  data?: unknown;
}

/**
 * Creates an SSE stream for a workflow execution.
 * Callers should pipe this to the response.
 */
export function createWorkflowSSEStream(
  onEvent: (event: SSEEvent) => void
): {
  emit: (event: SSEEvent) => void;
  close: () => void;
} {
  let closed = false;

  return {
    emit: (event: SSEEvent) => {
      if (closed) return;
      onEvent(event);
    },
    close: () => {
      closed = true;
    },
  };
}

// ── Execution Orchestrator ─────────────────────────────────────────────────

/**
 * Executes a workflow topologically, emitting SSE events for each node.
 *
 * @param nodes - Workflow nodes
 * @param edges - Workflow edges
 * @param emit - SSE event emitter
 * @param executeNode - Function that actually executes each node (calls tools)
 * @returns Execution result summary
 */
export async function executeWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  emit: (event: SSEEvent) => void,
  executeNode: (
    node: WorkflowNode,
    previousResults: Map<string, unknown>
  ) => Promise<{ success: boolean; result?: unknown; error?: string }>
): Promise<WorkflowExecution> {
  const execution: WorkflowExecution = {
    id: `wf_exec_${Date.now()}`,
    workflowId: "canvas",
    status: "running",
    startedAt: Date.now(),
    nodes: new Map(),
  };

  // Initialize all nodes as pending
  for (const node of nodes) {
    execution.nodes.set(node.id, {
      nodeId: node.id,
      status: "pending",
    });
  }

  const layers = topologicalSort(nodes, edges);
  const previousResults = new Map<string, unknown>();

  for (const layer of layers) {
    const layerPromises = layer.map(async (node) => {
      const nodeExec = execution.nodes.get(node.id)!;
      nodeExec.status = "running";
      nodeExec.startedAt = Date.now();

      emit({ type: "node_start", nodeId: node.id, data: { label: node.data.label } });

      execution.currentNodeId = node.id;

      try {
        const result = await executeNode(node, previousResults);

        if (result.success) {
          nodeExec.status = "done";
          nodeExec.result = result.result;
          previousResults.set(node.id, result.result);

          emit({
            type: "node_done",
            nodeId: node.id,
            data: {
              label: node.data.label,
              result: typeof result.result === "string"
                ? result.result.slice(0, 500)
                : result.result,
            },
          });
        } else {
          nodeExec.status = "error";
          nodeExec.error = result.error || "Unknown error";

          emit({
            type: "node_error",
            nodeId: node.id,
            data: { label: node.data.label, error: nodeExec.error },
          });
        }
      } catch (err) {
        nodeExec.status = "error";
        nodeExec.error = err instanceof Error ? err.message : String(err);

        emit({
          type: "node_error",
          nodeId: node.id,
          data: { label: node.data.label, error: nodeExec.error },
        });
      } finally {
        nodeExec.completedAt = Date.now();
      }
    });

    // Run all nodes in this layer in parallel
    await Promise.all(layerPromises);
  }

  // Determine final status
  let hasError = false;
  for (const exec of execution.nodes.values()) {
    if (exec.status === "error") hasError = true;
  }

  execution.status = hasError ? "failed" : "completed";
  execution.completedAt = Date.now();
  execution.currentNodeId = undefined;

  emit({ type: "workflow_done", data: { status: execution.status } });

  return execution;
}

// ── Validation ─────────────────────────────────────────────────────────────

/**
 * Validates a workflow graph before execution.
 * Returns array of validation errors (empty = valid).
 */
export function validateWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): string[] {
  const errors: string[] = [];

  // Must have at least one trigger node
  if (!nodes.some((n) => n.data.nodeType === "trigger")) {
    errors.push("Workflow must have at least one Trigger node");
  }

  // Must have at least one output node
  if (!nodes.some((n) => n.data.nodeType === "output")) {
    errors.push("Workflow should have at least one Output node");
  }

  // Check for disconnected nodes (no incoming or outgoing edges)
  const connectedNodes = new Set<string>();
  for (const edge of edges) {
    connectedNodes.add(edge.source);
    connectedNodes.add(edge.target);
  }

  for (const node of nodes) {
    if (!connectedNodes.has(node.id) && nodes.length > 1) {
      errors.push(`Node "${node.data.label}" is not connected`);
    }
  }

  // Action nodes must have connectorId and toolName
  for (const node of nodes) {
    if (node.data.nodeType === "action") {
      if (!node.data.connectorId) {
        errors.push(`Action node "${node.data.label}" missing connectorId`);
      }
      if (!node.data.toolName) {
        errors.push(`Action node "${node.data.label}" missing toolName`);
      }
    }
  }

  // Conditional nodes must have a condition
  for (const node of nodes) {
    if (node.data.nodeType === "conditional" && !node.data.condition) {
      errors.push(`Conditional node "${node.data.label}" missing condition`);
    }
  }

  return errors;
}
