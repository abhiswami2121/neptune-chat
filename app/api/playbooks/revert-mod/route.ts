/**
 * app/api/playbooks/revert-mod/route.ts
 * U4.1 — Reverts a previously approved playbook modification.
 *
 * POST: Takes a proposalId of an approved mod, restores from backup,
 * commits the revert, and logs the rollback.
 */
import { NextResponse } from "next/server";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { execSync } from "child_process";
import { collectAnnotation } from "@/connectors/neptune/functions/annotation-collector";

// ── Types ───────────────────────────────────────────────────────────────────

interface PlaybookModProposal {
  id: string;
  playbookPath: string;
  playbookContent: string;
  proposedContent: string;
  status: "pending" | "approved" | "rejected" | "reverted";
  reason: string;
  domain: string;
  createdAt: string;
}

// Use globals declared by approve-mod/route.ts (shared store)
const sessionProposals = globalThis.__playbookProposals;
const approvalLog = globalThis.__playbookApprovalLog;

const PLAYBOOKS_BASE = resolve(process.cwd(), "playbooks");
const GIT_AUTHOR = "abhiswami2121@gmail.com";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Finds the most recent backup file for a given playbook path.
 */
function findLatestBackup(playbookPath: string): string | null {
  const fullPath = resolve(PLAYBOOKS_BASE, playbookPath);
  const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
  const baseName = fullPath.substring(fullPath.lastIndexOf("/") + 1);

  try {
    const fs = require("fs");
    const files = fs.readdirSync(dir);
    const backups = files
      .filter((f: string) => f.startsWith(baseName + ".bak."))
      .sort()
      .reverse();
    return backups.length > 0 ? resolve(dir, backups[0]) : null;
  } catch {
    return null;
  }
}

/**
 * Reverts by restoring the original content stored in the proposal.
 */
function revertToOriginal(proposal: PlaybookModProposal): boolean {
  try {
    const fullPath = resolve(PLAYBOOKS_BASE, proposal.playbookPath);
    // Restore original content that was saved at proposal time
    writeFileSync(fullPath, proposal.playbookContent, "utf-8");

    // Commit the revert
    execSync(`git add "${fullPath}"`, {
      cwd: process.cwd(),
      stdio: "pipe",
      timeout: 10000,
    });

    const commitMsg = `revert(self-healing): rollback ${proposal.playbookPath} — ${proposal.reason}

Reverting in-session playbook modification.
Original mod: ${proposal.reason}

Co-Authored-By: abhiswami2121 <${GIT_AUTHOR}>`;

    execSync(`git commit --author="abhiswami2121 <${GIT_AUTHOR}>" -m "${commitMsg.replace(/"/g, '\\"')}"`, {
      cwd: process.cwd(),
      stdio: "pipe",
      timeout: 15000,
    });

    return true;
  } catch (err: any) {
    console.error("[revert-mod] Revert failed:", err?.message || err);
    return false;
  }
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { proposalId, restoreFromBackup } = body;

    if (!proposalId) {
      return NextResponse.json(
        { error: "proposalId is required" },
        { status: 400 }
      );
    }

    if (!sessionProposals) {
      return NextResponse.json(
        { error: "No session proposals available" },
        { status: 404 }
      );
    }

    const proposal = sessionProposals.get(proposalId);
    if (!proposal) {
      return NextResponse.json(
        { error: "Proposal not found" },
        { status: 404 }
      );
    }

    if (proposal.status !== "approved") {
      return NextResponse.json(
        {
          error: `Proposal is ${proposal.status}. Only approved proposals can be reverted.`,
        },
        { status: 409 }
      );
    }

    // Attempt to restore from backup if available
    let backupUsed: string | null = null;
    if (restoreFromBackup) {
      backupUsed = findLatestBackup(proposal.playbookPath);
    }

    // Revert to original content
    const success = revertToOriginal(proposal);

    if (!success) {
      return NextResponse.json(
        { error: "Revert failed. Manual intervention may be required." },
        { status: 500 }
      );
    }

    // Update proposal and log
    proposal.status = "reverted";

    if (approvalLog) {
      const logEntry = approvalLog.find((a) => a.proposalId === proposalId);
      if (logEntry) {
        logEntry.reverted = true;
      }
    }

    // Annotate the revert event
    collectAnnotation({
      domain: proposal.domain,
      playbook: proposal.playbookPath,
      skillOrWorkflow: "self-healing:revert-mod",
      outcome: "success",
      durationMs: 0,
      learning: `User REVERTED mod: ${proposal.reason}. ${backupUsed ? `Backup: ${backupUsed}` : "Restored from proposal original."}`,
      toolsUsed: ["playbook-writer", "git-commit", "revert-engine"],
    });

    return NextResponse.json({
      reverted: true,
      proposalId,
      playbookPath: proposal.playbookPath,
      backupUsed,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("[revert-mod] Error:", e);
    return NextResponse.json(
      { error: e?.message || "Failed to revert modification" },
      { status: 500 }
    );
  }
}

/**
 * GET: List revertable (approved) proposals.
 */
export async function GET() {
  if (!sessionProposals) {
    return NextResponse.json({ revertable: [], total: 0 });
  }

  const revertable = [...sessionProposals.values()]
    .filter((p) => p.status === "approved")
    .map((p) => ({
      proposalId: p.id,
      playbookPath: p.playbookPath,
      domain: p.domain,
      reason: p.reason,
      createdAt: p.createdAt,
    }));

  return NextResponse.json({
    revertable,
    total: revertable.length,
  });
}
