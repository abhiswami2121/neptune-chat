/**
 * SpecificationViewer — Displays the specification used to generate an artifact.
 *
 * Phase 10-A: Standardized specification handling across text, code, and sheet artifacts.
 * When the primary LLM passes a detailed specification to the artifact generator,
 * this component renders it as a collapsible reference panel.
 *
 * Usage: Import wherever artifact content is displayed. Pass the specification text
 * and optionally the artifact kind and creation timestamp.
 */
"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, Info } from "lucide-react";

export interface SpecificationViewerProps {
  /** The specification text passed from the primary LLM to the artifact generator */
  specification: string | null | undefined;
  /** The kind of artifact (text, code, sheet) — affects header styling */
  kind?: "text" | "code" | "sheet";
  /** Optional timestamp of when the artifact was created */
  createdAt?: string;
  /** Whether the viewer starts collapsed (default: true) */
  collapsed?: boolean;
  /** Additional CSS class */
  className?: string;
}

const kindLabels: Record<string, string> = {
  text: "Document",
  code: "Code",
  sheet: "Spreadsheet",
};

const kindIcons: Record<string, string> = {
  text: "📄",
  code: "💻",
  sheet: "📊",
};

/**
 * A collapsible panel that displays the specification used to generate an artifact.
 * Shows "No specification" state gracefully when specification is empty.
 * The specification text is rendered in a monospace section for readability.
 */
export function SpecificationViewer({
  specification,
  kind = "text",
  createdAt,
  collapsed: defaultCollapsed = true,
  className = "",
}: SpecificationViewerProps) {
  const [isOpen, setIsOpen] = useState(!defaultCollapsed);
  const hasSpec = specification && specification.trim().length > 0;

  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  return (
    <div className={`specification-viewer rounded-lg border border-border/50 bg-muted/30 ${className}`}>
      {/* Header — always visible */}
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        aria-expanded={isOpen}
        aria-label={isOpen ? "Collapse specification" : "Expand specification"}
      >
        <Info className="size-3.5 shrink-0" />
        <span className="flex-1 truncate">
          {hasSpec
            ? `Generation Specification (${kindIcons[kind] || ""} ${kindLabels[kind] || kind})`
            : "No specification available"}
        </span>
        {createdAt && (
          <span className="text-[10px] text-muted-foreground/70 tabular-nums shrink-0">
            {new Date(createdAt).toLocaleTimeString()}
          </span>
        )}
        {isOpen ? (
          <ChevronDown className="size-3.5 shrink-0" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0" />
        )}
      </button>

      {/* Content — animated expand/collapse */}
      <AnimatePresence initial={false}>
        {isOpen && hasSpec && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/40 px-3 py-2">
              <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground/80 font-mono max-h-64 overflow-y-auto">
                {specification}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state when collapsed */}
      {!isOpen && !hasSpec && null}

      {/* Empty state when expanded but no spec */}
      {isOpen && !hasSpec && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="overflow-hidden"
        >
          <div className="border-t border-border/40 px-3 py-2">
            <p className="text-xs text-muted-foreground italic">
              This artifact was generated without a detailed specification.
              The content was based on the title alone.
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

/**
 * Inline version — compact single-line indicator that shows
 * whether a specification was used, without the full collapsible panel.
 * Good for use in lists or tight spaces.
 */
export function SpecificationBadge({
  specification,
  kind = "text",
}: {
  specification: string | null | undefined;
  kind?: "text" | "code" | "sheet";
}) {
  const hasSpec = specification && specification.trim().length > 0;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
        hasSpec
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "bg-muted text-muted-foreground"
      }`}
      title={hasSpec ? "Generated with specification" : "Generated from title only"}
    >
      {hasSpec ? (
        <>
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Spec
        </>
      ) : (
        <>
          <span className="size-1.5 rounded-full bg-muted-foreground/30" />
          Title-only
        </>
      )}
    </span>
  );
}
