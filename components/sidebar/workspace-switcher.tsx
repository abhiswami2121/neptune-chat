"use client";

/**
 * WorkspaceSwitcher — Dropdown to switch between Neptune workspaces.
 * PHASE B: Sidebar Overhaul — shadcn-based enterprise design.
 *
 * Uses DropdownMenu for the workspace selector in the SidebarHeader.
 * Currently shows "Neptune Chat" as default with expandability for future workspaces.
 */

import {
  CheckIcon,
  ChevronsUpDownIcon,
  MessageSquareIcon,
  PlusIcon,
  WorkflowIcon,
} from "lucide-react";
import React, { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const WORKSPACES = [
  {
    id: "neptune-chat",
    name: "Neptune Chat",
    plan: "Enterprise",
    icon: MessageSquareIcon,
    color: "text-cyan-400",
    bg: "bg-cyan-400/10",
  },
  {
    id: "neptune-v2",
    name: "Neptune V2",
    plan: "Enterprise",
    icon: WorkflowIcon,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
  },
] as const;

export function WorkspaceSwitcher() {
  const { isMobile, state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [activeWorkspace, setActiveWorkspace] = useState<string>(WORKSPACES[0].id);

  const active = WORKSPACES.find((w) => w.id === activeWorkspace) ?? WORKSPACES[0];
  const ActiveIcon = active.icon;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              className={cn(
                "w-full data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground",
                "transition-all duration-150"
              )}
              size="lg"
            >
              <div className={cn(
                "flex aspect-square size-8 items-center justify-center rounded-lg",
                active.bg
              )}>
                <ActiveIcon className={cn("size-4", active.color)} />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{active.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {active.plan}
                </span>
              </div>
              <ChevronsUpDownIcon className="ml-auto size-4 text-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Workspaces
            </DropdownMenuLabel>
            {WORKSPACES.map((workspace) => {
              const Icon = workspace.icon;
              return (
                <DropdownMenuItem
                  className="gap-2 p-2 cursor-pointer"
                  key={workspace.id}
                  onClick={() => setActiveWorkspace(workspace.id)}
                >
                  <div className={cn(
                    "flex size-6 items-center justify-center rounded-md",
                    workspace.bg
                  )}>
                    <Icon className={cn("size-3.5", workspace.color)} />
                  </div>
                  <span>{workspace.name}</span>
                  {workspace.id === activeWorkspace && (
                    <CheckIcon className="ml-auto size-4 text-cyan-400" />
                  )}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2 cursor-pointer text-muted-foreground">
              <div className="flex size-6 items-center justify-center rounded-md border border-dashed">
                <PlusIcon className="size-3.5" />
              </div>
              <span>Add workspace</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
