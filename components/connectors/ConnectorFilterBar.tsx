"use client";
/**
 * ConnectorFilterBar — search + status filter + category filter.
 *
 * A11y: labeled inputs, keyboard accessible, clear button.
 */
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ConnectorStatusFilter =
  | "all"
  | "connected"
  | "configured"
  | "disconnected";

const FILTER_OPTIONS: {
  value: ConnectorStatusFilter;
  label: string;
  dotClass: string;
}[] = [
  { value: "all", label: "All", dotClass: "bg-foreground/40" },
  { value: "connected", label: "Connected", dotClass: "bg-emerald-400" },
  { value: "configured", label: "Configured", dotClass: "bg-amber-400" },
  { value: "disconnected", label: "Disconnected", dotClass: "bg-red-400" },
];

interface ConnectorFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: ConnectorStatusFilter;
  onStatusFilterChange: (value: ConnectorStatusFilter) => void;
  totalCount: number;
  filteredCount: number;
}

export function ConnectorFilterBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  totalCount,
  filteredCount,
}: ConnectorFilterBarProps) {
  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          aria-label="Search connectors"
          className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-cyan-400/20 focus:border-cyan-400/30 transition-colors"
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search connectors by name or tool..."
          type="text"
          value={search}
        />
        {search && (
          <button
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => onSearchChange("")}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Status filter pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {FILTER_OPTIONS.map((opt) => (
          <button
            aria-label={`Filter ${opt.label}`}
            aria-pressed={statusFilter === opt.value}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-150",
              statusFilter === opt.value
                ? "bg-foreground/10 text-foreground ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
            key={opt.value}
            onClick={() => onStatusFilterChange(opt.value)}
          >
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                opt.dotClass
              )}
            />
            {opt.label}
          </button>
        ))}

        {/* Count */}
        <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
          {filteredCount === totalCount
            ? `${totalCount} total`
            : `${filteredCount} of ${totalCount}`}
        </span>
      </div>
    </div>
  );
}
