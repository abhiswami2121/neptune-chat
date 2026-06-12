/**
 * V2 Sessions List — U2.5A.3
 *
 * Lists all Neptune V2 agent prompting sessions via the bridge API.
 * Shows status, goal, model, duration, and a link to the live detail view.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bot,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ExternalLink,
  Loader2,
} from "lucide-react";

interface V2Session {
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

const STATUS_ICONS: Record<string, React.ReactNode> = {
  started: <Clock className="w-4 h-4 text-blue-500" />,
  running: <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />,
  completed: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  failed: <XCircle className="w-4 h-4 text-red-500" />,
  aborted: <AlertTriangle className="w-4 h-4 text-amber-500" />,
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function V2SessionsPage() {
  const [sessions, setSessions] = useState<V2Session[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSessions() {
      try {
        const res = await fetch("/api/v2-bridge?path=agent-sessions&limit=50");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setSessions(data.sessions || []);
        setTotal(data.total || 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    fetchSessions();
  }, []);

  return (
    <div className="flex flex-col h-full p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">V2 Agent Sessions</h1>
          <p className="text-sm text-muted-foreground">
            {total} sessions · Neptune V2 prompting infrastructure
          </p>
        </div>
        <Link
          href="/chat"
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Bot size={16} />
          New Session
        </Link>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="p-4 rounded-md bg-destructive/10 text-destructive text-sm">
          Error: {error}
        </div>
      )}

      {!loading && !error && sessions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Bot size={48} className="mb-4" />
          <p className="text-lg font-medium">No V2 sessions yet</p>
          <p className="text-sm">Start a new coding task with spawn_v2 to see sessions here.</p>
        </div>
      )}

      <div className="space-y-2">
        {sessions.map((session) => (
          <Link
            key={session.id}
            href={`/v2-sessions/${session.id}`}
            className="block p-4 rounded-lg border hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {STATUS_ICONS[session.status] || <Bot className="w-4 h-4" />}
                  <span className="font-medium truncate">
                    {session.goal || `Session ${session.id.slice(0, 8)}`}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {session.model && <span>{session.model}</span>}
                  {session.repo && <span>{session.repo}</span>}
                  {session.durationMs && <span>{formatDuration(session.durationMs)}</span>}
                  <span>{formatTime(session.createdAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {session.prUrl && (
                  <a
                    href={session.prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 rounded hover:bg-muted"
                    title="View PR"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted capitalize">
                  {session.status}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
