/**
 * GET /api/file-tree?root=<playbooks|connectors|skills>
 *
 * Returns recursive directory tree (max depth 3) for the file tree side menu.
 * Reads from local filesystem (playbooks/, connectors/, skills/).
 *
 * U2.2 Progressive Disclosure — FileTreeNav side menu data source.
 */
import { NextRequest, NextResponse } from "next/server";
import { readdirSync, statSync, existsSync, readFileSync } from "fs";
import { join } from "path";

interface FileTreeNode {
  name: string;
  type: "directory" | "file";
  path: string;
  children?: FileTreeNode[];
  description?: string;
  icon?: string; // hint for frontend: "folder" | "plug" | "sparkles" | "book"
}

const ROOTS: Record<string, { dir: string; icon: string; depth: number }> = {
  playbooks: { dir: "playbooks", icon: "book", depth: 3 },
  connectors: { dir: "connectors", icon: "plug", depth: 3 },
  skills: { dir: "skills", icon: "sparkles", depth: 3 },
};

const CWD = process.cwd();

/** Extract YAML frontmatter description or first heading from a markdown file */
function extractDescription(filePath: string): string | undefined {
  try {
    const content = readFileSync(filePath, "utf-8");
    // Try YAML frontmatter
    if (content.startsWith("---")) {
      const end = content.indexOf("---", 3);
      if (end > 0) {
        const fm = content.substring(3, end).trim();
        const descMatch = fm.match(/^description:\s*(.+)$/m);
        if (descMatch) return descMatch[1].replace(/['"]/g, "").trim();
      }
    }
    // Try first heading
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) return h1Match[1].trim();
  } catch {
    // Ignore read errors
  }
  return undefined;
}

/** Determine frontend icon hint for a file */
function getFileIcon(fileName: string, parentIcon: string): string {
  if (fileName === "SKILL.md" || fileName === "PLAYBOOK.md") return "sparkles";
  if (fileName.startsWith("playbook-")) return "book";
  return parentIcon || "file";
}

function buildTree(dirPath: string, currentDepth: number, maxDepth: number, rootIcon: string, relPath: string): FileTreeNode[] {
  if (currentDepth > maxDepth) return [];
  if (!existsSync(dirPath)) return [];

  const nodes: FileTreeNode[] = [];

  try {
    const entries = readdirSync(dirPath).filter(e => !e.startsWith(".") && !e.startsWith("_legacy"));

    // Directories first, then files
    entries.sort((a, b) => {
      const aIsDir = statSync(join(dirPath, a)).isDirectory();
      const bIsDir = statSync(join(dirPath, b)).isDirectory();
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      return a.localeCompare(b);
    });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      const entryRelPath = relPath ? `${relPath}/${entry}` : entry;

      try {
        const stats = statSync(fullPath);

        if (stats.isDirectory()) {
          const children = buildTree(fullPath, currentDepth + 1, maxDepth, rootIcon, entryRelPath);
          nodes.push({
            name: entry,
            type: "directory",
            path: entryRelPath,
            children: children.length > 0 ? children : undefined,
            icon: currentDepth === 0 ? rootIcon : "folder",
          });
        } else if (stats.isFile() && (entry.endsWith(".md") || entry.endsWith(".mdx") || entry === "skills.json")) {
          const filePath = join(dirPath, entry);
          nodes.push({
            name: entry,
            type: "file",
            path: entryRelPath,
            description: extractDescription(filePath),
            icon: getFileIcon(entry, rootIcon),
          });
        }
      } catch {
        // Skip entries that can't be read
      }
    }
  } catch {
    // Directory unreadable
  }

  return nodes;
}

export async function GET(request: NextRequest) {
  const root = request.nextUrl.searchParams.get("root") || "playbooks";

  const config = ROOTS[root];
  if (!config) {
    return NextResponse.json(
      { error: `Unknown root "${root}". Valid: playbooks, connectors, skills` },
      { status: 400 }
    );
  }

  const fullPath = join(CWD, config.dir);
  const tree = buildTree(fullPath, 0, config.depth, config.icon, "");

  const wrapper: FileTreeNode = {
    name: root,
    type: "directory",
    path: root,
    children: tree,
    icon: config.icon,
  };

  return NextResponse.json({
    root,
    tree: wrapper,
    total: countNodes(tree),
    hint: "Use children arrays to render tree. Each node has name, type, path, optional description and icon.",
  });
}

function countNodes(nodes: FileTreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count++;
    if (node.children) count += countNodes(node.children);
  }
  return count;
}
