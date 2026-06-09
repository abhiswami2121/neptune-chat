"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import {
  Zap,
  Play,
  GitBranch,
  GitFork,
  Shuffle,
  Brain,
  ArrowUpFromLine,
  Plus,
} from "lucide-react";
import type { WorkflowNodeType, WorkflowNodeData } from "@/lib/workflow/types";
import { NODE_TYPE_META } from "@/lib/workflow/types";

const iconMap: Record<WorkflowNodeType, typeof Zap> = {
  trigger: Zap,
  action: Play,
  conditional: GitBranch,
  parallel: GitFork,
  transform: Shuffle,
  ai: Brain,
  output: ArrowUpFromLine,
};

interface WorkflowToolbarProps {
  onAddNode: (type: WorkflowNodeType) => void;
}

function WorkflowToolbar({ onAddNode }: WorkflowToolbarProps) {
  const nodeTypes = Object.entries(NODE_TYPE_META) as [
    WorkflowNodeType,
    (typeof NODE_TYPE_META)[WorkflowNodeType],
  ][];

  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="absolute left-4 top-4 z-20 flex flex-col gap-2"
    >
      <div className="bg-card border rounded-xl shadow-xl p-2 flex flex-col gap-1.5">
        <p className="text-xs font-semibold text-muted-foreground px-2 pt-1 pb-0.5 uppercase tracking-wider">
          Nodes
        </p>
        {nodeTypes.map(([type, meta]) => {
          const Icon = iconMap[type];
          return (
            <motion.button
              key={type}
              whileHover={{ scale: 1.05, x: 4 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onAddNode(type)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-accent transition-colors text-left group"
              title={meta.description}
            >
              <div
                className="p-1 rounded-md"
                style={{ backgroundColor: `${meta.color}15` }}
              >
                <Icon
                  className="w-4 h-4"
                  style={{ color: meta.color }}
                />
              </div>
              <span className="text-sm font-medium text-foreground group-hover:text-foreground/90">
                {meta.label}
              </span>
              <Plus className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

export default memo(WorkflowToolbar);
