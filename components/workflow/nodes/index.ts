/**
 * Workflow Node Registry — maps node types to their React components.
 */

import TriggerNode from "./TriggerNode";
import ActionNode from "./ActionNode";
import ConditionalNode from "./ConditionalNode";
import ParallelNode from "./ParallelNode";
import TransformNode from "./TransformNode";
import AINode from "./AINode";
import OutputNode from "./OutputNode";

export const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  conditional: ConditionalNode,
  parallel: ParallelNode,
  transform: TransformNode,
  ai: AINode,
  output: OutputNode,
};

export {
  TriggerNode,
  ActionNode,
  ConditionalNode,
  ParallelNode,
  TransformNode,
  AINode,
  OutputNode,
};
