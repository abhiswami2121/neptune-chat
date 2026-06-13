"use client";

/**
 * PlanModeProposal — In-chat plan approval card.
 * U5.4: Renders a shadcn Card with Goal, Phases, Budget, Success Criteria,
 * and Cardinal Rules. Three buttons: Approve, Modify, Cancel.
 *
 * Used by the chat workflow when a task has >= 3 phases.
 */

import {
  CheckCircleIcon,
  XCircleIcon,
  PencilIcon,
  ClockIcon,
  TargetIcon,
  AlertTriangleIcon,
  LayersIcon,
} from "lucide-react";
import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

// ── Types ──────────────────────────────────────────────────────────────────

export interface PlanPhase {
  name: string;
  goal: string;
  turnBudget: number;
  deliverables: string[];
}

export interface PlanModeProposalData {
  proposalId: string;
  goal: string;
  phases: PlanPhase[];
  totalBudget: number;
  successCriteria: string[];
  cardinalRules: Array<{ id: string; rule: string }>;
  dependencyGraph?: string; // Mermaid syntax
  source: string; // e.g., "draft-impl-plan", "mission-dispatch"
}

export type PlanModeDecision = "approve" | "modify" | "cancel";

export interface PlanModeProposalProps {
  proposal: PlanModeProposalData;
  onDecision: (decision: PlanModeDecision, modifications?: string) => void;
  disabled?: boolean;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function PhaseBadge({ index, phase }: { index: number; phase: PlanPhase }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Badge variant="outline" className="mt-0.5 shrink-0 font-mono text-xs">
        P{index + 1}
      </Badge>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{phase.name}</p>
        <p className="text-xs text-muted-foreground">{phase.goal}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          <Badge variant="secondary" className="text-xs">
            <ClockIcon className="mr-1 h-3 w-3" />
            {phase.turnBudget}t
          </Badge>
          {phase.deliverables.map((d, i) => (
            <Badge key={i} variant="outline" className="text-xs">
              {d}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function PlanModeProposal({
  proposal,
  onDecision,
  disabled = false,
}: PlanModeProposalProps) {
  const [modifications, setModifications] = useState("");
  const [showModify, setShowModify] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleApprove = () => {
    setSubmitting(true);
    onDecision("approve");
  };

  const handleModify = () => {
    if (!showModify) {
      setShowModify(true);
      return;
    }
    setSubmitting(true);
    onDecision("modify", modifications || undefined);
  };

  const handleCancel = () => {
    setSubmitting(true);
    onDecision("cancel");
  };

  const isDisabled = disabled || submitting;

  return (
    <Card className="my-4 border-2 border-primary/20 shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <LayersIcon className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Plan Mode — Review &amp; Approve</CardTitle>
        </div>
        <CardDescription>
          This task has {proposal.phases.length} phases and requires your
          approval before execution. Review the plan below.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Goal */}
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-sm font-medium">
            <TargetIcon className="h-4 w-4 text-primary" />
            Goal
          </div>
          <p className="text-sm text-muted-foreground">{proposal.goal}</p>
        </div>

        <Separator />

        {/* Phases */}
        <div>
          <div className="mb-2 flex items-center justify-between text-sm font-medium">
            <span>
              Phases ({proposal.phases.length}) — Total Budget: {proposal.totalBudget}t
            </span>
          </div>
          <div className="divide-y divide-border rounded-md border">
            {proposal.phases.map((phase, i) => (
              <div key={i} className="px-3">
                <PhaseBadge index={i} phase={phase} />
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Success Criteria */}
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-sm font-medium">
            <CheckCircleIcon className="h-4 w-4 text-green-500" />
            Success Criteria
          </div>
          <ul className="ml-5 list-disc text-sm text-muted-foreground space-y-0.5">
            {proposal.successCriteria.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>

        {/* Cardinal Rules */}
        {proposal.cardinalRules.length > 0 && (
          <>
            <Separator />
            <div>
              <div className="mb-1 flex items-center gap-1.5 text-sm font-medium">
                <AlertTriangleIcon className="h-4 w-4 text-amber-500" />
                Cardinal Rules Applied ({proposal.cardinalRules.length})
              </div>
              <div className="flex flex-wrap gap-1">
                {proposal.cardinalRules.map((r) => (
                  <Badge
                    key={r.id}
                    variant="secondary"
                    className="text-xs font-mono"
                    title={r.rule}
                  >
                    {r.id}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Source */}
        <div className="text-xs text-muted-foreground">
          Source: {proposal.source} · Proposal ID: {proposal.proposalId}
        </div>

        {/* Modification input */}
        {showModify && (
          <div className="space-y-2">
            <Separator />
            <label className="text-sm font-medium">
              What would you like to change?
            </label>
            <Textarea
              placeholder="Describe the modifications you want..."
              value={modifications}
              onChange={(e) => setModifications(e.target.value)}
              rows={3}
              disabled={isDisabled}
            />
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-2 pt-0">
        <Button
          variant="default"
          onClick={handleApprove}
          disabled={isDisabled}
          className="flex-1"
        >
          <CheckCircleIcon className="mr-1.5 h-4 w-4" />
          Approve
        </Button>
        <Button
          variant="secondary"
          onClick={handleModify}
          disabled={isDisabled}
          className="flex-1"
        >
          <PencilIcon className="mr-1.5 h-4 w-4" />
          {showModify ? "Submit Changes" : "Modify"}
        </Button>
        <Button
          variant="destructive"
          onClick={handleCancel}
          disabled={isDisabled}
          className="flex-1"
        >
          <XCircleIcon className="mr-1.5 h-4 w-4" />
          Cancel
        </Button>
      </CardFooter>
    </Card>
  );
}

// ── Helper: Generate a proposal from phase data ────────────────────────────

/**
 * Creates a PlanModeProposalData object from raw phase data.
 * Used by the plan-mode API endpoints and chat workflow.
 */
export function createProposalData(params: {
  goal: string;
  phases: PlanPhase[];
  successCriteria: string[];
  cardinalRules?: Array<{ id: string; rule: string }>;
  dependencyGraph?: string;
  source?: string;
}): PlanModeProposalData {
  const proposalId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const totalBudget = params.phases.reduce((sum, p) => sum + p.turnBudget, 0);

  return {
    proposalId,
    goal: params.goal,
    phases: params.phases,
    totalBudget,
    successCriteria: params.successCriteria,
    cardinalRules: params.cardinalRules || [],
    dependencyGraph: params.dependencyGraph,
    source: params.source || "plan-mode-detector",
  };
}

export default PlanModeProposal;
