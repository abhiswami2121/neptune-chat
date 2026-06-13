/**
 * V2LivePanel — Right-side Sheet overlay showing live V2 agent session.
 *
 * PHASE 6: V2 Live Panel + Steering (U3.5)
 *
 * Auto-opens when spawnCodingAgent returns a sessionId.
 * Features:
 *   - Live SSE event stream with typed event renderers
 *   - Pause / Resume / Cancel controls
 *   - Mid-execution message input
 *   - File diff preview for code changes
 *   - Deploy URL link on completion
 *   - Mobile: bottom sheet variant
 */

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  X,
  Pause,
  Play,
  Square,
  Terminal,
  ExternalLink,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Send,
  Wifi,
  WifiOff,
  FileCode,
  Rocket,
  Bot,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import {
  useV2SessionStream,
  type V2StreamEvent,
  type StreamStatus,
  EVENT_LABELS,
  EVENT_COLORS,
} from "@/hooks/use-v2-session-stream";

// ── Types ─────────────────────────────────────────────────────────────────

export interface V2LivePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string | null;
  goal?: string;
  repo?: string;
  branch?: string;
  model?: string;
}

interface DiffPreviewProps {
  filePath: string;
  diff: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatDuration(startedAt?: string): string {
  if (!startedAt) return "";
  const diff = Date.now() - new Date(startedAt).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s`;
  return `${Math.floor(diff / 60000)}m ${Math.floor((diff % 60000) / 1000)}s`;
}

const STATUS_ICON: Record<StreamStatus, React.ReactNode> = {
  idle: <WifiOff className="w-3 h-3 text-muted-foreground" />,
  connecting: <Loader2 className="w-3 h-3 text-amber-500 animate-spin" />,
  connected: <Wifi className="w-3 h-3 text-emerald-500" />,
  closed: <CheckCircle2 className="w-3 h-3 text-muted-foreground" />,
  error: <AlertTriangle className="w-3 h-3 text-red-500" />,
};

// ── Diff Preview ──────────────────────────────────────────────────────────

function DiffPreview({ filePath, diff }: DiffPreviewProps) {
  const [expanded, setExpanded] = useState(false);

  // Colorize diff lines: + = green, - = red
  const coloredLines = diff.split("\n").map((line, i) => {
    let colorClass = "text-muted-foreground";
    if (line.startsWith("+") && !line.startsWith("+++"))
      colorClass = "text-emerald-600 dark:text-emerald-400";
    else if (line.startsWith("-") && !line.startsWith("---"))
      colorClass = "text-red-600 dark:text-red-400";
    else if (line.startsWith("@@")) colorClass = "text-blue-600 dark:text-blue-400";

    return (
      <div key={i} className={cn("font-mono text-xs leading-5", colorClass)}>
        {line || " "}
      </div>
    );
  });

  // Truncate if not expanded
  const displayLines = expanded ? coloredLines : coloredLines.slice(0, 15);
  const isTruncated = coloredLines.length > 15 && !expanded;

  return (
    <div className="mt-2 rounded-lg border bg-muted/30 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/50">
        <FileCode size={12} className="text-amber-500 shrink-0" />
        <span className="text-xs font-mono truncate">{filePath}</span>
      </div>
      <div className="p-2 max-h-64 overflow-y-auto">{displayLines}</div>
      {isTruncated && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full px-3 py-1 text-xs text-primary hover:bg-muted/50 border-t"
        >
          Show all {coloredLines.length} lines…
        </button>
      )}
    </div>
  );
}

// ── Event Row ─────────────────────────────────────────────────────────────

function EventRow({ event }: { event: V2StreamEvent }) {
  const colorClass = EVENT_COLORS[event.type] || "text-muted-foreground";
  const label = EVENT_LABELS[event.type] || event.type;
  const time = formatTime(event.timestamp);

  const renderData = () => {
    switch (event.type) {
      case "session_started":
        return (
          <span className="text-xs">
            Goal: {event.data.message || event.data.summary || "Started"}
          </span>
        );
      case "phase_progress":
        return (
          <span className="text-xs">
            {event.data.phase || "Phase"} —{" "}
            {event.data.progress !== undefined
              ? `${event.data.progress}%`
              : event.data.message || ""}
          </span>
        );
      case "file_edit":
      case "code_change":
        return (
          <div>
            <span className="text-xs">
              {event.data.filePath || "unknown file"}
            </span>
            {event.data.fileDiff && (
              <DiffPreview
                filePath={event.data.filePath || "unknown"}
                diff={event.data.fileDiff}
              />
            )}
          </div>
        );
      case "deploy_status":
      case "deploy":
        return (
          <span className="text-xs">
            {event.data.deployState || event.data.status || "Deploying"}…
            {event.data.deployUrl && (
              <a
                href={`https://${event.data.deployUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 inline-flex items-center gap-1 text-primary hover:underline"
              >
                <ExternalLink size={10} />
                Open
              </a>
            )}
          </span>
        );
      case "error":
        return (
          <span className="text-xs text-red-600 dark:text-red-400">
            {event.data.error || event.data.message || "Unknown error"}
          </span>
        );
      case "completion":
      case "terminal":
        return (
          <div className="text-xs space-y-1">
            <span>{event.data.summary || event.data.message || "Complete"}</span>
            {event.data.deployUrl && (
              <a
                href={`https://${event.data.deployUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline w-fit"
              >
                <Rocket size={10} />
                {event.data.deployUrl}
              </a>
            )}
            {event.data.prUrl && (
              <a
                href={event.data.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline w-fit"
              >
                <ExternalLink size={10} />
                View PR
              </a>
            )}
          </div>
        );
      default:
        return (
          <span className="text-xs text-muted-foreground">
            {event.data.message || JSON.stringify(event.data).slice(0, 80)}
          </span>
        );
    }
  };

  return (
    <div className="flex gap-2 py-1.5 px-2 rounded hover:bg-muted/30 transition-colors">
      <span className="text-[10px] text-muted-foreground shrink-0 font-mono w-16">
        {time}
      </span>
      <span className={cn("text-xs font-medium shrink-0", colorClass)}>
        [{label}]
      </span>
      <div className="flex-1 min-w-0">{renderData()}</div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export function V2LivePanel({
  open,
  onOpenChange,
  sessionId,
  goal,
  repo,
  branch,
  model,
}: V2LivePanelProps) {
  const isMobile = useIsMobile();
  const [sessionStatus, setSessionStatus] = useState<string>("running");
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const eventLogRef = useRef<HTMLDivElement>(null);

  const {
    events,
    status: streamStatus,
    error: streamError,
    connect,
    disconnect,
    clearEvents,
  } = useV2SessionStream(sessionId, sessionStatus);

  // Reset events when session changes
  useEffect(() => {
    clearEvents();
  }, [sessionId, clearEvents]);

  // Auto-scroll event log
  useEffect(() => {
    if (eventLogRef.current) {
      eventLogRef.current.scrollTop = eventLogRef.current.scrollHeight;
    }
  }, [events]);

  // Watch for terminal events to update session status
  useEffect(() => {
    const terminalEvent = events.find(
      (e) => e.type === "terminal" || e.type === "completion"
    );
    if (terminalEvent?.data.status) {
      setSessionStatus(terminalEvent.data.status as string);
    }
  }, [events]);

  const handleControlAction = useCallback(
    async (action: "pause" | "resume" | "cancel") => {
      if (!sessionId) return;
      try {
        const res = await fetch(`/api/v2/sessions/${sessionId}/control`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        if (!res.ok) {
          console.error(`Control action ${action} failed:`, res.status);
        }
      } catch (err) {
        console.error(`Control action ${action} error:`, err);
      }
    },
    [sessionId],
  );

  const handleSendMessage = useCallback(async () => {
    if (!messageInput.trim() || !sessionId) return;
    setSending(true);
    try {
      const res = await fetch(`/api/v2/sessions/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: messageInput.trim(),
          context: "Mid-execution message from Neptune Chat live panel",
        }),
      });
      if (res.ok) {
        setMessageInput("");
      }
    } catch (err) {
      console.error("Send message error:", err);
    } finally {
      setSending(false);
    }
  }, [messageInput, sessionId]);

  const isTerminal = ["completed", "failed", "aborted"].includes(sessionStatus);
  const hasDeployUrl = events.some((e) => e.data.deployUrl);

  // ── Panel Content ───────────────────────────────────────────────────
  const panelContent = (
    <div className="flex flex-col h-full">
      {/* Header: session info + control buttons */}
      <div className="shrink-0 px-4 py-3 border-b space-y-2">
        {/* Title row */}
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-primary shrink-0" />
          <span className="text-sm font-medium truncate flex-1">
            {goal || `V2 Session ${sessionId?.slice(0, 8)}`}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            {STATUS_ICON[streamStatus]}
            {streamStatus === "connected"
              ? "Live"
              : streamStatus === "connecting"
                ? "Connecting…"
                : streamStatus === "closed"
                  ? "Closed"
                  : streamStatus === "error"
                    ? "Error"
                    : "Idle"}
          </span>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          {repo && <span>{repo}</span>}
          {branch && <span>· {branch}</span>}
          {model && <span>· {model}</span>}
        </div>

        {/* Control buttons */}
        {!isTerminal && (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() =>
                handleControlAction(
                  sessionStatus === "paused" ? "resume" : "pause"
                )
              }
            >
              {sessionStatus === "paused" ? (
                <>
                  <Play size={12} /> Resume
                </>
              ) : (
                <>
                  <Pause size={12} /> Pause
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
              onClick={() => handleControlAction("cancel")}
            >
              <Square size={12} /> Cancel
            </Button>
            {streamStatus === "error" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={connect}
              >
                Reconnect
              </Button>
            )}
          </div>
        )}

        {/* Terminal status badge */}
        {isTerminal && (
          <div
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium",
              sessionStatus === "completed"
                ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600"
                : "bg-red-50 dark:bg-red-950/30 text-red-600"
            )}
          >
            {sessionStatus === "completed" ? (
              <CheckCircle2 size={12} />
            ) : (
              <XCircle size={12} />
            )}
            {sessionStatus}
          </div>
        )}

        {/* Deploy URL */}
        {hasDeployUrl && (
          <a
            href={`https://${events.find((e) => e.data.deployUrl)?.data.deployUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 hover:underline"
          >
            <Rocket size={12} />
            Open Deploy
          </a>
        )}
      </div>

      {/* Error banner */}
      {streamError && (
        <div className="shrink-0 px-4 py-2 bg-red-50 dark:bg-red-950/20 border-b border-red-200 dark:border-red-800">
          <p className="text-xs text-red-600 dark:text-red-400">
            {streamError}
          </p>
        </div>
      )}

      {/* Event log */}
      <div ref={eventLogRef} className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {events.length === 0 && !isTerminal && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            <span className="text-xs">Waiting for events…</span>
          </div>
        )}
        {events.length === 0 && isTerminal && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            <span className="text-xs">No events streamed for this session.</span>
          </div>
        )}
        {events.map((event, i) => (
          <EventRow key={i} event={event} />
        ))}
      </div>

      {/* Mid-execution message input */}
      {!isTerminal && (
        <div className="shrink-0 px-3 py-2 border-t bg-muted/20">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Send a message to the agent…"
              className="h-8 text-xs"
              disabled={sending}
            />
            <Button
              type="submit"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={!messageInput.trim() || sending}
            >
              {sending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Send size={12} />
              )}
            </Button>
          </form>
        </div>
      )}
    </div>
  );

  // ── Mobile: Bottom sheet (Drawer) ───────────────────────────────────
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[85vh] flex flex-col">
          <DrawerHeader className="shrink-0 border-b px-4 py-3">
            <DrawerTitle className="text-base flex items-center gap-2">
              <Terminal size={16} />
              V2 Agent Session
            </DrawerTitle>
            <DrawerDescription className="text-xs">
              {goal || (sessionId ? `Session ${sessionId.slice(0, 8)}` : "Live session feed")}
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 overflow-hidden">{panelContent}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  // ── Desktop: Right-side Sheet ──────────────────────────────────────
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg lg:max-w-xl p-0 flex flex-col"
        aria-label="V2 Agent Session Live Panel"
      >
        <SheetHeader className="shrink-0 flex flex-row items-center justify-between px-4 py-3 border-b space-y-0">
          <div>
            <SheetTitle className="text-sm flex items-center gap-2">
              <Terminal size={14} />
              V2 Agent Session
            </SheetTitle>
            <SheetDescription className="text-[10px]">
              {sessionId ? `ID: ${sessionId.slice(0, 12)}…` : "Live session feed"}
            </SheetDescription>
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-hidden">{panelContent}</div>
      </SheetContent>
    </Sheet>
  );
}
