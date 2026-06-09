"use client";

import { useCallback, useMemo, useState, type DragEvent } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ConnectionMode,
  type Node,
  type Edge,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion } from "framer-motion";
import { Play, Square, Loader2, Wand2 } from "lucide-react";
import { nodeTypes } from "./nodes";
import { edgeTypes } from "./edges";
import WorkflowToolbar from "./WorkflowToolbar";
import type { WorkflowNodeType, WorkflowNodeData, WorkflowNode, WorkflowEdge } from "@/lib/workflow/types";
import { NODE_TYPE_META } from "@/lib/workflow/types";
import { topologicalSort, validateWorkflow } from "@/lib/workflow/engine";

interface WorkflowCanvasProps {
  initialNodes?: WorkflowNode[];
  initialEdges?: WorkflowEdge[];
  onExecute?: (nodes: WorkflowNode[], edges: WorkflowEdge[]) => void;
  onAgentPrompt?: (prompt: string) => void;
}

let nodeIdCounter = 0;
function generateNodeId(): string {
  return `node_${++nodeIdCounter}_${Date.now()}`;
}

export default function WorkflowCanvas({
  initialNodes = [],
  initialEdges = [],
  onExecute,
  onAgentPrompt,
}: WorkflowCanvasProps) {
  const [nodes, setNodes] = useState<WorkflowNode[]>(initialNodes);
  const [edges, setEdges] = useState<WorkflowEdge[]>(initialEdges);
  const [isExecuting, setIsExecuting] = useState(false);
  const [agentPrompt, setAgentPrompt] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Edge defaults
  const defaultEdgeOptions = useMemo(
    () => ({
      type: "animated",
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
      style: { stroke: "#6366F140", strokeWidth: 2 },
    }),
    []
  );

  // Handle node changes
  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds) as WorkflowNode[]),
    []
  );

  // Handle edge changes
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds) as WorkflowEdge[]),
    []
  );

  // Handle new connections
  const onConnect: OnConnect = useCallback(
    (connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: "animated",
            animated: true,
            data: { flowColor: "#6366F1" },
          },
          eds
        ) as WorkflowEdge[]
      );
    },
    []
  );

  // Add a node from the toolbar
  const handleAddNode = useCallback((type: WorkflowNodeType) => {
    const meta = NODE_TYPE_META[type];
    const newNode: WorkflowNode = {
      id: generateNodeId(),
      type,
      position: {
        x: 300 + Math.random() * 200,
        y: 150 + Math.random() * 100,
      },
      data: {
        label: `New ${meta.label}`,
        nodeType: type,
      },
    };
    setNodes((nds) => [...nds, newNode]);
  }, []);

  // Handle drag-and-drop from external sources
  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/workflow-node") as WorkflowNodeType;
      if (!type || !NODE_TYPE_META[type]) return;

      const position = {
        x: event.clientX - 100,
        y: event.clientY - 40,
      };

      const meta = NODE_TYPE_META[type];
      const newNode: WorkflowNode = {
        id: generateNodeId(),
        type,
        position,
        data: { label: `New ${meta.label}`, nodeType: type },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    []
  );

  // Validate and execute
  const handleExecute = useCallback(() => {
    const errors = validateWorkflow(
      nodes as WorkflowNode[],
      edges as WorkflowEdge[]
    );
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);
    setIsExecuting(true);
    onExecute?.(nodes as WorkflowNode[], edges as WorkflowEdge[]);

    // Simulate execution completion after a timeout
    setTimeout(() => setIsExecuting(false), 5000);
  }, [nodes, edges, onExecute]);

  // Handle agent prompt
  const handleAgentPrompt = useCallback(() => {
    if (!agentPrompt.trim()) return;
    onAgentPrompt?.(agentPrompt.trim());
    setAgentPrompt("");
  }, [agentPrompt, onAgentPrompt]);

  const layerCount = topologicalSort(
    nodes as WorkflowNode[],
    edges as WorkflowEdge[]
  ).length;

  return (
    <div className="relative w-full h-full">
      {/* Toolbar */}
      <WorkflowToolbar onAddNode={handleAddNode} />

      {/* Agent prompt bar (bottom) */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl"
      >
        <div className="bg-card border rounded-xl shadow-xl p-2 flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-pink-400 shrink-0 ml-1" />
          <input
            type="text"
            value={agentPrompt}
            onChange={(e) => setAgentPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAgentPrompt()}
            placeholder="Describe a workflow in natural language..."
            className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground"
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleAgentPrompt}
            disabled={!agentPrompt.trim()}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-pink-500/10 text-pink-400 hover:bg-pink-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Generate
          </motion.button>
        </div>
      </motion.div>

      {/* Execute button (top right) */}
      <motion.div
        initial={{ x: 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="absolute right-4 top-4 z-20 flex flex-col gap-2"
      >
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleExecute}
          disabled={isExecuting || nodes.length === 0}
          className={`
            flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm shadow-lg
            transition-all
            ${isExecuting
              ? "bg-muted text-muted-foreground cursor-wait"
              : "bg-green-500 text-white hover:bg-green-600"
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {isExecuting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run Workflow
            </>
          )}
        </motion.button>

        {isExecuting && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsExecuting(false)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
          >
            <Square className="w-3 h-3" />
            Stop
          </motion.button>
        )}

        {/* Stats pill */}
        <div className="bg-card border rounded-lg px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
          {nodes.length} nodes · {edges.length} edges · {layerCount} layers
        </div>
      </motion.div>

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-red-500/10 border border-red-500/30 rounded-xl p-3 max-w-md"
        >
          <p className="text-sm font-semibold text-red-400 mb-1">
            Validation Errors ({validationErrors.length})
          </p>
          <ul className="text-xs text-red-300 space-y-0.5">
            {validationErrors.map((err, i) => (
              <li key={i}>• {err}</li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* React Flow Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={2}
        className="bg-dot-grid"
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} color="#6366F120" />
        <Controls className="!bg-card !border !shadow-lg !rounded-lg" />
        <MiniMap
          className="!bg-card !border !shadow-lg !rounded-lg"
          nodeColor={(node) => {
            const type = (node as WorkflowNode).data?.nodeType;
            const meta = type ? NODE_TYPE_META[type] : undefined;
            return meta?.color || "#6366F1";
          }}
        />
      </ReactFlow>
    </div>
  );
}
