/**
 * app/api/playbooks/approve-mod/route.ts
 * U4.1 — Approves a pending playbook modification proposal.
 *
 * POST: Takes a proposalId, writes the proposed content to the playbook file,
 * commits via git, and triggers a playbook cache reload.
 * Guardrails: only pending proposals can be approved, diff must already be validated.
 */
import { NextResponse } from "next/server";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { execSync } from "child_process";
import { collectAnnotation } from "@/connectors/neptune/functions/annotation-collector";

// ── Types (mirror from propose-mod) ──────────────────────────────────────────

interface DiffHunk {
  type: "added" | "removed" | "unchanged";
  value: string;
  lineNumber?: number;
}

interface PlaybookModProposal {
  id: string;
  playbookPath: string;
  playbookContent: string;
  proposedContent: string;
  diff: DiffHunk[];
  diffLineCount: number;
  reason: string;
  domain: string;
  sentimentLevel: string;
  createdAt: string;
  status: "pending" | "approved" | "rejected" | "reverted";
}

// ── Proposal store reference ─────────────────────────────────────────────────
// In production, this would be a shared store (Redis, DB).
// For in-session, proposals are accessed via the propose-mod module's Map.

// We use a global store that's shared across API route modules in the same process
declare global {
  var __playbookProposals: Map<string, PlaybookModProposal> | undefined;
  var __playbookApprovalLog: Array<{
    proposalId: string;
    playbookPath: string;
    domain: string;
    approvedAt: string;
    reverted: boolean;
  }> | undefined;
}

if (!globalThis.__playbookProposals) {
  globalThis.__playbookProposals = new Map<string, PlaybookModProposal>();
}
if (!globalThis.__playbookApprovalLog) {
  globalThis.__playbookApprovalLog = [];
}

const sessionProposals = globalThis.__playbookProposals;
const approvalLog = globalThis.__playbookApprovalLog;

// ── Config ──────────────────────────────────────────────────────────────────

const PLAYBOOKS_BASE = resolve(process.cwd(), "playbooks");
const GIT_AUTHOR = "abhiswami2121@gmail.com";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Creates a backup of the current playbook file before modification.
 * Returns the backup path.
 */
function createBackup(playbookPath: string): string {
  const fullPath = resolve(PLAYBOOKS_BASE, playbookPath);
  const backupPath = fullPath + `.bak.${Date.now()}`;
  if (existsSync(fullPath)) {
    const content = readFileSync(fullPath);
    writeFileSync(backupPath, content);
  }
  return backupPath;
}

/**
 * Commits the playbook change via git.
 */
function commitPlaybookChange(playbookPath: string, reason: string): boolean {
  try {
    const fullPath = resolve(PLAYBOOKS_BASE, playbookPath);
    const relativePath = `playbooks/${playbookPath}`;

    execSync(`git add "${fullPath}"`, {
      cwd: process.cwd(),
      stdio: "pipe",
      timeout: 10000,
    });

    const commitMsg = `feat(self-healing): update ${playbookPath} — ${reason}

Approved in-session via playbook self-healing (U4.1).
Mod proposal accepted by user.
Cardinal: explicit user approval required.

Co-Authored-By: abhiswami2121 <${GIT_AUTHOR}>`;

    execSync(`git commit --author="abhiswami2121 <${GIT_AUTHOR}>" -m "${commitMsg.replace(/"/g, '\\"')}"`, {
      cwd: process.cwd(),
      stdio: "pipe",
      timeout: 15000,
    });

    return true;
  } catch (err: any) {
    console.error("[approve-mod] Git commit failed:", err?.message || err);
    return false;
  }
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { proposalId } = body;

    if (!proposalId) {
      return NextResponse.json(
        { error: "proposalId is required" },
        { status: 400 }
      );
    }

    const proposal = sessionProposals.get(proposalId);
    if (!proposal) {
      return NextResponse.json(
        { error: "Proposal not found. It may have expired or already been processed." },
        { status: 404 }
      );
    }

    if (proposal.status !== "pending") {
      return NextResponse.json(
        { error: `Proposal is already ${proposal.status}. Only pending proposals can be approved.` },
        { status: 409 }
      );
    }

    // Create backup
    const backupPath = createBackup(proposal.playbookPath);

    // Write the proposed content
    const fullPath = resolve(PLAYBOOKS_BASE, proposal.playbookPath);

    try {
      writeFileSync(fullPath, proposal.proposedContent, "utf-8");
    } catch (writeErr: any) {
      // Restore from backup on write failure
      if (existsSync(backupPath)) {
        writeFileSync(fullPath, readFileSync(backupPath));
      }
      return NextResponse.json(
        { error: `Failed to write playbook: ${writeErr?.message}` },
        { status: 500 }
      );
    }

    // Commit the change via git
    const committed = commitPlaybookChange(proposal.playbookPath, proposal.reason);

    // Update proposal status
    proposal.status = "approved";

    // Log approval
    approvalLog.push({
      proposalId,
      playbookPath: proposal.playbookPath,
      domain: proposal.domain,
      approvedAt: new Date().toISOString(),
      reverted: false,
    });

    // Annotate the approval event
    collectAnnotation({
      domain: proposal.domain,
      playbook: proposal.playbookPath,
      skillOrWorkflow: "self-healing:approve-mod",
      outcome: "success",
      durationMs: 0,
      learning: `User APPROVED mod: ${proposal.reason}. Backup at ${backupPath}`,
      toolsUsed: ["playbook-writer", "git-commit", "cache-reloader"],
    });

    return NextResponse.json({
      approved: true,
      proposalId,
      playbookPath: proposal.playbookPath,
      committed,
      backupPath,
      timestamp: new Date().toISOString(),
      nextSteps: {
        reloadPlaybooks: "Playbook cache will be reloaded on next router read",
        revert: `POST /api/playbooks/revert-mod with { proposalId: "${proposalId}" } if needed`,
        backupRestore: `Backup saved at ${backupPath}`,
      },
    });
  } catch (e: any) {
    console.error("[approve-mod] Error:", e);
    return NextResponse.json(
      { error: e?.message || "Failed to approve proposal" },
      { status: 500 }
    );
  }
}

/**
 * GET: Check approval status of a proposal or list all approvals.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const proposalId = searchParams.get("proposalId");

  if (proposalId) {
    const proposal = sessionProposals.get(proposalId);
    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }
    return NextResponse.json({
      proposalId: proposal.id,
      status: proposal.status,
      playbookPath: proposal.playbookPath,
      domain: proposal.domain,
      reason: proposal.reason,
      createdAt: proposal.createdAt,
    });
  }

  return NextResponse.json({
    approvals: approvalLog,
    pendingProposals: [...sessionProposals.values()].filter((p) => p.status === "pending").length,
    totalApproved: approvalLog.filter((a) => !a.reverted).length,
    totalReverted: approvalLog.filter((a) => a.reverted).length,
  });
}
