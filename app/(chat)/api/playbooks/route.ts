/**
 * GET /api/playbooks — Returns full playbook tree structure or individual playbook content
 * Query params: ?path=billing (loads single playbook) — OMIT for tree
 */
import { NextResponse } from "next/server";
import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

const ORG_PLAYBOOKS_ROOT = "/home/neptune/newleaf-org-playbooks";
const SHARED_SKILLS_ROOT = "/home/neptune/_shared-skills";
const NEPTUNE_MD_PATH = "/home/neptune/neptune-chat/.agents/neptune.md";

interface TreeNode {
  id: string;
  label: string;
  type: "file" | "directory" | "link";
  path?: string; // for files to fetch
  href?: string; // for links
  children?: TreeNode[];
  icon?: string;
  metadata?: Record<string, any>;
}

/** Simple frontmatter parser */
function parseFrontmatter(md: string): { data: Record<string, any>; content: string } {
  if (!md.startsWith("---")) return { data: {}, content: md };
  const end = md.indexOf("---", 3);
  if (end === -1) return { data: {}, content: md };
  const yamlBlock = md.slice(3, end).trim();
  const content = md.slice(end + 3).trim();
  const data: Record<string, any> = {};
  for (const line of yamlBlock.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value: any = line.slice(colonIdx + 1).trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      value = value.slice(1, -1).split(",").map((s: string) => s.trim());
    }
    data[key] = value;
  }
  return { data, content };
}

function buildTree(): TreeNode {
  const domains = [
    "billing", "disputes", "customer-support", "comms",
    "coding", "agent-orchestration", "vps-ops", "newleaf-ops", "vercel-discipline",
  ];

  const domainLabels: Record<string, string> = {
    billing: "Billing Flow",
    disputes: "Credit Disputes",
    "customer-support": "Customer Support",
    comms: "Customer Comms",
    coding: "Coding & MCP Edits",
    "agent-orchestration": "Agent Orchestration",
    "vps-ops": "VPS Operations",
    "newleaf-ops": "NewLeaf Operations",
    "vercel-discipline": "Vercel Discipline",
  };

  return {
    id: "root",
    label: "Playbooks",
    type: "directory",
    children: [
      {
        id: "system-prompt",
        label: "System Prompt",
        type: "file",
        path: "system-prompt",
        icon: "FileText",
        metadata: {
          description: "NEPTUNE.md — core agent instruction set",
          source: ".agents/neptune.md",
        },
      },
      {
        id: "workspace-playbook",
        label: "Workspace Playbook",
        type: "file",
        path: "workspace",
        icon: "BookOpen",
        metadata: {
          description: "NewLeaf Financial root playbook — loaded by all agents",
          source: "newleaf-org-playbooks/PLAYBOOK.md",
        },
      },
      {
        id: "skills-library",
        label: "Skills Library",
        type: "directory",
        children: [
          {
            id: "skills-connectors",
            label: "Connectors",
            type: "link",
            href: "/connectors",
            icon: "Plug",
            metadata: { description: "13 connector skills with tools" },
          },
          {
            id: "skills-functions",
            label: "Custom Functions",
            type: "link",
            href: "/skills?category=function",
            icon: "Wrench",
            metadata: { description: "10 custom business functions" },
          },
          {
            id: "skills-capabilities",
            label: "Capabilities",
            type: "link",
            href: "/skills?category=capability",
            icon: "Brain",
            metadata: { description: "5 agent capabilities (research, code-review, etc.)" },
          },
        ],
      },
      {
        id: "org-newleaf",
        label: "NewLeaf Financial",
        type: "directory",
        children: domains.map((d) => ({
          id: `domain-${d}`,
          label: domainLabels[d] || d,
          type: "file" as const,
          path: `newleaf/${d}`,
          icon: "FolderGit2",
          metadata: {
            description: `${domainLabels[d] || d} — domain playbook`,
            source: `newleaf-org-playbooks/${d}/PLAYBOOK.md`,
          },
        })),
      },
    ],
  };
}

function loadMarkdown(path: string): { content: string; frontmatter: Record<string, any> } | null {
  try {
    let fullPath = "";
    if (path === "system-prompt") {
      fullPath = NEPTUNE_MD_PATH;
    } else if (path === "workspace") {
      fullPath = join(ORG_PLAYBOOKS_ROOT, "PLAYBOOK.md");
    } else if (path.startsWith("newleaf/")) {
      const domain = path.replace("newleaf/", "");
      fullPath = join(ORG_PLAYBOOKS_ROOT, domain, "PLAYBOOK.md");
    }

    if (!fullPath || !existsSync(fullPath)) return null;
    const raw = readFileSync(fullPath, "utf-8");
    const { data, content } = parseFrontmatter(raw);
    return { content, frontmatter: data };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = url.searchParams.get("path");

  if (path) {
    // Load individual playbook
    const result = loadMarkdown(path);
    if (!result) {
      return NextResponse.json(
        { error: `Playbook not found: ${path}` },
        { status: 404 }
      );
    }
    return NextResponse.json({
      path,
      frontmatter: result.frontmatter,
      content: result.content,
      sections: result.content
        ? result.content
            .split(/\n## /)
            .map((s: string) => s.trim())
            .filter(Boolean)
        : [],
    });
  }

  // Return tree
  return NextResponse.json({ tree: buildTree() });
}
