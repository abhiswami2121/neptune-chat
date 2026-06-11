"use client";
/**
 * StreamErrorBoundary — U1.2 V2 Handoff Resilience
 *
 * Catches render errors in the chat message stream and shows a
 * graceful "Stream interrupted. Retry?" UI instead of crashing the page.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { RefreshCwIcon, AlertTriangleIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreamErrorBoundaryProps {
  children: ReactNode;
  /** Called when user clicks retry */
  onRetry?: () => void;
  /** Called when user wants to resume the stream */
  onResume?: () => void;
  className?: string;
}

interface StreamErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorCount: number;
}

export class StreamErrorBoundary extends Component<
  StreamErrorBoundaryProps,
  StreamErrorBoundaryState
> {
  constructor(props: StreamErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<StreamErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      "[StreamErrorBoundary] Caught render error:",
      error.message,
      info.componentStack?.slice(0, 300)
    );
    this.setState((prev) => ({ errorCount: prev.errorCount + 1 }));
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onRetry?.();
  };

  handleResume = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onResume?.();
  };

  render() {
    if (this.state.hasError) {
      const isStreamInterrupted =
        this.state.error?.message?.includes("stream") ||
        this.state.error?.message?.includes("interrupted") ||
        this.state.error?.message?.includes("connection") ||
        this.state.error?.message?.includes("timeout");

      return (
        <div
          className={cn(
            "rounded-lg border p-4 mx-2 my-3",
            this.state.errorCount > 2
              ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
              : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20"
          )}
        >
          <div className="flex items-start gap-3">
            <AlertTriangleIcon
              className={cn(
                "size-5 shrink-0 mt-0.5",
                this.state.errorCount > 2
                  ? "text-red-500"
                  : "text-amber-500"
              )}
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">
                {isStreamInterrupted
                  ? "Stream interrupted"
                  : this.state.errorCount > 2
                    ? "Multiple errors detected"
                    : "Something went wrong"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {this.state.error?.message || "The chat stream encountered an unexpected error."}
              </p>

              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={this.handleRetry}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                  type="button"
                >
                  <RefreshCwIcon className="size-3.5" />
                  Retry
                </button>

                {isStreamInterrupted && this.props.onResume && (
                  <button
                    onClick={this.handleResume}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                      "border bg-background hover:bg-muted"
                    )}
                    type="button"
                  >
                    Resume stream
                  </button>
                )}

                <button
                  onClick={() =>
                    this.setState({ hasError: false, error: undefined })
                  }
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-2"
                  type="button"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
