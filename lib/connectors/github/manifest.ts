import { GithubIcon } from "lucide-react";
import type { ConnectorManifest } from "../types";
import { checkConnectorEnv } from "../registry";

const githubManifest: ConnectorManifest = {
  id: "github",
  name: "GitHub",
  description: "Repo access, PR automation, and code search",
  icon: GithubIcon,
  brandColor: "#6E40C9",
  envKeys: ["GITHUB_TOKEN"],
  capabilities: [
    { id: "searchCode", label: "Search Code", description: "Search across NewLeaf repositories", icon: "Search" },
    { id: "getFile", label: "Get File", description: "Read a file from the repository", icon: "File" },
    { id: "listPRs", label: "List PRs", description: "List open pull requests", icon: "GitPullRequest" },
  ],
  toolModule: () => Promise.resolve({}),
  resultRenderers: {},
  playbookPath: "lib/connectors/github/playbook.mdx",
  getStatus: () => {
    const { ok } = checkConnectorEnv(["GITHUB_TOKEN"]);
    return { connected: ok, message: ok ? "Connected" : "Not Configured" };
  },
};
export default githubManifest;
