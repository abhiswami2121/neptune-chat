"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import { Play, Wrench } from "lucide-react";
import type { WorkflowNodeData } from "@/lib/workflow/types";

function ActionNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as WorkflowNodeData;
  const isRunning = nodeData.status === "running";
  const isDone = nodeData.status === "done";
  const isError = nodeData.status === "error";

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`
        relative rounded-xl border-2 bg-card shadow-lg min-w-[200px]
        ${selected ? "border-green-400 shadow-green-500/20" : "border-green-500/30"}
        ${isRunning ? "ring-2 ring-green-400 animate-pulse" : ""}
        ${isError ? "border-red-500" : ""}
      `}
    >
      {isRunning && (
        <motion.div
          className="absolute inset-0 rounded-xl bg-green-500/20"
          animate={{ opacity: [0.2, 0.5, 0.2] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        />
      )}

      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-card"
      />

      <div className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 rounded-lg bg-green-500/10">
            <Play className="w-4 h-4 text-green-400" />
          </div>
          <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">
            action
          </span>
          {nodeData.connectorId && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {nodeData.connectorId}
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-foreground">{nodeData.label}</p>
        {nodeData.toolName && (
          <div className="flex items-center gap-1 mt-1">
            <Wrench className="w-3 h-3 text-muted-foreground" />
            <p className="text-xs text-muted-foreground font-mono">
              {nodeData.connectorId}.{nodeData.toolName}
            </p>
          </div>
        )}
        {isError && nodeData.errorMessage && (
          <p className="text-xs text-red-400 mt-1 truncate max-w-[180px]">
            {nodeData.errorMessage}
          </p>
        )}
        {isDone && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center"
          >
            <span className="text-white text-[8px]">✓</span>
          </motion.div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-card"
      />
    </motion.div>
  );
}

export default memo(ActionNode);
