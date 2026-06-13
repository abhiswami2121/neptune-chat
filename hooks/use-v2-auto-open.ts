/**
 * useV2AutoOpen — Watches chat messages for spawnCodingAgent tool results
 * and auto-opens the V2 Live Panel when a new session is spawned.
 *
 * PHASE 6: V2 Live Panel + Steering (U3.5)
 */

"use client";

import { useEffect, useRef } from "react";
import { useV2Session } from "@/hooks/use-v2-session";

interface SpawnCodingAgentResult {
  success?: boolean;
  mode?: string;
  sessionId?: string;
  sandboxId?: string;
  status?: string;
  repo?: string;
  branch?: string;
  goal?: string;
  model?: string;
  message?: string;
}

/**
 * Hook that watches messages for spawnCodingAgent tool invocations
 * and opens the V2 Live Panel when a session is spawned.
 *
 * Usage: Call this inside ChatShell or any component with access to messages.
 */
export function useV2AutoOpen(messages: Array<{ id: string; role: string; parts?: Array<{ type: string; [key: string]: unknown }> }>) {
  const { openSession, isPanelOpen } = useV2Session();
  const processedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Walk through messages looking for spawnCodingAgent tool results
    for (const msg of messages) {
      if (msg.role !== "assistant") continue;

      for (const part of msg.parts || []) {
        // Check for tool-invocation parts
        if (part.type !== "tool-invocation") continue;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toolPart = part as any;
        if (
          toolPart.toolName !== "spawnCodingAgent" &&
          toolPart.toolName !== "spawnV2Session" &&
          toolPart.toolName !== "postV2Session"
        )
          continue;

        // Only process results (not calls)
        if (toolPart.state !== "result") continue;

        // Build a unique key for this invocation
        const key = `${msg.id}-${toolPart.toolCallId}`;
        if (processedIdsRef.current.has(key)) continue;

        const result = toolPart.result as SpawnCodingAgentResult | undefined;
        if (!result?.success) continue;

        const sessionId = result.sessionId || result.sandboxId;
        if (!sessionId) continue;

        // Mark as processed
        processedIdsRef.current.add(key);

        // Auto-open the panel if not already open
        if (!isPanelOpen) {
          openSession({
            sessionId,
            goal: result.goal || result.message?.slice(0, 100),
            repo: result.repo,
            branch: result.branch,
            model: result.model || "deepseek-v4-pro",
          });
        }
      }
    }
  }, [messages, openSession, isPanelOpen]);
}
