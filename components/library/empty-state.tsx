"use client";

/**
 * EmptyState — Illustrated empty state with message and CTA.
 * PHASE C: Knowledge Files Redesign — shadcn-based enterprise design.
 *
 * Usage: shown when a library view has zero results (filtering, search, or empty dataset).
 */

import { FileSearchIcon, FolderOpenIcon, PlusIcon, SearchXIcon } from "lucide-react";
import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  variant?: "search" | "empty" | "error";
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

const VARIANTS = {
  search: {
    icon: SearchXIcon,
    defaultTitle: "No results found",
    defaultDescription: "Try adjusting your search terms or filters.",
  },
  empty: {
    icon: FolderOpenIcon,
    defaultTitle: "Nothing here yet",
    defaultDescription: "Knowledge files will appear here once they're available.",
  },
  error: {
    icon: FileSearchIcon,
    defaultTitle: "Failed to load",
    defaultDescription: "An error occurred while fetching data. Please try again.",
  },
};

export function EmptyState({
  variant = "empty",
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  const config = VARIANTS[variant];
  const Icon = config.icon;

  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-16 px-4 text-center",
      className
    )}>
      <div className="flex size-16 items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/30">
        <Icon className="size-7 text-muted-foreground/60" />
      </div>
      <h3 className="mt-5 text-sm font-semibold">
        {title ?? config.defaultTitle}
      </h3>
      <p className="mt-1.5 max-w-sm text-xs text-muted-foreground leading-relaxed">
        {description ?? config.defaultDescription}
      </p>
      {actionLabel && onAction && (
        <Button
          className="mt-5 gap-2"
          onClick={onAction}
          size="sm"
          variant="outline"
        >
          <PlusIcon className="size-3.5" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
