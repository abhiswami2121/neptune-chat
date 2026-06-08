/**
 * Base44 SDK client — service-role wrapper for neptune-chat.
 * Uses @base44/sdk for all Base44 entity + function operations.
 */
import { createClient } from "@base44/sdk";

if (!process.env.BASE44_API_KEY) {
  throw new Error("BASE44_API_KEY is required for Base44 connector");
}

export const base44 = createClient({
  appId: "692f9a5fce9fd7c889a4b4ac",
  serviceToken: process.env.BASE44_API_KEY,
});

/** Service-role client for server-side entity reads/writes */
export const base44Service = base44.asServiceRole;

export default base44;
