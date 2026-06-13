/**
 * app/api/plan-mode/propose/route.ts
 * U5.4 — Plan Mode Proposal API
 *
 * POST: Accepts plan data (goal, phases, success criteria, cardinal rules),
 * creates a proposal record in memory, and returns the proposal for rendering
 * in the PlanModeProposal component.
 *
 * Used by: chat workflow when plan-mode detector identifies task with >= 3 phases.
 */
import { NextResponse } from "next/server";
import { collectAnnotation } from "@/connectors/neptune/functions/annotation-collector";

// ── Types ──────────────────────────────────────────────────────────────────

export interface PlanPhaseData {
  name: string;
  goal: string;
  turnBudget: number;
  deliverables: string[];
}

export interface PlanProposal {
  id: string;
  goal: string;
  phases: PlanPhaseData[];
  totalBudget: number;
  successCriteria: string[];
  cardinalRules: Array<{ id: string; rule: string }>;
  dependencyGraph?: string;
  source: string;
  status: "pending" | "approved" | "modified" | "cancelled" | "executing" | "completed";
  modifications?: string;
  createdAt: string;
  updatedAt: string;
}

// ── In-memory proposal store ───────────────────────────────────────────────

declare global {
  var __planProposals: Map<string, PlanProposal> | undefined;
}

if (!globalThis.__planProposals) {
  globalThis.__planProposals = new Map<string, PlanProposal>();
}

const proposals = globalThis.__planProposals;

// ── Config ─────────────────────────────────────────────────────────────────

const MAX_PHASES = 20;
const MIN_PHASES_FOR_PLAN_MODE = 3;
const MAX_BUDGET_PER_PHASE = 2000;

// ── POST: Create Proposal ──────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      goal,
      phases,
      successCriteria,
      cardinalRules,
      dependencyGraph,
      source,
    } = body;

    // Validation
    if (!goal || typeof goal !== "string" || goal.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing required field: goal (string)" },
        { status: 400 }
      );
    }

    if (!Array.isArray(phases) || phases.length < MIN_PHASES_FOR_PLAN_MODE) {
      return NextResponse.json(
        {
          error: `phases must be an array with at least ${MIN_PHASES_FOR_PLAN_MODE} entries`,
        },
        { status: 400 }
      );
    }

    if (phases.length > MAX_PHASES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_PHASES} phases allowed` },
        { status: 400 }
      );
    }

    if (!Array.isArray(successCriteria) || successCriteria.length === 0) {
      return NextResponse.json(
        { error: "Missing required field: successCriteria (non-empty array)" },
        { status: 400 }
      );
    }

    // Validate each phase
    for (let i = 0; i < phases.length; i++) {
      const p = phases[i];
      if (!p.name || typeof p.name !== "string") {
        return NextResponse.json(
          { error: `Phase ${i + 1}: missing or invalid 'name'` },
          { status: 400 }
        );
      }
      if (!p.goal || typeof p.goal !== "string") {
        return NextResponse.json(
          { error: `Phase ${i + 1}: missing or invalid 'goal'` },
          { status: 400 }
        );
      }
      if (typeof p.turnBudget !== "number" || p.turnBudget < 1 || p.turnBudget > MAX_BUDGET_PER_PHASE) {
        return NextResponse.json(
          {
            error: `Phase ${i + 1}: turnBudget must be between 1 and ${MAX_BUDGET_PER_PHASE}`,
          },
          { status: 400 }
        );
      }
      if (!Array.isArray(p.deliverables)) {
        return NextResponse.json(
          { error: `Phase ${i + 1}: missing or invalid 'deliverables'` },
          { status: 400 }
        );
      }
    }

    const totalBudget = phases.reduce(
      (sum: number, p: PlanPhaseData) => sum + p.turnBudget,
      0
    );

    const proposalId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const proposal: PlanProposal = {
      id: proposalId,
      goal: goal.trim(),
      phases,
      totalBudget,
      successCriteria,
      cardinalRules: cardinalRules || [],
      dependencyGraph,
      source: source || "plan-mode-api",
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    proposals.set(proposalId, proposal);

    // Annotate
    collectAnnotation({
      domain: "planning-research",
      playbook: "playbooks/planning-research/playbook-planning-research.md",
      skillOrWorkflow: "plan-mode-propose",
      outcome: "success",
      durationMs: 0,
      learning: `Plan proposal created: ${proposalId}, ${phases.length} phases, ${totalBudget}t budget`,
      toolsUsed: ["plan-mode-detector", "plan-mode-propose-api"],
    });

    return NextResponse.json(
      {
        proposal,
        message: `Plan proposal created with ${phases.length} phases and ${totalBudget}t total budget. Awaiting user approval.`,
      },
      { status: 201 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to create plan proposal" },
      { status: 500 }
    );
  }
}

// ── GET: Retrieve Proposal ─────────────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    const proposal = proposals.get(id);
    if (!proposal) {
      return NextResponse.json(
        { error: `Proposal '${id}' not found` },
        { status: 404 }
      );
    }
    return NextResponse.json({ proposal });
  }

  // List all pending proposals
  const allProposals = [...proposals.values()];
  const pending = allProposals.filter((p) => p.status === "pending");

  return NextResponse.json({
    total: allProposals.length,
    pending: pending.length,
    proposals: allProposals.slice(0, 50),
  });
}
