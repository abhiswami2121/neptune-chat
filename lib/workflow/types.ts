/**
 * Workflow type definitions — canonical model for the visual workflow builder.
 *
 * 7 node types: Trigger | Action | Conditional | Parallel | Transform | AI | Output
 * 1 edge type:  WorkflowEdge (with animated data-flow dots)
 */

import type { Node, Edge } from "@xyflow/react";

// ── Node Types ─────────────────────────────────────────────────────────────

export type WorkflowNodeType =
  | "trigger"
  | "action"
  | "conditional"
  | "parallel"
  | "transform"
  | "ai"
  | "output";

export const NODE_TYPE_META: Record<
  WorkflowNodeType,
  {
    label: string;
    icon: string; // lucide icon name
    color: string;
    description: string;
  }
> = {
  trigger: {
    label: "Trigger",
    icon: "Zap",
    color: "#6366F1", // indigo
    description: "Starts the workflow — cron schedule, webhook, or manual",
  },
  action: {
    label: "Action",
    icon: "Play",
    color: "#22C55E", // green
    description: "Executes a connector tool (Slack, GHL, GitHub, etc.)",
  },
  conditional: {
    label: "Conditional",
    icon: "GitBranch",
    color: "#F59E0B", // amber
    description: "Branches the workflow based on a condition",
  },
  parallel: {
    label: "Parallel",
    icon: "GitFork",
    color: "#8B5CF6", // purple
    description: "Runs multiple branches in parallel",
  },
  transform: {
    label: "Transform",
    icon: "Shuffle",
    color: "#06B6D4", // cyan
    description: "Transforms, maps, or enriches data between steps",
  },
  ai: {
    label: "AI",
    icon: "Brain",
    color: "#EC4899", // pink
    description: "LLM-powered step — generate, analyze, classify, summarize",
  },
  output: {
    label: "Output",
    icon: "ArrowUpFromLine",
    color: "#EF4444", // red
    description: "Delivers results — Slack post, email, webhook, or API response",
  },
};

// ── Node Data ───────────────────────────────────────────────────────────────

export interface WorkflowNodeData {
  label: string;
  nodeType: WorkflowNodeType;
  /** For action nodes: which connector + tool to call */
  connectorId?: string;
  toolName?: string;
  /** Tool input parameters (key-value) */
  params?: Record<string, unknown>;
  /** For conditional nodes */
  condition?: string;
  /** For AI nodes */
  prompt?: string;
  modelId?: string;
  /** For transform nodes */
  transformCode?: string;
  /** For trigger nodes */
  triggerType?: "cron" | "webhook" | "manual";
  cronExpression?: string;
  /** For output nodes */
  outputType?: "slack" | "email" | "webhook" | "api";
  outputConfig?: Record<string, unknown>;
  /** Runtime state (set during execution) */
  status?: "pending" | "running" | "done" | "error";
  errorMessage?: string;
  result?: unknown;
  /** Index signature for ReactFlow compatibility */
  [key: string]: unknown;
}

// ── Edge Data ───────────────────────────────────────────────────────────────

export interface WorkflowEdgeData {
  label?: string;
  /** For conditional branches: which path this edge represents */
  branch?: "true" | "false" | "default";
  /** Runtime animation state */
  animated?: boolean;
  /** Flow color for animated data dots */
  flowColor?: string;
  /** Index signature for ReactFlow compatibility */
  [key: string]: unknown;
}

// ── Node/Edge Types for React Flow ─────────────────────────────────────────

export type WorkflowNode = Node<WorkflowNodeData, WorkflowNodeType>;
export type WorkflowEdge = Edge<WorkflowEdgeData>;

// ── Workflow Definition ────────────────────────────────────────────────────

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
  /** How this workflow was created: 'manual' | 'agent' */
  source: "manual" | "agent";
  /** Agent prompt that generated this workflow (if source=agent) */
  agentPrompt?: string;
}

// ── Execution Types ─────────────────────────────────────────────────────────

export type ExecutionStatus = "idle" | "running" | "paused" | "completed" | "failed" | "cancelled";

export interface NodeExecution {
  nodeId: string;
  status: "pending" | "running" | "paused" | "done" | "error";
  startedAt?: number;
  completedAt?: number;
  error?: string;
  result?: unknown;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: ExecutionStatus;
  startedAt: number;
  completedAt?: number;
  nodes: Map<string, NodeExecution>;
  currentNodeId?: string;
  pausedAt?: number;
  cancelledAt?: number;
}

/** State machine: idle → running → paused/completed/failed/cancelled */
export const VALID_TRANSITIONS: Record<ExecutionStatus, ExecutionStatus[]> = {
  idle: ["running"],
  running: ["paused", "completed", "failed", "cancelled"],
  paused: ["running", "cancelled"],
  completed: [],
  failed: ["running"],
  cancelled: [],
};
