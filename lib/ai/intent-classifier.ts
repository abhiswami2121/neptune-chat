/**
 * Intent Classifier — Phase 10-C
 *
 * Classifies user messages to determine whether they are asking the agent to
 * modify its own code (self-modification intent). Provides routing recommendations
 * for the appropriate tool based on scope heuristics.
 *
 * The classifier operates on simple pattern matching + scope estimation.
 * It does NOT use an LLM call — it's deterministic and instant.
 */

// ── Intent Types ──────────────────────────────────────────────────────────────

export type SelfModScope = "small" | "large" | "unknown";

export interface IntentClassification {
  /** Whether the message is asking the agent to modify its own code */
  isSelfModification: boolean;
  /** Estimated scope of the change */
  scope: SelfModScope;
  /** Recommended tool to use */
  recommendedTool: "selfCode" | "spawnCodingAgent" | "none";
  /** Recommended parameters for the tool */
  recommendedParams?: Record<string, unknown>;
  /** Detected intent variant */
  variant: SelfModIntentVariant;
  /** Confidence in the classification (0.0–1.0) */
  confidence: number;
}

export type SelfModIntentVariant =
  | "edit_your_code"
  | "fix_this_chat"
  | "modify_neptune_chat"
  | "add_feature"
  | "fix_bug_in_self"
  | "refactor_self"
  | "unknown";

// ── Pattern Definitions ──────────────────────────────────────────────────────

interface IntentPattern {
  variant: SelfModIntentVariant;
  patterns: RegExp[];
  defaultScope: SelfModScope;
}

const SELF_MOD_PATTERNS: IntentPattern[] = [
  {
    variant: "edit_your_code",
    patterns: [
      /edit\s+(your|ur)\s+(own\s+)?code/i,
      /modify\s+(your|ur)\s+(own\s+)?code/i,
      /change\s+(your|ur)\s+(own\s+)?code/i,
      /update\s+(your|ur)\s+(own\s+)?code\s?base/i,
    ],
    defaultScope: "small",
  },
  {
    variant: "fix_this_chat",
    patterns: [
      /fix\s+(this\s+)?(chat|app|ui)/i,
      /repair\s+(this\s+)?(chat|app)/i,
      /patch\s+(this\s+)?(chat|app)/i,
    ],
    defaultScope: "small",
  },
  {
    variant: "modify_neptune_chat",
    patterns: [
      /modify\s+(neptune|neptune.chat|neptune\s*chat)/i,
      /change\s+(neptune|neptune.chat|neptune\s*chat)/i,
      /update\s+(neptune|neptune.chat|neptune\s*chat)/i,
    ],
    defaultScope: "large",
  },
  {
    variant: "add_feature",
    patterns: [
      /add\s+(a\s+)?(feature|component|endpoint|route|api|page)\s+to\s+(neptune|this|your|the)\s*(chat|app)?/i,
      /build\s+(a\s+)?(feature|component)\s+(for|in|on)\s+(neptune|this|the)\s*(chat|app)?/i,
      /create\s+(a\s+)?(new\s+)?(feature|component)\s+(for|in|on)\s+(neptune|this|the)\s*(chat|app)?/i,
    ],
    defaultScope: "large",
  },
  {
    variant: "fix_bug_in_self",
    patterns: [
      /fix\s+(a\s+)?(bug|error|issue|problem)\s+(in|with|on)\s+(neptune|your|this)\s*(chat|app|code)?/i,
      /debug\s+(neptune|your|this)\s*(chat|app|code)?/i,
      /resolve\s+(a\s+)?(bug|issue)\s+(in|with)\s+(neptune|your|this)\s*(chat|app|code)?/i,
    ],
    defaultScope: "small",
  },
  {
    variant: "refactor_self",
    patterns: [
      /refactor\s+(neptune|your|this)\s*(chat|app|code)?/i,
      /restructure\s+(neptune|your|this)\s*(chat|app|code)?/i,
      /reorganize\s+(neptune|your|this)\s*(chat|app|code)?/i,
    ],
    defaultScope: "large",
  },
];

// ── Scope Estimation ──────────────────────────────────────────────────────────

const LARGE_SCOPE_KEYWORDS = [
  /feature/i,
  /refactor/i,
  /restructure/i,
  /architecture/i,
  /redesign/i,
  /new\s+(page|component|route|endpoint|feature)/i,
  /database/i,
  /migration/i,
  /schema/i,
  /auth/i,
  /payment/i,
  /deploy/i,
  /\bapi\b/i,
  /integration/i,
];

const SMALL_SCOPE_KEYWORDS = [
  /typo/i,
  /color/i,
  /copy\s+(change|update|fix)/i,
  /text\s+(change|update|fix)/i,
  /label/i,
  /spelling/i,
  /wording/i,
  /padding/i,
  /margin/i,
  /font/i,
  /style\s+(tweak|fix|update)/i,
  /\bprop\b/i,
  /minor/i,
  /small/i,
  /quick/i,
];

/**
 * Estimate the scope of a self-modification request from the message text.
 *
 * Heuristics:
 * - Multiple files mentioned → large
 * - Feature/new keywords + self reference → large
 * - Single file + typo/color/copy keywords → small
 * - Otherwise → unknown (defer to tool's scope parameter)
 */
function estimateScope(message: string): SelfModScope {
  const fileCount = (message.match(/file[s]?|component[s]?|route[s]?|endpoint[s]?/gi) || []).length;

  // Multiple files → likely large
  if (fileCount > 2) return "large";

  // Check large-scope signals first (they override small signals)
  for (const pattern of LARGE_SCOPE_KEYWORDS) {
    if (pattern.test(message)) return "large";
  }

  // Check small-scope signals
  for (const pattern of SMALL_SCOPE_KEYWORDS) {
    if (pattern.test(message)) return "small";
  }

  // Default: unknown — let the tool determine
  return "unknown";
}

// ── Classification ────────────────────────────────────────────────────────────

/**
 * Classify a user message to determine if it's a self-modification intent.
 *
 * Returns a structured classification with the recommended tool and parameters.
 * This is designed to be called from the chat route's system prompt assembly
 * and from the selfCode / spawnCodingAgent tool execute functions.
 *
 * @param message - The user's message text
 * @returns IntentClassification with tool routing recommendation
 */
export function classifyIntent(message: string): IntentClassification {
  const trimmed = message.trim();

  // Check each pattern group
  for (const group of SELF_MOD_PATTERNS) {
    for (const pattern of group.patterns) {
      if (pattern.test(trimmed)) {
        const scope = group.defaultScope === "unknown"
          ? estimateScope(trimmed)
          : estimateScope(trimmed) === "unknown"
            ? group.defaultScope
            : estimateScope(trimmed);

        const isLarge = scope === "large";

        return {
          isSelfModification: true,
          scope,
          recommendedTool: isLarge ? "spawnCodingAgent" : "selfCode",
          recommendedParams: isLarge
            ? {
                mode: "modify_existing",
                goal: trimmed,
                repoOwner: "abhiswami2121",
                repoName: "neptune-chat",
                baseBranch: "main",
                createPR: true,
                deployToVercel: true,
              }
            : {
                task: trimmed,
                scope: "small",
              },
          variant: group.variant,
          confidence: 0.85,
        };
      }
    }
  }

  // Secondary check: looser pattern for "fix yourself" type queries
  const loosePatterns = [
    /(self|yourself|itself).*(fix|repair|patch|update|change|modify|edit|code)/i,
    /(fix|repair|patch|update|change|modify|edit).*(self|yourself|itself)/i,
    /you.*(code|source|repo).*(need|has|requires).*(fix|change|update)/i,
  ];

  for (const pattern of loosePatterns) {
    if (pattern.test(trimmed)) {
      const scope = estimateScope(trimmed);
      return {
        isSelfModification: true,
        scope,
        recommendedTool: scope === "large" ? "spawnCodingAgent" : "selfCode",
        variant: "unknown",
        confidence: 0.6, // Lower confidence for loose patterns
      };
    }
  }

  // Not a self-modification intent
  return {
    isSelfModification: false,
    scope: "unknown",
    recommendedTool: "none",
    variant: "unknown",
    confidence: 0.9,
  };
}

/**
 * Check if a message is specifically asking to modify the chat app.
 * Shortcut for the most common self-modification pattern.
 */
export function isSelfModification(message: string): boolean {
  return classifyIntent(message).isSelfModification;
}

/**
 * Get the recommended tool for a self-modification request.
 * Returns "none" if the message is not a self-modification intent.
 */
export function getSelfModTool(message: string): "selfCode" | "spawnCodingAgent" | "none" {
  return classifyIntent(message).recommendedTool;
}

// ── Routing Map ───────────────────────────────────────────────────────────────

/**
 * Intent-to-tool routing map for self-modification intents.
 * Used by the playbook loader to pre-load the correct tool context.
 */
export const SELF_MOD_ROUTING = {
  edit_your_code: {
    tool: "selfCode",
    description: "Small edits to own codebase via selfCode",
    fallback: "spawnCodingAgent",
  },
  fix_this_chat: {
    tool: "selfCode",
    description: "Fix chat app bugs via selfCode",
    fallback: "spawnCodingAgent",
  },
  modify_neptune_chat: {
    tool: "spawnCodingAgent",
    description: "Modify Neptune Chat via V2 coding agent",
    fallback: "selfCode",
  },
  add_feature: {
    tool: "spawnCodingAgent",
    description: "Add new features via V2 coding agent",
    fallback: "selfCode",
  },
  fix_bug_in_self: {
    tool: "selfCode",
    description: "Fix own bugs via selfCode",
    fallback: "spawnCodingAgent",
  },
  refactor_self: {
    tool: "spawnCodingAgent",
    description: "Refactor codebase via V2 coding agent",
    fallback: "selfCode",
  },
  unknown: {
    tool: "selfCode",
    description: "Unknown scope — start with selfCode dry run",
    fallback: "spawnCodingAgent",
  },
} as const;
