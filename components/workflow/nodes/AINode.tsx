"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import { Brain, Sparkles } from "lucide-react";
import type { WorkflowNodeData } from "@/lib/workflow/types";

function AINode({ data, selected }: NodeProps) {
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
        ${selected ? "border-pink-400 shadow-pink-500/20" : "border-pink-500/30"}
        ${isRunning ? "ring-2 ring-pink-400 animate-pulse" : ""}
        ${isError ? "border-red-500" : ""}
      `}
    >
      {isRunning && (
        <motion.div
          className="absolute inset-0 rounded-xl bg-pink-500/20"
          animate={{ opacity: [0.2, 0.5, 0.2] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        >
          {/* Sparkle animation during AI processing */}
          <motion.div
            className="absolute top-2 right-2"
            animate={{ rotate: 360, scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <Sparkles className="w-4 h-4 text-pink-300" />
          </motion.div>
        </motion.div>
      )}

      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-pink-500 !border-2 !border-card"
      />

      <div className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 rounded-lg bg-pink-500/10">
            <Brain className="w-4 h-4 text-pink-400" />
          </div>
          <span className="text-xs font-semibold text-pink-400 uppercase tracking-wider">
            ai
          </span>
          {nodeData.modelId && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {nodeData.modelId.split("-").slice(0, 2).join("-")}
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-foreground">{nodeData.label}</p>
        {nodeData.prompt && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">
            &ldquo;{nodeData.prompt.slice(0, 100)}{nodeData.prompt.length > 100 ? "..." : ""}&rdquo;
          </p>
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
        className="!w-3 !h-3 !bg-pink-500 !border-2 !border-card"
      />
    </motion.div>
  );
}

export default memo(AINode);
