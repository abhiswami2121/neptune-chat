/**
 * V2 Session Detail — U2.5A.3
 *
 * Live SSE event feed for a single V2 agent session.
 * Shows session metadata + real-time event stream from V2 bridge.
 */

"use client";

import { useEffect, useState, useRef, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Terminal,
} from "lucide-react";

interface SessionDetail {
  id: string;
  goal?: string;
  model?: string;
  status: string;
  mode?: string;
  repo?: string;
  branch?: string;
  prUrl?: string;
  deployUrl?: string;
  error?: string;
  sandboxId?: string;
  durationMs?: number;
  startedAt: string;
  completedAt?: string;
  createdAt: string;
}

interface StreamEvent {
  type: string;
  sessionId: string;
  timestamp: number;
  data: Record<string, unknown>;
}

const EVENT_COLORS: Record<string, string> = {
  connected: "text-blue-500",
  session_started: "text-green-500",
  phase_completed: "text-emerald-500",
  error: "text-red-500",
  completion: "text-purple-500",
  code_change: "text-amber-500",
  deploy: "text-indigo-500",
  terminal: "text-muted-foreground",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function V2SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [streamStatus, setStreamStatus] = useState<"connecting" | "connected" | "closed">("connecting");
  const eventLogRef = useRef<HTMLDivElement>(null);

  // Fetch session detail
  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch(`/api/v2-bridge?path=agent-sessions/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setSession(data);
      } catch (err) {
        console.error("Failed to load session:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchSession();
  }, [id]);

  // Connect to SSE stream
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      setStreamStatus("connecting");
      eventSource = new EventSource(`/api/v2-bridge?path=agent-sessions/${id}/stream`);

      eventSource.onopen = () => {
        setStreamStatus("connected");
      };

      eventSource.onmessage = (e) => {
        try {
          const event: StreamEvent = JSON.parse(e.data);
          setEvents((prev) => [...prev, event]);

          // If terminal event, close
          if (event.type === "terminal") {
            setStreamStatus("closed");
            eventSource?.close();
            setSession((prev) =>
              prev ? { ...prev, status: event.data.status as string } : prev
            );
          }
        } catch {
          // Ignore parse errors
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        if (streamStatus !== "closed") {
          reconnectTimeout = setTimeout(connect, 3000);
        }
      };
    }

    // Only connect if session isn't already terminal
    if (session && !["completed", "failed", "aborted"].includes(session.status)) {
      connect();
    }

    return () => {
      eventSource?.close();
      clearTimeout(reconnectTimeout);
    };
  }, [id, session?.status]);

  // Auto-scroll event log
  useEffect(() => {
    if (eventLogRef.current) {
      eventLogRef.current.scrollTop = eventLogRef.current.scrollHeight;
    }
  }, [events]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-6">
        <Link href="/v2-sessions" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft size={16} />
          Back to sessions
        </Link>
        <div className="text-center py-12 text-muted-foreground">
          Session not found
        </div>
      </div>
    );
  }

  const isTerminal = ["completed", "failed", "aborted"].includes(session.status);

  return (
    <div className="flex flex-col h-full p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/v2-sessions" className="p-1.5 rounded hover:bg-muted">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold truncate">
            {session.goal || `Session ${session.id.slice(0, 8)}`}
          </h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="capitalize">{session.status}</span>
            {session.model && <span>· {session.model}</span>}
            {session.durationMs && <span>· {Math.round(session.durationMs / 1000)}s</span>}
            {session.repo && <span>· {session.repo}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {session.prUrl && (
            <a href={session.prUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border hover:bg-muted">
              <ExternalLink size={14} /> PR
            </a>
          )}
          {session.deployUrl && (
            <a href={session.deployUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
              <ExternalLink size={14} /> Deploy
            </a>
          )}
          {!isTerminal && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={`w-2 h-2 rounded-full ${streamStatus === "connected" ? "bg-green-500" : "bg-amber-500"}`} />
              {streamStatus === "connected" ? "Live" : streamStatus === "connecting" ? "Connecting..." : "Closed"}
            </span>
          )}
        </div>
      </div>

      {/* Error display */}
      {session.error && (
        <div className="p-4 mb-4 rounded-md bg-destructive/10 border border-destructive/20">
          <div className="flex items-center gap-2 text-sm font-medium text-destructive mb-1">
            <AlertTriangle size={16} /> Error
          </div>
          <pre className="text-xs text-destructive/80 whitespace-pre-wrap">{session.error}</pre>
        </div>
      )}

      {/* Live event feed */}
      <div className="flex-1 border rounded-lg overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
          <Terminal size={14} />
          <span className="text-xs font-medium">Event Stream</span>
          <span className="text-xs text-muted-foreground ml-auto">{events.length} events</span>
        </div>
        <div ref={eventLogRef} className="flex-1 overflow-y-auto p-4 font-mono text-xs">
          {events.length === 0 && !isTerminal && (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Waiting for events...
            </div>
          )}
          {events.length === 0 && isTerminal && (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <CheckCircle2 className="w-4 h-4" />
              Session complete. No events streamed.
            </div>
          )}
          {events.map((event, i) => (
            <div key={i} className="flex gap-2 py-0.5 hover:bg-muted/30 px-1 rounded">
              <span className="text-muted-foreground shrink-0">
                {new Date(event.timestamp).toLocaleTimeString("en-US", { hour12: false })}
              </span>
              <span className={EVENT_COLORS[event.type] || "text-foreground"}>
                [{event.type}]
              </span>
              <span className="text-muted-foreground truncate">
                {Object.entries(event.data).map(([k, v]) => `${k}=${v}`).join(" ") || "—"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
