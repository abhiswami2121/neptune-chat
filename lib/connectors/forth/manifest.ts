import { ShieldIcon } from "lucide-react";
import type { ConnectorManifest } from "../types";
import { checkConnectorEnv } from "../registry";

const forthManifest: ConnectorManifest = {
  id: "forth",
  name: "Forth DPP",
  description: "Debt Protection Program — dispute management and credit repair",
  icon: ShieldIcon,
  brandColor: "#059669",
  envKeys: ["FORTH_API_TOKEN"],
  capabilities: [
    { id: "getDisputes", label: "Get Disputes", description: "Retrieve active disputes for a customer", icon: "AlertTriangle" },
    { id: "updateDispute", label: "Update Dispute", description: "Update dispute status or add evidence", icon: "Edit" },
  ],
  toolModule: () => Promise.resolve({}),
  resultRenderers: {},
  playbookPath: "lib/connectors/forth/playbook.mdx",
  getStatus: () => {
    const { ok } = checkConnectorEnv(["FORTH_API_TOKEN"]);
    return { connected: ok, message: ok ? "Connected" : "Not Configured" };
  },
};
export default forthManifest;
