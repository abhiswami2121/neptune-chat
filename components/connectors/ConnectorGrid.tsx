"use client";
/**
 * ConnectorGrid — responsive grid layout for connector cards.
 *
 * Layout:
 *  - Mobile: 1 column
 *  - Tablet (sm): 2 columns
 *  - Desktop (lg): 3 columns
 *  - Wide (xl): 4 columns
 *
 * A11y: uses CSS Grid with semantic gaps.
 */
import { cn } from "@/lib/utils";

interface ConnectorGridProps {
  children: React.ReactNode;
  className?: string;
}

export function ConnectorGrid({ children, className }: ConnectorGridProps) {
  return (
    <div
      className={cn(
        "grid gap-3",
        "grid-cols-1",
        "sm:grid-cols-2",
        "lg:grid-cols-3",
        "xl:grid-cols-4",
        className
      )}
    >
      {children}
    </div>
  );
}
