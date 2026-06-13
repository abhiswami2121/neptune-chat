"use client";

/**
 * LibraryToolbar — Search, Filter, Sort, and View Toggle controls.
 * PHASE C: Knowledge Files Redesign — shadcn-based enterprise design.
 *
 * Props:
 *   searchQuery — current search text
 *   onSearchChange — callback when search changes
 *   viewMode — "grid" | "table"
 *   onViewModeChange — callback when view mode toggles
 *   sortBy — current sort field
 *   onSortChange — callback when sort changes
 *   filterCategory — current category filter
 *   onFilterChange — callback when filter changes
 *   totalCount — total items (shown as badge)
 */

import {
  FilterIcon,
  Grid3X3Icon,
  LayoutListIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "lucide-react";
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const SORT_OPTIONS = [
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
  { value: "updated-desc", label: "Recently Updated" },
  { value: "updated-asc", label: "Oldest First" },
  { value: "type", label: "By Type" },
] as const;

const CATEGORY_OPTIONS = [
  { value: "all", label: "All" },
  { value: "playbook", label: "Playbooks" },
  { value: "connector", label: "Connectors" },
  { value: "skill", label: "Skills" },
  { value: "function", label: "Functions" },
  { value: "prd", label: "PRDs" },
  { value: "wiki", label: "Wiki" },
] as const;

export type ViewMode = "grid" | "table";

interface LibraryToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
  filterCategory: string;
  onFilterChange: (value: string) => void;
  totalCount: number;
  className?: string;
}

export function LibraryToolbar({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  sortBy,
  onSortChange,
  filterCategory,
  onFilterChange,
  totalCount,
  className,
}: LibraryToolbarProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      {/* Left: Search + Count */}
      <div className="flex flex-1 items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pl-9 pr-8 text-sm"
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search knowledge files..."
            type="search"
            value={searchQuery}
          />
          {searchQuery && (
            <button
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-sm hover:bg-muted text-muted-foreground hover:text-foreground"
              onClick={() => onSearchChange("")}
              type="button"
            >
              <XIcon className="size-3.5" />
            </button>
          )}
        </div>
        <Badge className="h-7 px-2.5 text-xs font-medium tabular-nums" variant="secondary">
          {totalCount}
        </Badge>
      </div>

      {/* Right: Filter + Sort + View Toggle */}
      <div className="flex items-center gap-2">
        {/* Category filter */}
        <Select onValueChange={onFilterChange} value={filterCategory}>
          <SelectTrigger className="h-9 w-[120px] text-xs gap-1.5">
            <FilterIcon className="size-3.5 text-muted-foreground" />
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select onValueChange={onSortChange} value={sortBy}>
          <SelectTrigger className="h-9 w-[150px] text-xs gap-1.5">
            <SlidersHorizontalIcon className="size-3.5 text-muted-foreground" />
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* View toggle */}
        <div className="flex rounded-lg border p-0.5">
          <Button
            aria-label="Grid view"
            className={cn(
              "h-7 w-7 rounded-md p-0",
              viewMode === "grid"
                ? "bg-muted text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => onViewModeChange("grid")}
            size="icon"
            variant="ghost"
          >
            <Grid3X3Icon className="size-3.5" />
          </Button>
          <Button
            aria-label="Table view"
            className={cn(
              "h-7 w-7 rounded-md p-0",
              viewMode === "table"
                ? "bg-muted text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => onViewModeChange("table")}
            size="icon"
            variant="ghost"
          >
            <LayoutListIcon className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
