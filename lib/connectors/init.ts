/**
 * Connector auto-init — registers all connector manifests at import time.
 * Also exports dynamic connector discovery (server-only via init-server.ts).
 */

import affyManifest from "./affy/manifest";
import base44Manifest from "./base44/manifest";
import forthManifest from "./forth/manifest";
import ghlManifest from "./ghl/manifest";
import githubManifest from "./github/manifest";
import hyperswitchManifest from "./hyperswitch/manifest";
import linearManifest from "./linear/manifest";
import mcpHubManifest from "./mcp-hub/manifest";
import nmiManifest from "./nmi/manifest";
import { registerConnector } from "./registry";
import slackManifest from "./slack/manifest";
import vapiManifest from "./vapi/manifest";
import vercelManifest from "./vercel/manifest";
import wikiManifest from "./wiki/manifest";

const manifests = [
  slackManifest,
  nmiManifest,
  base44Manifest,
  hyperswitchManifest,
  linearManifest,
  githubManifest,
  forthManifest,
  vapiManifest,
  mcpHubManifest,
  wikiManifest,
  ghlManifest,
  affyManifest,
  vercelManifest,
];

let initialized = false;

export function initConnectors(): void {
  if (initialized) return;
  for (const m of manifests) {
    registerConnector(m);
  }
  initialized = true;
}

export { manifests };

/**
 * List ALL connector names — dynamically enriched by server-side scan.
 * In the client, this only returns TypeScript manifest names.
 * The server uses init-server.ts to add skills/connectors/ directory names.
 */
export function getAllConnectorNames(): string[] {
  return manifests.map((m) => m.id);
}
