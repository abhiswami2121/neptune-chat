"use client";

import { memo } from "react";
import {
  BaseEdge,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import { motion } from "framer-motion";

interface AnimatedWorkflowEdgeProps extends EdgeProps {
  data?: {
    animated?: boolean;
    flowColor?: string;
    label?: string;
  };
}

function AnimatedWorkflowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: AnimatedWorkflowEdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const flowColor = data?.flowColor || "#6366F1";
  const isAnimated = data?.animated !== false;

  return (
    <>
      {/* Base edge */}
      <BaseEdge
        id={id}
        path={edgePath}
        className={selected ? "!stroke-2" : ""}
        style={{
          stroke: selected ? flowColor : `${flowColor}60`,
          strokeWidth: selected ? 2.5 : 2,
        }}
      />

      {/* Animated data flow dots */}
      {isAnimated && (
        <motion.circle
          r={3}
          fill={flowColor}
          className="drop-shadow-sm"
          animate={{ offsetDistance: ["0%", "100%"] }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "linear",
            repeatDelay: 0.3,
          }}
          style={{
            offsetPath: `path("${edgePath}")`,
          }}
        />
      )}

      {/* Edge label */}
      {data?.label && (
        <foreignObject
          width={100}
          height={24}
          x={labelX - 50}
          y={labelY - 12}
          className="overflow-visible pointer-events-none"
        >
          <div className="flex items-center justify-center">
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-background border shadow-sm text-muted-foreground">
              {data.label}
            </span>
          </div>
        </foreignObject>
      )}
    </>
  );
}

export default memo(AnimatedWorkflowEdge);
