"use client";

/**
 * LibraryGrid — Responsive card grid for knowledge items.
 * PHASE C: Knowledge Files Redesign — shadcn-based enterprise design.
 *
 * Features:
 *   - Responsive grid (1 col mobile, 2 cols tablet, 3 cols desktop)
 *   - Skeleton loading state with staggered animation
 *   - Empty state integrated (handles zero results)
 *   - Error state with retry
 *   - Smooth fade-in animation on load
 */

import React from "react";
import { EmptyState } from "@/components/library/empty-state";
import { LibraryCard, type LibraryItem } from "@/components/library/library-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface LibraryGridProps {
  items: LibraryItem[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onView?: (item: LibraryItem) => void;
  onEdit?: (item: LibraryItem) => void;
  onExecute?: (item: LibraryItem) => void;
  className?: string;
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          className="rounded-xl border bg-card p-4 space-y-3"
          key={i}
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="flex items-start justify-between">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
          </div>
          <div className="flex items-center justify-between pt-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function LibraryGrid({
  items,
  loading = false,
  error = null,
  onRetry,
  onView,
  onEdit,
  onExecute,
  className,
}: LibraryGridProps) {
  // Loading state
  if (loading) {
    return <GridSkeleton />;
  }

  // Error state
  if (error) {
    return (
      <EmptyState
        actionLabel="Retry"
        description={error}
        onAction={onRetry}
        title="Failed to load"
        variant="error"
      />
    );
  }

  // Empty state
  if (items.length === 0) {
    return <EmptyState variant="empty" />;
  }

  // Grid
  return (
    <div className={cn(
      "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
      className
    )}>
      {items.map((item, i) => (
        <div
          className="fade-up"
          key={item.id}
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <LibraryCard
            item={item}
            onEdit={onEdit}
            onExecute={onExecute}
            onView={onView}
          />
        </div>
      ))}
    </div>
  );
}
