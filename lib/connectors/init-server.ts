/**
 * Server-only connector init — dynamic filesystem scan.
 * DO NOT import this in client components.
 * Use init.ts for client-safe imports.
 */

import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { manifests, getAllConnectorNames } from "./init";

const SKILLS_CONNECTORS_PATH = join(process.cwd(), "skills", "connectors");

/**
 * Discover connector names from the skills/connectors/ directory
 * that aren't already in the TypeScript manifest list.
 */
export function discoverDynamicConnectors(): string[] {
  if (!existsSync(SKILLS_CONNECTORS_PATH)) return [];

  const tsManifestNames = new Set(manifests.map((m) => m.id));
  const skillDirs: string[] = [];

  try {
    for (const entry of readdirSync(SKILLS_CONNECTORS_PATH)) {
      if (statSync(join(SKILLS_CONNECTORS_PATH, entry)).isDirectory()) {
        if (!tsManifestNames.has(entry)) {
          skillDirs.push(entry);
        }
      }
    }
  } catch {
    // Filesystem unavailable — not an error in serverless
  }

  return skillDirs;
}

/**
 * Get ALL connector names — TypeScript manifests + skills/ directory.
 */
export function getAllConnectorNamesServer(): string[] {
  const tsNames = getAllConnectorNames();
  const dynamicNames = discoverDynamicConnectors();
  return [...new Set([...tsNames, ...dynamicNames])].sort();
}
