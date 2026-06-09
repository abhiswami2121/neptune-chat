"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import { GitFork } from "lucide-react";
import type { WorkflowNodeData } from "@/lib/workflow/types";

function ParallelNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as WorkflowNodeData;
  const isRunning = nodeData.status === "running";

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`
        relative rounded-2xl border-2 bg-card shadow-lg min-w-[200px]
        ${selected ? "border-purple-400 shadow-purple-500/20" : "border-purple-500/30"}
        ${isRunning ? "ring-2 ring-purple-400 animate-pulse" : ""}
      `}
    >
      {isRunning && (
        <motion.div
          className="absolute inset-0 rounded-2xl bg-purple-500/20"
          animate={{ opacity: [0.2, 0.5, 0.2] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        />
      )}

      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-card"
      />

      <div className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 rounded-lg bg-purple-500/10">
            <GitFork className="w-4 h-4 text-purple-400" />
          </div>
          <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
            parallel
          </span>
        </div>
        <p className="text-sm font-medium text-foreground">{nodeData.label}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Fan-out — runs connected branches simultaneously
        </p>
      </div>

      {/* Multiple output handles for fan-out */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="branch-0"
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-card"
        style={{ left: "30%" }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="branch-1"
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-card"
        style={{ left: "70%" }}
      />
    </motion.div>
  );
}

export default memo(ParallelNode);
