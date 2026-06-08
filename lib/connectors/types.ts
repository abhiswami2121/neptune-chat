/**
 * ConnectorManifest — canonical connector model.
 * Every connector directory exports a manifest of this shape.
 */
import type { ComponentType } from "react";

export interface ConnectorStatus {
  connected: boolean;
  message?: string;
  lastChecked?: string;
}

export interface ConnectorCapability {
  id: string;
  label: string;
  description: string;
  icon?: string; // lucide icon name
  schema?: Record<string, unknown>; // Zod schema shape for docs
}

export interface ConnectorManifest {
  /** Unique connector id: 'slack' | 'nmi' | 'base44' | 'hyperswitch' */
  id: string;
  /** Human-readable name */
  name: string;
  /** One-line description */
  description: string;
  /** Lucide icon component or React element */
  icon: ComponentType<Record<string, unknown>>;
  /** Brand hex color for top-border accent */
  brandColor: string;
  /** Env var keys required for this connector */
  envKeys: string[];
  /** Capabilities exposed as tools */
  capabilities: ConnectorCapability[];
  /** Lazy-load tools module */
  toolModule: () => Promise<Record<string, unknown>>;
  /** Result renderers keyed by capability id */
  resultRenderers: Record<string, ComponentType<{ output: unknown }>>;
  /** Path to MDX playbook */
  playbookPath: string;
  /** Optional connection test */
  testConnection?: () => Promise<{ ok: boolean; error?: string }>;
  /** Documentation links */
  docs?: { official: string; ourGuide?: string };
  /** Status resolver */
  getStatus: () => ConnectorStatus;
}

/** Registry entry — manifest + cached tools + status */
export interface ConnectorEntry {
  manifest: ConnectorManifest;
  tools: Record<string, unknown> | null;
  status: ConnectorStatus;
}
