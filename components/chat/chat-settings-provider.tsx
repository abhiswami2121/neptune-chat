"use client";
/**
 * ChatSettingsProvider — U1.1: lightweight chat display settings.
 * Currently supports:
 *   - showAllToolCalls: when true, disables auto-collapse and shows all tool cards
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface ChatSettings {
  showAllToolCalls: boolean;
  toggleShowAllToolCalls: () => void;
}

const ChatSettingsContext = createContext<ChatSettings | null>(null);

export function ChatSettingsProvider({ children }: { children: ReactNode }) {
  const [showAllToolCalls, setShowAllToolCalls] = useState(false);

  const value = useMemo<ChatSettings>(
    () => ({
      showAllToolCalls,
      toggleShowAllToolCalls: () => setShowAllToolCalls((v) => !v),
    }),
    [showAllToolCalls]
  );

  return (
    <ChatSettingsContext.Provider value={value}>
      {children}
    </ChatSettingsContext.Provider>
  );
}

export function useChatSettings(): ChatSettings {
  const context = useContext(ChatSettingsContext);
  if (!context) {
    // If not wrapped, return defaults (no collapse)
    return {
      showAllToolCalls: false,
      toggleShowAllToolCalls: () => {},
    };
  }
  return context;
}
