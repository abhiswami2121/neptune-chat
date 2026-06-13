/**
 * V2SessionProvider — Global context for V2 agent session state.
 *
 * PHASE 6: V2 Live Panel + Steering (U3.5)
 *
 * Manages:
 *   - activeSessionId — which V2 session is being viewed
 *   - isPanelOpen — whether the V2 Live Panel is open
 *   - sessionGoal, sessionRepo, sessionBranch, sessionModel — metadata
 *   - openSession / closeSession — to show/hide the panel
 *
 * Wire this into ChatLayoutClient so the V2LivePanel overlays from anywhere.
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export interface V2SessionMeta {
  sessionId: string;
  goal?: string;
  repo?: string;
  branch?: string;
  model?: string;
}

interface V2SessionContextType {
  activeSession: V2SessionMeta | null;
  isPanelOpen: boolean;
  openSession: (meta: V2SessionMeta) => void;
  closeSession: () => void;
}

const V2SessionContext = createContext<V2SessionContextType | null>(null);

export function V2SessionProvider({ children }: { children: ReactNode }) {
  const [activeSession, setActiveSession] = useState<V2SessionMeta | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const openSession = useCallback((meta: V2SessionMeta) => {
    setActiveSession(meta);
    setIsPanelOpen(true);
  }, []);

  const closeSession = useCallback(() => {
    setIsPanelOpen(false);
    // Keep activeSession metadata for a moment so the panel can finish
    // clearing. Reset after animation.
    setTimeout(() => setActiveSession(null), 300);
  }, []);

  return (
    <V2SessionContext.Provider
      value={{ activeSession, isPanelOpen, openSession, closeSession }}
    >
      {children}
    </V2SessionContext.Provider>
  );
}

export function useV2Session(): V2SessionContextType {
  const ctx = useContext(V2SessionContext);
  if (!ctx) {
    throw new Error("useV2Session must be used within V2SessionProvider");
  }
  return ctx;
}
