/**
 * V2 Auto-Retry Policy — U1.2 V2 Handoff Resilience
 *
 * First attempt fails: auto-retry once with exponential backoff (2s)
 * Second fail: surface to user with explicit 'V2 unreachable' message
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 1,
  baseDelayMs: 2000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: string;
  attempts: number;
  lastError?: string;
}

/**
 * Retry a function with exponential backoff.
 * Returns structured result — caller never gets a thrown error.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: string | undefined;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = Math.min(
          cfg.baseDelayMs * Math.pow(cfg.backoffMultiplier, attempt - 1),
          cfg.maxDelayMs
        );
        await new Promise((r) => setTimeout(r, delay));
      }
      const result = await fn();
      return { success: true, result, attempts: attempt + 1 };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      // Don't retry if we've exhausted attempts
      if (attempt === cfg.maxRetries) {
        return {
          success: false,
          error: `All ${cfg.maxRetries + 1} attempts failed. Last error: ${lastError}`,
          attempts: attempt + 1,
          lastError,
        };
      }
    }
  }

  return {
    success: false,
    error: `Unexpected: retry loop exhausted. Last error: ${lastError}`,
    attempts: cfg.maxRetries + 1,
    lastError,
  };
}

/**
 * Structured error response shape for tool returns.
 * Tools should NEVER throw — always return this shape.
 */
export interface StructuredToolError {
  success: false;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    suggestion: string;
  };
}

export interface StructuredToolSuccess<T = unknown> {
  success: true;
  data: T;
}

export type StructuredToolResult<T = unknown> =
  | StructuredToolError
  | StructuredToolSuccess<T>;

/**
 * Build a structured error response for tool return.
 */
export function toolError(
  code: string,
  message: string,
  retryable: boolean,
  suggestion: string
): StructuredToolError {
  return {
    success: false,
    error: { code, message, retryable, suggestion },
  };
}

/**
 * Wraps a potentially-throwing function and returns StructuredToolResult.
 * Never throws — always returns a structured response.
 */
export async function safeToolCall<T>(
  fn: () => Promise<T>,
  errorCode: string,
  suggestion?: string
): Promise<StructuredToolResult<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout =
      message.includes("timeout") ||
      message.includes("abort") ||
      message.includes("AbortError");
    const isNetwork =
      message.includes("fetch") ||
      message.includes("ECONNREFUSED") ||
      message.includes("ENOTFOUND") ||
      message.includes("503") ||
      message.includes("502");

    return toolError(
      errorCode,
      message,
      isTimeout || isNetwork,
      suggestion || "Try again later or use a different approach."
    );
  }
}
