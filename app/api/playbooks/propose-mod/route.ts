/**
 * app/api/playbooks/propose-mod/route.ts
 * U4.1 — Creates a playbook modification proposal with diff preview.
 *
 * POST: Accepts a playbook path + proposed content, computes a unified diff,
 * stores the proposal in memory, and returns it for user approval UI.
 * Guardrails: max 50 line diff, 1 proposal per session.
 */
import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { collectAnnotation } from "@/connectors/neptune/functions/annotation-collector";
import { detectSentiment } from "@/lib/sentiment/detector";

// ── Types ───────────────────────────────────────────────────────────────────

export interface PlaybookModProposal {
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

export interface DiffHunk {
  type: "added" | "removed" | "unchanged";
  value: string;
  lineNumber?: number;
}

// ── In-memory proposal store (session scoped, purged on reload) ──────────────
// Uses globalThis to share state across API route modules in the same Vercel process.
declare global {
  var __playbookProposals: Map<string, PlaybookModProposal> | undefined;
  var __playbookSessionProposalCount: number | undefined;
}

if (!globalThis.__playbookProposals) {
  globalThis.__playbookProposals = new Map<string, PlaybookModProposal>();
}
if (typeof globalThis.__playbookSessionProposalCount !== "number") {
  globalThis.__playbookSessionProposalCount = 0;
}

const sessionProposals = globalThis.__playbookProposals;
let getSessionProposalCount = () => globalThis.__playbookSessionProposalCount!;
let incSessionProposalCount = () => { globalThis.__playbookSessionProposalCount!++ };
let decSessionProposalCount = () => { globalThis.__playbookSessionProposalCount = Math.max(0, (globalThis.__playbookSessionProposalCount || 1) - 1); };

// ── Config ──────────────────────────────────────────────────────────────────

const MAX_DIFF_LINES = 50;
const MAX_PROPOSALS_PER_SESSION = 1;
const PLAYBOOKS_BASE = resolve(process.cwd(), "playbooks");

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Validates that a playbook path is safe (no traversal attacks).
 */
function validatePlaybookPath(path: string): boolean {
  const resolved = resolve(PLAYBOOKS_BASE, path);
  return resolved.startsWith(PLAYBOOKS_BASE) && existsSync(resolved);
}

/**
 * Simple line-based diff using Myers' algorithm concepts (simplified).
 * Computes added/removed/unchanged hunks between old and new content.
 */
function computeDiff(oldContent: string, newContent: string): { hunks: DiffHunk[]; lineCount: number } {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");
  const hunks: DiffHunk[] = [];
  let changedLineCount = 0;

  // Build a simple LCS-based diff
  // For efficiency with small diffs (<100 lines), use O(n*m) approach
  const lcs = buildLCS(oldLines, newLines);

  let oi = 0, ni = 0, li = 0;
  let lineNumber = 1;

  while (oi < oldLines.length || ni < newLines.length) {
    if (li < lcs.length && oi < oldLines.length && oldLines[oi] === lcs[li]) {
      // Unchanged line
      hunks.push({ type: "unchanged", value: oldLines[oi] + "\n", lineNumber });
      oi++;
      ni = advanceTo(newLines, ni, lcs[li]);
      li++;
      lineNumber++;
    } else if (oi < oldLines.length && (li >= lcs.length || oldLines[oi] !== lcs[li])) {
      // Removed line
      hunks.push({ type: "removed", value: oldLines[oi] + "\n", lineNumber });
      changedLineCount++;
      oi++;
      lineNumber++;
    } else if (ni < newLines.length && (li >= lcs.length || newLines[ni] !== lcs[li])) {
      // Added line
      hunks.push({ type: "added", value: newLines[ni] + "\n", lineNumber });
      changedLineCount++;
      ni++;
    } else {
      break;
    }
  }

  return { hunks, lineCount: changedLineCount };
}

/** Compute Longest Common Subsequence of lines */
function buildLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;
  // For efficiency, only build LCS for reasonably sized diffs
  if (m === 0 || n === 0) return [];
  if (m > 200 || n > 200) {
    // Fallback for large files: compare line-by-line
    const result: string[] = [];
    const minLen = Math.min(m, n);
    for (let i = 0; i < minLen; i++) {
      if (a[i] === b[i]) result.push(a[i]);
    }
    return result;
  }

  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result: string[] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return result;
}

/** Advance new-lines pointer to match target line */
function advanceTo(lines: string[], startIdx: number, target: string): number {
  for (let i = startIdx; i < lines.length; i++) {
    if (lines[i] === target) return i + 1;
  }
  return startIdx;
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { playbookPath, proposedContent, reason, domain, userMessage } = body;

    // Validate required fields
    if (!playbookPath || !proposedContent || !reason || !domain) {
      return NextResponse.json(
        { error: "Missing required fields: playbookPath, proposedContent, reason, domain" },
        { status: 400 }
      );
    }

    // Enforce one proposal per session
    if (getSessionProposalCount() >= MAX_PROPOSALS_PER_SESSION) {
      return NextResponse.json(
        {
          error: "Proposal limit reached (1 per session). Reject or approve the existing proposal first.",
          existingProposals: [...sessionProposals.values()].filter(p => p.status === "pending").map((p) => p.id),
        },
        { status: 429 }
      );
    }

    // Validate playbook path safety
    if (!validatePlaybookPath(playbookPath)) {
      return NextResponse.json(
        { error: "Invalid or missing playbook path. Must exist under playbooks/." },
        { status: 400 }
      );
    }

    // Read current playbook content
    const fullPath = resolve(PLAYBOOKS_BASE, playbookPath);
    const currentContent = readFileSync(fullPath, "utf-8");

    // Compute diff
    const { hunks, lineCount } = computeDiff(currentContent, proposedContent);

    // Guardrail: diff must be < 50 lines
    if (lineCount > MAX_DIFF_LINES) {
      return NextResponse.json(
        {
          error: `Diff too large: ${lineCount} lines (max ${MAX_DIFF_LINES}). Split into smaller changes.`,
        },
        { status: 400 }
      );
    }

    // Run sentiment analysis if user message provided
    let sentimentLevel = "unavailable";
    if (userMessage) {
      const sentimentResult = detectSentiment(userMessage);
      sentimentLevel = sentimentResult.level;
    }

    // Create proposal
    const proposalId = `proposal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const proposal: PlaybookModProposal = {
      id: proposalId,
      playbookPath,
      playbookContent: currentContent,
      proposedContent,
      diff: hunks,
      diffLineCount: lineCount,
      reason,
      domain,
      sentimentLevel,
      createdAt: new Date().toISOString(),
      status: "pending",
    };

    sessionProposals.set(proposalId, proposal);
    incSessionProposalCount();

    // Annotate the proposal event
    collectAnnotation({
      domain,
      playbook: playbookPath,
      skillOrWorkflow: "self-healing:propose-mod",
      outcome: "partial",
      durationMs: 0,
      learning: `Mod proposed: ${reason}`,
      toolsUsed: ["sentiment-detector", "playbook-loader", "diff-engine"],
    });

    return NextResponse.json(
      {
        proposal,
        guardrails: {
          diffLineLimit: MAX_DIFF_LINES,
          sessionProposalLimit: MAX_PROPOSALS_PER_SESSION,
          remainingProposals: MAX_PROPOSALS_PER_SESSION - getSessionProposalCount(),
        },
        nextSteps: {
          approve: `POST /api/playbooks/approve-mod with { proposalId: "${proposalId}" }`,
          reject: `DELETE /api/playbooks/propose-mod?proposalId=${proposalId}`,
        },
      },
      { status: 201 }
    );
  } catch (e: any) {
    console.error("[propose-mod] Error:", e);
    return NextResponse.json(
      { error: e?.message || "Failed to create proposal" },
      { status: 500 }
    );
  }
}

/**
 * GET: Retrieve pending proposal(s) for user review.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const proposalId = searchParams.get("proposalId");

  if (proposalId) {
    const proposal = sessionProposals.get(proposalId);
    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }
    return NextResponse.json({ proposal });
  }

  // Return all pending proposals
  const proposals = [...sessionProposals.values()].filter(
    (p) => p.status === "pending"
  );

  return NextResponse.json({
    proposals,
    total: proposals.length,
    sessionProposalCount: getSessionProposalCount(),
  });
}

/**
 * DELETE: Reject/withdraw a pending proposal.
 */
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const proposalId = searchParams.get("proposalId");

  if (!proposalId) {
    return NextResponse.json(
      { error: "proposalId query parameter required" },
      { status: 400 }
    );
  }

  const proposal = sessionProposals.get(proposalId);
  if (!proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  proposal.status = "rejected";
  decSessionProposalCount();

  collectAnnotation({
    domain: proposal.domain,
    playbook: proposal.playbookPath,
    skillOrWorkflow: "self-healing:reject-mod",
    outcome: "success",
    durationMs: 0,
    learning: `User rejected mod proposal: ${proposal.reason}`,
    toolsUsed: ["propose-mod"],
  });

  return NextResponse.json({
    rejected: true,
    proposalId,
    timestamp: new Date().toISOString(),
  });
}
