/**
 * useV2SessionStream — SSE consumer hook for V2 agent session live events.
 *
 * Connects to /api/v2-bridge?path=agent-sessions/:id/stream via EventSource.
 * Returns typed events, connection status, and accumulated event log.
 *
 * PHASE 6: V2 Live Panel + Steering (U3.5)
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ── Event Types ───────────────────────────────────────────────────────────

export interface V2StreamEvent {
  type:
    | "session_started"
    | "phase_progress"
    | "file_edit"
    | "deploy_status"
    | "error"
    | "completion"
    | "terminal"
    | "code_change"
    | "deploy"
    | "connected";
  sessionId: string;
  timestamp: number;
  data: {
    phase?: string;
    progress?: number;
    filePath?: string;
    fileDiff?: string;
    deployUrl?: string;
    deployState?: string;
    message?: string;
    error?: string;
    status?: string;
    prUrl?: string;
    branchName?: string;
    summary?: string;
    [key: string]: unknown;
  };
}

export type StreamStatus = "idle" | "connecting" | "connected" | "closed" | "error";

export interface UseV2SessionStreamResult {
  events: V2StreamEvent[];
  status: StreamStatus;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  clearEvents: () => void;
}

const RECONNECT_DELAY_MS = 3000;
const MAX_EVENTS = 500;

/**
 * Hook to consume SSE events from a V2 agent session.
 * Auto-reconnects on connection loss unless session is terminal.
 */
export function useV2SessionStream(
  sessionId: string | null,
  sessionStatus?: string,
): UseV2SessionStreamResult {
  const [events, setEvents] = useState<V2StreamEvent[]>([]);
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const isTerminalStatus =
    sessionStatus &&
    ["completed", "failed", "aborted"].includes(sessionStatus);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setStatus("closed");
  }, []);

  const connect = useCallback(() => {
    if (!sessionId || isTerminalStatus) return;

    disconnect();

    setStatus("connecting");
    setError(null);

    const es = new EventSource(
      `/api/v2-bridge?path=agent-sessions/${sessionId}/stream`,
    );
    eventSourceRef.current = es;

    es.onopen = () => {
      setStatus("connected");
      setError(null);
    };

    es.onmessage = (e: MessageEvent) => {
      try {
        const event: V2StreamEvent = JSON.parse(e.data);
        setEvents((prev) => {
          const next = [...prev, event];
          // Prune old events if over limit
          return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next;
        });

        // Terminal event closes the stream
        if (event.type === "terminal" || event.type === "completion") {
          setStatus("closed");
          es.close();
          eventSourceRef.current = null;
        }
      } catch {
        // Parse error — ignore malformed events
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;

      // Only reconnect if not terminal
      if (!isTerminalStatus && status !== "closed") {
        setStatus("error");
        setError("SSE connection lost. Reconnecting…");
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, RECONNECT_DELAY_MS);
      } else {
        setStatus("closed");
      }
    };
  }, [sessionId, isTerminalStatus, disconnect, status]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  // Auto-connect when sessionId changes
  useEffect(() => {
    if (sessionId && !isTerminalStatus) {
      connect();
    } else {
      disconnect();
    }
    return () => {
      disconnect();
    };
  }, [sessionId, isTerminalStatus]);

  // If session becomes terminal, disconnect
  useEffect(() => {
    if (isTerminalStatus) {
      disconnect();
    }
  }, [isTerminalStatus, disconnect]);

  return { events, status, error, connect, disconnect, clearEvents };
}

// ── Helpers ───────────────────────────────────────────────────────────────

export const EVENT_LABELS: Record<string, string> = {
  session_started: "Session Started",
  phase_progress: "Phase Progress",
  file_edit: "File Edited",
  deploy_status: "Deploy Status",
  error: "Error",
  completion: "Complete",
  terminal: "Terminal",
  code_change: "Code Change",
  deploy: "Deploy",
  connected: "Connected",
};

export const EVENT_COLORS: Record<string, string> = {
  session_started: "text-blue-600 dark:text-blue-400",
  phase_progress: "text-emerald-600 dark:text-emerald-400",
  file_edit: "text-amber-600 dark:text-amber-400",
  deploy_status: "text-indigo-600 dark:text-indigo-400",
  error: "text-red-600 dark:text-red-400",
  completion: "text-purple-600 dark:text-purple-400",
  terminal: "text-muted-foreground",
  code_change: "text-amber-600 dark:text-amber-400",
  deploy: "text-indigo-600 dark:text-indigo-400",
  connected: "text-blue-500",
};
