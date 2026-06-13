/**
 * lib/plan-mode/detector.ts
 * U5.4 — Plan Mode Trigger Detection
 *
 * Injected into the chat workflow to detect tasks with >= 3 phases
 * and route them through the plan-mode proposal flow.
 *
 * Works by:
 * 1. Analyzing user messages for phase-like patterns
 * 2. Checking routines.json for requires_plan_mode markers
 * 3. Counting phases in plan documents
 * 4. Triggering the plan-mode proposal API when threshold is met
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface PhaseDetection {
  /** Whether plan mode should be triggered */
  requiresPlanMode: boolean;
  /** Number of phases detected */
  phaseCount: number;
  /** How the phases were detected */
  detectionMethod: "user_message" | "routine_marker" | "plan_document" | "explicit_request";
  /** The detected phase descriptions if from user message */
  detectedPhases?: string[];
  /** The routine name if triggered by routines.json */
  routineName?: string;
  /** Confidence in the detection (0.0-1.0) */
  confidence: number;
}

export interface PlanModeConfig {
  /** Minimum phases to trigger plan mode */
  phaseThreshold: number;
  /** Whether auto-detection is enabled */
  autoDetect: boolean;
}

// ── Config ─────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: PlanModeConfig = {
  phaseThreshold: 3,
  autoDetect: true,
};

// ── Phase Detection Patterns ───────────────────────────────────────────────

/**
 * Patterns that suggest a user is describing a multi-phase task.
 * Each pattern matches a phase-like structure in user text.
 */
const PHASE_PATTERNS: Array<{ regex: RegExp; weight: number }> = [
  // Numbered phases: "Phase 1: ...", "Phase 2: ..."
  { regex: /phase\s*\d+\s*:/gi, weight: 1.0 },
  // Step numbering: "Step 1:", "Step 2:"
  { regex: /step\s*\d+\s*:/gi, weight: 0.8 },
  // Bullet-list of tasks: "1. do this\n2. do that\n3."
  { regex: /^\d+\.\s+.+$/gm, weight: 0.7 },
  // Explicit multi-phase language
  { regex: /multi.?\s*phase|multiple\s+phases|several\s+phases/i, weight: 1.0 },
  // Phase budget markers: "200t", "400t", "500t" (turn budgets)
  { regex: /\b\d{2,4}t\b/g, weight: 0.6 },
  // Roadmap/plan language
  { regex: /\b(roadmap|phase\s+(plan|breakdown)|implementation\s+plan|execution\s+plan)\b/i, weight: 0.8 },
  // Dependency markers: "after Phase X", "depends on Phase"
  { regex: /(after|depends\s+on|following)\s+phase\s+\d+/i, weight: 1.0 },
];

// ── Detection Functions ────────────────────────────────────────────────────

/**
 * Analyze a user message for phase-like patterns.
 */
export function detectPhasesFromMessage(message: string): PhaseDetection {
  let totalWeight = 0;
  const detectedPhases: string[] = [];

  for (const pattern of PHASE_PATTERNS) {
    const matches = message.match(pattern.regex);
    if (matches) {
      // Count unique matches
      const uniqueMatches = [...new Set(matches.map((m) => m.trim()))];
      totalWeight += pattern.weight * uniqueMatches.length;

      for (const m of uniqueMatches) {
        // Extract the phase description
        const contextMatch = message.match(
          new RegExp(`${m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(.+?)(?:\\n|$|\\.)`, "i")
        );
        if (contextMatch) {
          detectedPhases.push(`${m} ${contextMatch[1].trim().slice(0, 80)}`);
        } else {
          detectedPhases.push(m);
        }
      }
    }
  }

  // Check for explicit plan mode request
  const explicitRequest = /\b(plan\s*mode|approve\s*plan|review\s*plan)\b/i.test(message);

  const phaseCount = Math.max(
    detectedPhases.length,
    Math.round(totalWeight / 2)
  );

  return {
    requiresPlanMode:
      phaseCount >= DEFAULT_CONFIG.phaseThreshold || explicitRequest,
    phaseCount,
    detectionMethod: explicitRequest
      ? "explicit_request"
      : "user_message",
    detectedPhases: detectedPhases.slice(0, 20),
    confidence: Math.min(totalWeight / 10, 1.0),
  };
}

/**
 * Check if a routine from routines.json requires plan mode.
 */
export function detectPhasesFromRoutine(routine: {
  name: string;
  requires_plan_mode?: boolean;
  plan_mode_threshold?: number;
  steps?: Array<unknown>;
}): PhaseDetection {
  const requiresPlanMode =
    routine.requires_plan_mode === true ||
    (routine.steps && routine.steps.length >= DEFAULT_CONFIG.phaseThreshold) ||
    false;

  return {
    requiresPlanMode,
    phaseCount: routine.steps?.length || 0,
    detectionMethod: "routine_marker",
    routineName: routine.name,
    confidence: requiresPlanMode ? 1.0 : 0.5,
  };
}

/**
 * Check if a plan document (PRD, impl-plan) has enough phases to trigger plan mode.
 */
export function detectPhasesFromPlan(plan: {
  phases?: Array<unknown>;
  sections?: Array<unknown>;
}): PhaseDetection {
  const phaseCount = plan.phases?.length || plan.sections?.length || 0;

  return {
    requiresPlanMode: phaseCount >= DEFAULT_CONFIG.phaseThreshold,
    phaseCount,
    detectionMethod: "plan_document",
    confidence: phaseCount > 0 ? 0.9 : 0.3,
  };
}

/**
 * Main detection function: analyze user message + routine + plan document.
 * Returns the highest-confidence detection result.
 */
export function detectPlanMode(params: {
  message: string;
  routine?: {
    name: string;
    requires_plan_mode?: boolean;
    plan_mode_threshold?: number;
    steps?: Array<unknown>;
  };
  plan?: { phases?: Array<unknown>; sections?: Array<unknown> };
  config?: PlanModeConfig;
}): PhaseDetection {
  const config = { ...DEFAULT_CONFIG, ...params.config };
  const results: PhaseDetection[] = [];

  // Method 1: User message analysis
  const messageResult = detectPhasesFromMessage(params.message);
  results.push(messageResult);

  // Method 2: Routine marker
  if (params.routine) {
    results.push(detectPhasesFromRoutine(params.routine));
  }

  // Method 3: Plan document
  if (params.plan) {
    results.push(detectPhasesFromPlan(params.plan));
  }

  // Return the highest-confidence detection, or the one with most phases
  results.sort((a, b) => {
    if (a.confidence !== b.confidence) return b.confidence - a.confidence;
    return b.phaseCount - a.phaseCount;
  });

  const best = results[0];

  return {
    requiresPlanMode: best.requiresPlanMode && config.autoDetect,
    phaseCount: best.phaseCount,
    detectionMethod: best.detectionMethod,
    detectedPhases: best.detectedPhases,
    routineName: best.routineName,
    confidence: best.confidence,
  };
}

/**
 * Check if a task requires plan mode based on phase count alone.
 * Simple threshold check — used for quick gating.
 */
export function requiresPlanMode(phaseCount: number, config?: PlanModeConfig): boolean {
  const threshold = config?.phaseThreshold ?? DEFAULT_CONFIG.phaseThreshold;
  const autoDetect = config?.autoDetect ?? DEFAULT_CONFIG.autoDetect;
  return autoDetect && phaseCount >= threshold;
}
