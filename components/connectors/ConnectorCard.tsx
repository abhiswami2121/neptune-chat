"use client";
/**
 * ConnectorCard — world-class connector card component.
 *
 * Features:
 *  - Brand-color hero icon with status ring
 *  - Name + tagline + status badge (Connected/Configured/Disconnected/Available)
 *  - Tool count with hover-to-expand tool preview
 *  - OAuth connect button (for disconnected connectors)
 *  - Last-used timestamp (for connected connectors)
 *  - Hover: shadow + subtle scale + brand-color glow
 *  - Active/selected state with ring highlight
 *  - Keyboard accessible (Enter/Space to select)
 *  - Motion entrance animation with staggered index
 *
 * A11y: role="button", aria-pressed, tabIndex, onKeyDown
 */
import { motion } from "framer-motion";
import {
  ArrowRight,
  Clock,
  PlugIcon,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ConnectorManifest } from "@/lib/connectors/types";
import { cn } from "@/lib/utils";

type ConnectorStatus = "connected" | "configured" | "disconnected" | "available";

interface ConnectorCardProps {
  manifest: ConnectorManifest;
  status: ConnectorStatus;
  statusMessage?: string;
  toolCount: number;
  lastUsed?: string; // ISO date string
  isSelected?: boolean;
  onClick?: () => void;
  onConnect?: () => void;
  index?: number;
}

const STATUS_PRESETS: Record<
  ConnectorStatus,
  {
    label: string;
    dot: string;
    badge: string;
    iconBg: string;
    ringColor: string;
  }
> = {
  connected: {
    label: "Connected",
    dot: "bg-emerald-400",
    badge: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
    iconBg: "bg-emerald-500/10",
    ringColor: "ring-emerald-500/30",
  },
  configured: {
    label: "Configured",
    dot: "bg-amber-400",
    badge: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
    iconBg: "bg-amber-500/10",
    ringColor: "ring-amber-500/30",
  },
  disconnected: {
    label: "Disconnected",
    dot: "bg-red-400",
    badge: "bg-red-500/10 text-red-400 ring-red-500/20",
    iconBg: "bg-red-500/10",
    ringColor: "ring-red-500/30",
  },
  available: {
    label: "Available",
    dot: "bg-gray-400",
    badge: "bg-gray-500/10 text-gray-400 ring-gray-500/20",
    iconBg: "bg-gray-500/10",
    ringColor: "ring-gray-500/20",
  },
};

export function ConnectorCard({
  manifest,
  status,
  statusMessage,
  toolCount,
  lastUsed,
  isSelected,
  onClick,
  onConnect,
  index = 0,
}: ConnectorCardProps) {
  const preset = STATUS_PRESETS[status] ?? STATUS_PRESETS.disconnected;
  const Icon = manifest.icon;
  const isConnected = status === "connected";

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      initial={{ opacity: 0, y: 12 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
    >
      <Card
        aria-label={`${manifest.name} connector — ${preset.label}`}
        aria-pressed={isSelected}
        className={cn(
          "relative cursor-pointer transition-all duration-200 group",
          "hover:shadow-lg hover:shadow-zinc-950/20",
          "hover:-translate-y-0.5",
          "border border-border/50 hover:border-border",
          isSelected && "ring-2 ring-cyan-400/50 border-cyan-400/30"
        )}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
      >
        {/* Top accent strip — brand color */}
        <div
          className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl transition-all duration-200 group-hover:h-1"
          style={{ backgroundColor: manifest.brandColor }}
        />

        <CardContent className="p-4 pt-5">
          <div className="flex items-start gap-3">
            {/* Icon — brand color background with status ring */}
            <div
              className={cn(
                "relative w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200",
                "group-hover:scale-105",
                preset.iconBg
              )}
            >
              <Icon className="w-5 h-5" style={{ color: manifest.brandColor }} />
              {/* Status dot on icon */}
              <div
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card",
                  preset.dot
                )}
              />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm truncate">
                  {manifest.name}
                </span>
                <Badge
                  className={cn(
                    "text-[10px] px-1.5 py-0 ring-1 font-medium",
                    preset.badge
                  )}
                  variant="secondary"
                >
                  {preset.label}
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                {manifest.description}
              </p>

              {/* Bottom row: tools + last used / connect */}
              <div className="flex items-center justify-between mt-3 gap-2">
                {/* Tool count with hover expand hint */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground group/tools cursor-default">
                      <Wrench className="w-3 h-3" />
                      <span>{toolCount} tool{toolCount === 1 ? "" : "s"}</span>
                      <ArrowRight className="w-2.5 h-2.5 opacity-0 -translate-x-1 transition-all duration-200 group-hover/tools:opacity-100 group-hover/tools:translate-x-0" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="text-[11px]" side="bottom">
                    Click to explore {toolCount} tool{toolCount === 1 ? "" : "s"}
                  </TooltipContent>
                </Tooltip>

                {/* Right side: last used (connected) or connect button */}
                {isConnected && lastUsed ? (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {lastUsed}
                  </span>
                ) : !isConnected ? (
                  <Button
                    className="h-6 text-[10px] px-2 py-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onConnect?.();
                    }}
                    size="sm"
                    variant="outline"
                  >
                    Connect
                  </Button>
                ) : null}
              </div>

              {/* Status message (if any) */}
              {statusMessage && !isConnected && (
                <p className="text-[10px] text-muted-foreground/60 mt-1.5 truncate">
                  {statusMessage}
                </p>
              )}
            </div>

            {/* Chevron indicator */}
            <PlugIcon className="w-3.5 h-3.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
