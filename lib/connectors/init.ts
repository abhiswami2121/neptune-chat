/**
 * Connector auto-init — registers all connector manifests at import time.
 * Import this once in the chat route to populate the registry.
 */
import { registerConnector } from "./registry";

import slackManifest from "./slack/manifest";
import nmiManifest from "./nmi/manifest";
import base44Manifest from "./base44/manifest";
import hyperswitchManifest from "./hyperswitch/manifest";
import linearManifest from "./linear/manifest";
import githubManifest from "./github/manifest";
import forthManifest from "./forth/manifest";
import vapiManifest from "./vapi/manifest";
import mcpHubManifest from "./mcp-hub/manifest";

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
