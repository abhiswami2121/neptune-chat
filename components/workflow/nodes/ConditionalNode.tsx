"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import { GitBranch } from "lucide-react";
import type { WorkflowNodeData } from "@/lib/workflow/types";

function ConditionalNode({ data, selected }: NodeProps) {
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
        ${selected ? "border-amber-400 shadow-amber-500/20" : "border-amber-500/30"}
        ${isRunning ? "ring-2 ring-amber-400 animate-pulse" : ""}
        ${isError ? "border-red-500" : ""}
      `}
      // Diamond-ish shape hint via clip-path
      style={{ borderRadius: "16px" }}
    >
      {isRunning && (
        <motion.div
          className="absolute inset-0 rounded-xl bg-amber-500/20"
          animate={{ opacity: [0.2, 0.5, 0.2] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        />
      )}

      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-card"
      />

      <div className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 rounded-lg bg-amber-500/10">
            <GitBranch className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
            condition
          </span>
        </div>
        <p className="text-sm font-medium text-foreground">{nodeData.label}</p>
        {nodeData.condition && (
          <p className="text-xs text-muted-foreground mt-1 font-mono truncate max-w-[180px]">
            if ({nodeData.condition})
          </p>
        )}
      </div>

      {/* True branch (left) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-card"
        style={{ left: "30%" }}
      />
      <span className="absolute -bottom-4 text-[10px] text-green-400 font-semibold" style={{ left: "25%" }}>
        TRUE
      </span>

      {/* False branch (right) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-card"
        style={{ left: "70%" }}
      />
      <span className="absolute -bottom-4 text-[10px] text-red-400 font-semibold" style={{ left: "64%" }}>
        FALSE
      </span>
    </motion.div>
  );
}

export default memo(ConditionalNode);
