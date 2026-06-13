"use client";

/**
 * AppSidebar — Enterprise shadcn sidebar for Neptune Chat.
 *
 * PHASE B: Comprehensive Sidebar Overhaul
 *
 * Structure:
 *   SidebarHeader  → WorkspaceSwitcher (dropdown with workspace selector)
 *   SidebarContent → New chat button + Chat History + NavAgents + NavLibrary + NavAdmin
 *   SidebarFooter  → UserMenu (avatar + name + email + Sign Out)
 *   SidebarRail    → Drag-to-resize rail
 *
 * Keyboard shortcuts (via useKeyboardShortcuts hook in ChatLayoutClient):
 *   Cmd+B → Toggle sidebar
 *   Cmd+K → Command palette
 */

import {
  MessageSquareIcon,
  PanelLeftIcon,
  PenSquareIcon,
  TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "next-auth";
import { useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import {
  getChatHistoryPaginationKey,
  SidebarHistory,
} from "@/components/chat/sidebar-history";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { WorkspaceSwitcher } from "@/components/sidebar/workspace-switcher";
import { NavAgents } from "@/components/sidebar/nav-agents";
import { NavLibrary } from "@/components/sidebar/nav-library";
import { NavAdmin } from "@/components/sidebar/nav-admin";
import { UserMenu } from "@/components/sidebar/user-menu";
import { cn } from "@/lib/utils";

/** Panel IDs used to swap right-panel content (no page navigation) */
export type PanelId =
  | "chats"
  | "connectors"
  | "tools"
  | "wiki"
  | "workflows"
  | "reports"
  | "secrets"
  | null;

interface AppSidebarProps {
  user: User | undefined;
  activePanel: PanelId;
  onSelectPanel: (panel: PanelId) => void;
}

export function AppSidebar({
  user,
  activePanel,
  onSelectPanel,
}: AppSidebarProps) {
  const router = useRouter();
  const { setOpenMobile, toggleSidebar, state } = useSidebar();
  const { mutate } = useSWRConfig();
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);

  const handleDeleteAll = () => {
    setShowDeleteAllDialog(false);
    router.replace("/");
    mutate(unstable_serialize(getChatHistoryPaginationKey), [], {
      revalidate: false,
    });
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/history`, {
      method: "DELETE",
    });
    toast.success("All chats deleted");
  };

  return (
    <>
      <Sidebar
        className="border-r border-sidebar-border bg-sidebar"
        collapsible="icon"
      >
        {/* ── Header: Workspace Switcher ──────────────────────────────── */}
        <SidebarHeader className="pb-2 pt-3">
          <WorkspaceSwitcher />
        </SidebarHeader>

        {/* ── Content: New Chat + History + Nav Groups ────────────────── */}
        <SidebarContent className="overflow-y-auto">
          {/* New Chat button + Delete All */}
          <div className="px-2 pb-1">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="h-9 rounded-lg border border-sidebar-border text-[13px] text-sidebar-foreground transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  onClick={() => {
                    setOpenMobile(false);
                    router.push("/");
                  }}
                  tooltip="New Chat"
                >
                  <PenSquareIcon className="size-4" />
                  <span className="font-medium">New chat</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {user && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-red-500/10 hover:text-red-400"
                    onClick={() => setShowDeleteAllDialog(true)}
                    tooltip="Delete All Chats"
                  >
                    <TrashIcon className="size-4" />
                    <span className="text-[13px]">Delete all</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </div>

          {/* Chat History */}
          <SidebarHistory user={user} />
          <SidebarSeparator className="bg-sidebar-border" />

          {/* Navigation Groups */}
          <NavAgents />
          <SidebarSeparator className="bg-sidebar-border" />
          <NavLibrary />
          <SidebarSeparator className="bg-sidebar-border" />
          <NavAdmin />
        </SidebarContent>

        {/* ── Footer: User Card ───────────────────────────────────────── */}
        <UserMenu user={user} />

        {/* ── Rail: Drag handle ───────────────────────────────────────── */}
        <SidebarRail />
      </Sidebar>

      {/* Delete All Chats confirmation dialog */}
      <AlertDialog
        onOpenChange={setShowDeleteAllDialog}
        open={showDeleteAllDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all chats?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete all
              your chats and remove them from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteAll}
            >
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
