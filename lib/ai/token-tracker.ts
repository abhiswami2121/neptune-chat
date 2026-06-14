/**
 * Token Tracker — Phase 10-D
 *
 * Tracks token consumption during chat streaming, provides 80% warning and
 * 95% auto-checkpoint triggers. Uses model-specific context window sizes.
 *
 * The AI SDK provides usage after stream completion via onFinish/onStepFinish.
 * For real-time warnings during streaming, we estimate token count from
 * character counts (rough heuristic: chars/4 for English text).
 */

import type { LanguageModelV2Usage } from "@ai-sdk/provider";

// ── Model Context Windows ─────────────────────────────────────────────────────

/** Known context window sizes for supported models (in tokens) */
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  "deepseek-v4-pro": 131_072,
  "deepseek/deepseek-v4-pro": 131_072,
  "deepseek/deepseek-v4-flash": 131_072,
  "deepseek/deepseek-v3.2": 131_072,
  "deepseek-reasoner": 65_536,
  "moonshotai/kimi-k2.5": 131_072,
  "openai/gpt-oss-20b": 131_072,
  "openai/gpt-oss-120b": 131_072,
  "xai/grok-4.1-fast-non-reasoning": 131_072,
  "anthropic/claude-sonnet-4-6": 200_000,
  "google/gemini-2-flash": 1_048_576,
};

/** Default context window when model is unknown */
const DEFAULT_CONTEXT_WINDOW = 131_072;

// ── Thresholds ────────────────────────────────────────────────────────────────

const WARNING_THRESHOLD = 0.80; // 80% — send warning to user
const CHECKPOINT_THRESHOLD = 0.95; // 95% — auto-save checkpoint

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TokenState {
  /** Estimated total tokens used so far (prompt + completion) */
  estimatedTokens: number;
  /** Actual token usage from the AI SDK (null until stream completes) */
  actualUsage: LanguageModelV2Usage | null;
  /** Model's context window size */
  contextWindow: number;
  /** What percentage of context window is used (0.0–1.0) */
  usageRatio: number;
  /** Whether we've crossed the 80% warning threshold */
  warningSent: boolean;
  /** Whether we've crossed the 95% checkpoint threshold */
  checkpointTriggered: boolean;
}

export interface CheckpointData {
  /** Chat ID this checkpoint belongs to */
  chatId: string;
  /** Reason for checkpoint */
  reason: "token_limit_95pct" | "manual" | "auto_periodic";
  /** Token count at checkpoint time */
  tokenCount: number;
  /** Percentage of context window used */
  usagePercent: number;
  /** Summary of the conversation up to this point */
  conversationSummary: string;
  /** IDs of messages included in this checkpoint */
  messageIds: string[];
  /** Model ID in use */
  modelId: string;
  /** Context window size */
  contextWindow: number;
}

// ── Estimation ────────────────────────────────────────────────────────────────

/**
 * Estimate token count from text using character-based heuristic.
 * Rough rule of thumb: 1 token ≈ 4 characters for English text.
 * For code, the ratio is closer to 1 token ≈ 3 characters.
 */
export function estimateTokens(text: string, isCode: boolean = false): number {
  const chars = text.length;
  return Math.ceil(chars / (isCode ? 3 : 4));
}

/**
 * Estimate total tokens for a list of messages.
 * Includes both the text content and a 4-token overhead per message (role formatting).
 */
export function estimateMessageTokens(
  messages: Array<{ role: string; parts: unknown; content?: string }>,
  modelId?: string
): number {
  let total = 0;

  for (const msg of messages) {
    // Per-message overhead for role declaration and formatting
    total += 4;

    // Extract text content
    if (typeof msg.content === "string") {
      total += estimateTokens(msg.content);
    } else if (msg.parts) {
      const partsStr = typeof msg.parts === "string"
        ? msg.parts
        : JSON.stringify(msg.parts);
      total += estimateTokens(partsStr);
    }
  }

  return total;
}

// ── Context Window ────────────────────────────────────────────────────────────

/**
 * Get the context window size for a model.
 * Falls back to DEFAULT_CONTEXT_WINDOW for unknown models.
 */
export function getContextWindow(modelId: string): number {
  return MODEL_CONTEXT_WINDOWS[modelId] ?? DEFAULT_CONTEXT_WINDOW;
}

// ── State Machine ─────────────────────────────────────────────────────────────

/**
 * Create a new token tracker for a chat session.
 * Returns functions to update and query token state.
 */
export function createTokenTracker(modelId: string, initialMessagesTokens: number = 0) {
  const contextWindow = getContextWindow(modelId);

  const state: TokenState = {
    estimatedTokens: initialMessagesTokens,
    actualUsage: null,
    contextWindow,
    usageRatio: initialMessagesTokens / contextWindow,
    warningSent: false,
    checkpointTriggered: false,
  };

  return {
    /** Get current state snapshot */
    getState: (): Readonly<TokenState> => ({ ...state }),

    /** Update with actual usage from AI SDK after stream completes */
    setActualUsage(usage: LanguageModelV2Usage): void {
      state.actualUsage = usage;
      const totalTokens = (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
      state.estimatedTokens = Math.max(state.estimatedTokens, totalTokens);
      state.usageRatio = state.estimatedTokens / state.contextWindow;
    },

    /** Add estimated tokens for a new message being sent */
    addMessageTokens(messageText: string, isCode: boolean = false): void {
      const tokens = estimateTokens(messageText, isCode);
      state.estimatedTokens += tokens;
      state.usageRatio = state.estimatedTokens / state.contextWindow;
    },

    /** Check if warning threshold (80%) has been crossed */
    shouldWarn(): boolean {
      if (state.warningSent) return false;
      if (state.usageRatio >= WARNING_THRESHOLD) {
        state.warningSent = true;
        return true;
      }
      return false;
    },

    /** Check if checkpoint threshold (95%) has been crossed */
    shouldCheckpoint(): boolean {
      if (state.checkpointTriggered) return false;
      if (state.usageRatio >= CHECKPOINT_THRESHOLD) {
        state.checkpointTriggered = true;
        return true;
      }
      return false;
    },

    /** Get warning message for the user */
    getWarningMessage(): string {
      const pct = Math.round(state.usageRatio * 100);
      const remaining = state.contextWindow - state.estimatedTokens;
      return [
        `⚠️ **Token Usage Warning**: ${pct}% of context window used (${state.estimatedTokens.toLocaleString()} / ${state.contextWindow.toLocaleString()} tokens).`,
        ``,
        `Approximately **${remaining.toLocaleString()} tokens remaining** before context limit.`,
        ``,
        `Consider starting a new conversation soon. Long conversations may lose context from earlier messages.`,
      ].join("\n");
    },

    /** Get checkpoint trigger message */
    getCheckpointMessage(): string {
      const pct = Math.round(state.usageRatio * 100);
      return [
        `🔄 **Auto-Checkpoint Saved**: ${pct}% of context window reached.`,
        `A checkpoint of this conversation has been automatically created.`,
        `You can resume from this point later using the checkpoint link.`,
      ].join("\n");
    },

    /** Reset warning state (for when a new message is below threshold again) */
    resetWarning(): void {
      if (state.usageRatio < WARNING_THRESHOLD) {
        state.warningSent = false;
      }
    },

    get contextWindow() { return contextWindow; },
    get estimatedTokens() { return state.estimatedTokens; },
    get usageRatio() { return state.usageRatio; },
  };
}

export type TokenTracker = ReturnType<typeof createTokenTracker>;

// ── Checkpoint Summary Generator ──────────────────────────────────────────────

/**
 * Generate a conversation summary from messages for the checkpoint.
 * Uses a simple extraction heuristic — pulls the last user message and
 * key topic indicators from the conversation.
 */
export function generateCheckpointSummary(
  messages: Array<{ role: string; parts: unknown; content?: string }>
): string {
  const userMessages = messages.filter((m) => m.role === "user");

  if (userMessages.length === 0) {
    return "No user messages in conversation.";
  }

  // Extract text from user messages
  const texts = userMessages.map((m) => {
    if (typeof m.content === "string") return m.content;
    if (m.parts && typeof m.parts === "string") return m.parts;
    if (m.parts && Array.isArray(m.parts)) {
      return m.parts
        .filter((p: Record<string, unknown>) => p.type === "text")
        .map((p: Record<string, unknown>) => String(p.text ?? ""))
        .join(" ");
    }
    return "";
  }).filter(Boolean);

  const firstMsg = texts[0]?.slice(0, 100) ?? "N/A";
  const lastMsg = texts[texts.length - 1]?.slice(0, 100) ?? "N/A";

  return [
    `Conversation with ${userMessages.length} user messages.`,
    `Started with: "${firstMsg}${firstMsg.length >= 100 ? "..." : ""}"`,
    `Last message: "${lastMsg}${lastMsg.length >= 100 ? "..." : ""}"`,
  ].join("\n");
}

// ── Checkpoint Persistence Stub ───────────────────────────────────────────────
// NOTE: chat_checkpoints table is created by migration 0005 in Phase E.
// These functions will be wired after the migration runs.

export interface CheckpointRecord {
  id: string;
  chatId: string;
  userId: string;
  reason: string;
  tokenCount: number;
  usagePercent: number;
  conversationSummary: string;
  messageIds: string[];
  modelId: string;
  contextWindow: number;
  createdAt: Date;
}

/**
 * Placeholder for saving a checkpoint to the database.
 * Will be implemented after migration 0005 creates the chat_checkpoints table.
 */
export async function saveCheckpoint(_data: Omit<CheckpointRecord, "createdAt">): Promise<void> {
  // Phase E: INSERT INTO chat_checkpoints ...
  // This is a stub — the actual implementation will use drizzle
  console.log("[token-tracker] Checkpoint save stub called:", _data.id);
}
