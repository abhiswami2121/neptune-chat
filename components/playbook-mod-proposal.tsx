/**
 * components/playbook-mod-proposal.tsx
 * U4.1 — In-chat approval UI for playbook modification proposals.
 *
 * Renders a diff view of proposed playbook changes with Approve/Reject buttons.
 * Integrated into the chat message stream when a self-healing proposal is triggered.
 *
 * Design:
 * - Compact card with diff preview (ProseMirror-based diff view)
 * - Color-coded: green = additions, red = removals, bg = context
 * - Approve (emerald) / Reject (red) buttons with confirmation
 * - Shows reason, domain, sentiment level, and line count
 * - Accessible: keyboard navigable, screen reader friendly
 */
"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ── Types ───────────────────────────────────────────────────────────────────

interface DiffHunk {
  type: "added" | "removed" | "unchanged";
  value: string;
  lineNumber?: number;
}

interface PlaybookModProposal {
  id: string;
  playbookPath: string;
  diff: DiffHunk[];
  diffLineCount: number;
  reason: string;
  domain: string;
  sentimentLevel: string;
  createdAt: string;
  status: "pending" | "approved" | "rejected" | "reverted";
}

interface PlaybookModProposalProps {
  proposal: PlaybookModProposal;
  onApprove: (proposalId: string) => Promise<void>;
  onReject: (proposalId: string) => Promise<void>;
  className?: string;
}

// ── Sentiment Badge Colors ───────────────────────────────────────────────────

const SENTIMENT_COLORS: Record<string, string> = {
  none: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  low: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  medium: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  unavailable: "bg-gray-100 text-gray-500",
};

const DOMAIN_COLORS: Record<string, string> = {
  billing: "bg-emerald-100 text-emerald-700",
  "customer-support": "bg-blue-100 text-blue-700",
  disputes: "bg-purple-100 text-purple-700",
  engineering: "bg-cyan-100 text-cyan-700",
  "agent-orchestration": "bg-indigo-100 text-indigo-700",
  "vps-ops": "bg-teal-100 text-teal-700",
  reporting: "bg-amber-100 text-amber-700",
  marketing: "bg-pink-100 text-pink-700",
  HR: "bg-rose-100 text-rose-700",
};

// ── Diff Line Component ─────────────────────────────────────────────────────

function DiffLine({ hunk }: { hunk: DiffHunk }) {
  const prefix = hunk.type === "added" ? "+" : hunk.type === "removed" ? "-" : " ";
  const lineClass =
    hunk.type === "added"
      ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-l-2 border-emerald-400"
      : hunk.type === "removed"
        ? "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 border-l-2 border-red-400"
        : "text-muted-foreground";

  const lines = hunk.value.split("\n").filter((l) => l !== "" || hunk.value === "\n");

  return (
    <>
      {lines.map((line, i) => (
        <div
          key={`${hunk.lineNumber}-${i}`}
          className={`font-mono text-xs px-2 py-0.5 whitespace-pre-wrap ${lineClass}`}
        >
          <span className="select-none mr-2 text-muted-foreground/50 w-4 inline-block text-right">
            {prefix}
          </span>
          {line || " "}
        </div>
      ))}
    </>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function PlaybookModProposal({
  proposal,
  onApprove,
  onReject,
  className = "",
}: PlaybookModProposalProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [status, setStatus] = useState(proposal.status);
  const [showConfirmApprove, setShowConfirmApprove] = useState(false);
  const [showConfirmReject, setShowConfirmReject] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = useCallback(async () => {
    setIsApproving(true);
    setError(null);
    try {
      await onApprove(proposal.id);
      setStatus("approved");
      setShowConfirmApprove(false);
    } catch (e: any) {
      setError(e?.message || "Failed to approve proposal");
    } finally {
      setIsApproving(false);
    }
  }, [proposal.id, onApprove]);

  const handleReject = useCallback(async () => {
    setIsRejecting(true);
    setError(null);
    try {
      await onReject(proposal.id);
      setStatus("rejected");
      setShowConfirmReject(false);
    } catch (e: any) {
      setError(e?.message || "Failed to reject proposal");
    } finally {
      setIsRejecting(false);
    }
  }, [proposal.id, onReject]);

  const domainColor = DOMAIN_COLORS[proposal.domain] || "bg-gray-100 text-gray-700";
  const sentimentColor = SENTIMENT_COLORS[proposal.sentimentLevel] || "";

  if (status !== "pending") {
    return (
      <div className={`rounded-lg border p-4 ${className}`}>
        <div className="flex items-center gap-2">
          <Badge variant={status === "approved" ? "default" : "destructive"}>
            {status === "approved" ? "✓ Approved" : "✗ Rejected"}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Playbook mod for <span className="font-medium">{proposal.playbookPath}</span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`rounded-lg border shadow-sm ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">🔧 Playbook Mod Proposal</span>
            <Badge className={domainColor} variant="outline">
              {proposal.domain}
            </Badge>
            <Badge className={sentimentColor} variant="outline">
              {proposal.sentimentLevel}
            </Badge>
            <Badge variant="secondary">
              {proposal.diffLineCount} lines
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            {new Date(proposal.createdAt).toLocaleTimeString()}
          </span>
        </div>

        {/* Reason */}
        <div className="px-4 py-2 bg-muted/10 border-b">
          <p className="text-sm">
            <span className="font-medium text-muted-foreground">Reason: </span>
            {proposal.reason}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            File: <code className="text-xs bg-muted px-1 py-0.5 rounded">{proposal.playbookPath}</code>
          </p>
        </div>

        {/* Diff Preview */}
        <div className="max-h-64 overflow-y-auto border-b">
          <div className="font-mono text-xs leading-relaxed">
            {proposal.diff.length === 0 ? (
              <div className="px-4 py-6 text-center text-muted-foreground text-sm">
                No differences detected — the proposed content is identical to current.
              </div>
            ) : (
              proposal.diff.slice(0, 80).map((hunk, i) => (
                <DiffLine key={i} hunk={hunk} />
              ))
            )}
            {proposal.diff.length > 80 && (
              <div className="px-4 py-2 text-center text-xs text-muted-foreground bg-muted/20">
                ... {proposal.diff.length - 80} more hunks truncated in preview
              </div>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-2 bg-red-50 dark:bg-red-950/20 border-b text-sm text-red-600">
            ⚠ {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between px-4 py-3 bg-muted/10">
          <p className="text-xs text-muted-foreground">
            This change requires your explicit approval.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfirmReject(true)}
              disabled={isRejecting || isApproving}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              {isRejecting ? "Rejecting..." : "Reject"}
            </Button>
            <Button
              size="sm"
              onClick={() => setShowConfirmApprove(true)}
              disabled={isApproving || isRejecting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isApproving ? "Approving..." : "Approve"}
            </Button>
          </div>
        </div>
      </div>

      {/* Confirm Approve Dialog */}
      <AlertDialog open={showConfirmApprove} onOpenChange={setShowConfirmApprove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Playbook Modification?</AlertDialogTitle>
            <AlertDialogDescription>
              This will write the proposed changes to{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">{proposal.playbookPath}</code>{" "}
              and commit them via git. A backup will be created. You can revert this change
              if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApprove}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Yes, Approve Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Reject Dialog */}
      <AlertDialog open={showConfirmReject} onOpenChange={setShowConfirmReject}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject This Proposal?</AlertDialogTitle>
            <AlertDialogDescription>
              The proposed changes to{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">{proposal.playbookPath}</code>{" "}
              will be discarded. No changes will be made to the playbook.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Yes, Reject Proposal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Utility: Fetch proposal from API ────────────────────────────────────────

export async function fetchProposal(proposalId: string): Promise<PlaybookModProposal> {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const res = await fetch(`${base}/api/playbooks/propose-mod?proposalId=${proposalId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `Failed to fetch proposal: ${res.status}`);
  }
  const data = await res.json();
  return data.proposal;
}

export async function approveProposal(proposalId: string): Promise<void> {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const res = await fetch(`${base}/api/playbooks/approve-mod`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ proposalId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `Approval failed: ${res.status}`);
  }
}

export async function rejectProposal(proposalId: string): Promise<void> {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const res = await fetch(`${base}/api/playbooks/propose-mod?proposalId=${proposalId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `Rejection failed: ${res.status}`);
  }
}
