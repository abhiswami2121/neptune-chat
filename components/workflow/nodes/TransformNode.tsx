"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import { Shuffle } from "lucide-react";
import type { WorkflowNodeData } from "@/lib/workflow/types";

function TransformNode({ data, selected }: NodeProps) {
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
        ${selected ? "border-cyan-400 shadow-cyan-500/20" : "border-cyan-500/30"}
        ${isRunning ? "ring-2 ring-cyan-400 animate-pulse" : ""}
        ${isError ? "border-red-500" : ""}
      `}
    >
      {isRunning && (
        <motion.div
          className="absolute inset-0 rounded-xl bg-cyan-500/20"
          animate={{ opacity: [0.2, 0.5, 0.2] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        />
      )}

      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-cyan-500 !border-2 !border-card"
      />

      <div className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 rounded-lg bg-cyan-500/10">
            <Shuffle className="w-4 h-4 text-cyan-400" />
          </div>
          <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
            transform
          </span>
        </div>
        <p className="text-sm font-medium text-foreground">{nodeData.label}</p>
        {nodeData.transformCode && (
          <p className="text-xs text-muted-foreground mt-1 font-mono truncate max-w-[180px]">
            {nodeData.transformCode}
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
        className="!w-3 !h-3 !bg-cyan-500 !border-2 !border-card"
      />
    </motion.div>
  );
}

export default memo(TransformNode);
