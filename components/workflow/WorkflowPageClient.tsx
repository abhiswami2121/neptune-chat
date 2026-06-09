"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutTemplate, Download, Upload, Trash2, Wand2 } from "lucide-react";
import WorkflowCanvas from "./WorkflowCanvas";
import type { WorkflowNode, WorkflowEdge, WorkflowDefinition } from "@/lib/workflow/types";
import { BUILTIN_TEMPLATES } from "@/lib/workflow/templates";

interface WorkflowPageClientProps {
  hasSession: boolean;
}

export default function WorkflowPageClient({ hasSession }: WorkflowPageClientProps) {
  const [activeTemplate, setActiveTemplate] = useState<WorkflowDefinition | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  // Load a template onto the canvas
  const handleLoadTemplate = useCallback((template: WorkflowDefinition) => {
    setActiveTemplate(template);
    setShowTemplates(false);
  }, []);

  // Handle workflow execution
  const handleExecute = useCallback(
    (nodes: WorkflowNode[], edges: WorkflowEdge[]) => {
      console.log("[Workflow] Executing:", { nodeCount: nodes.length, edgeCount: edges.length });

      // In a full implementation, this would:
      // 1. POST to /api/workflow/run with the workflow definition
      // 2. Open an SSE connection for real-time progress
      // 3. Update node statuses as events come in

      // For now, mark all nodes as running, then done after 2s
      // (simulated execution for demo purposes)
      const updatedNodes = nodes.map((n) => ({
        ...n,
        data: { ...n.data, status: "running" as const },
      }));
      // In real implementation, this would use setState from the canvas
    },
    []
  );

  // Handle agent-driven workflow generation
  const handleAgentPrompt = useCallback(
    async (prompt: string) => {
      try {
        // Send to the agent tool for workflow generation
        const res = await fetch("/api/workflow/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.workflow) {
            handleLoadTemplate(data.workflow);
          }
        }
      } catch (err) {
        console.error("[Workflow] Agent generation failed:", err);
      }
    },
    [handleLoadTemplate]
  );

  if (!hasSession) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center p-8"
        >
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Wand2 className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Sign in to access workflows</h2>
          <p className="text-sm text-muted-foreground">
            Build, execute, and automate workflows on a visual canvas.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b p-3 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-semibold">Workflows</h1>
          <p className="text-xs text-muted-foreground">
            Visual workflow builder — drag nodes, connect, execute
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Templates button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowTemplates(!showTemplates)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border bg-card hover:bg-accent transition-colors"
          >
            <LayoutTemplate className="w-3.5 h-3.5" />
            Templates
          </motion.button>
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 relative min-h-0">
        {activeTemplate ? (
          <WorkflowCanvas
            key={activeTemplate.id}
            initialNodes={activeTemplate.nodes}
            initialEdges={activeTemplate.edges}
            onExecute={handleExecute}
            onAgentPrompt={handleAgentPrompt}
          />
        ) : (
          <WorkflowCanvas
            onExecute={handleExecute}
            onAgentPrompt={handleAgentPrompt}
          />
        )}

        {/* Templates panel */}
        <AnimatePresence>
          {showTemplates && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-background/50 z-30"
                onClick={() => setShowTemplates(false)}
              />
              <motion.div
                initial={{ x: 300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 300, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="absolute right-0 top-0 bottom-0 w-80 bg-card border-l shadow-2xl z-40 overflow-y-auto"
              >
                <div className="p-4 border-b sticky top-0 bg-card">
                  <h3 className="font-semibold">Starter Templates</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Load a pre-built workflow to get started
                  </p>
                </div>
                <div className="p-3 space-y-2">
                  {BUILTIN_TEMPLATES.map((template) => (
                    <motion.button
                      key={template.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleLoadTemplate(template)}
                      className="w-full text-left p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium">{template.name}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {template.category}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {template.description}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {template.nodes.length} nodes · {template.edges.length} connections
                      </p>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
