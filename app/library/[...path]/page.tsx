/**
 * /library/[...path] — Dynamic catch-all for viewing any playbook, connector, or skill file.
 *
 * U2.2 Progressive Disclosure — Renders SKILL.md or playbook-*.md files as MDX.
 * Shows YAML frontmatter as a styled header card.
 */
import { notFound } from "next/navigation";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { ArrowLeft, BookOpen, FileText, Plug, Sparkles } from "lucide-react";
import React from "react";

const CWD = process.cwd();

// ── Types ────────────────────────────────────────────────────────────────────

interface Frontmatter {
  name?: string;
  description?: string;
  version?: string;
  domain?: string;
  mcp?: string;
  custom_client?: string;
  [key: string]: string | undefined;
}

// ── Page props ───────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ path: string[] }>;
}

// ── Markdown rendering ───────────────────────────────────────────────────────

function parseFrontmatter(content: string): { frontmatter: Frontmatter; body: string } {
  if (!content.startsWith("---")) {
    return { frontmatter: {}, body: content };
  }

  const end = content.indexOf("---", 3);
  if (end < 0) return { frontmatter: {}, body: content };

  const fmRaw = content.substring(3, end).trim();
  const body = content.substring(end + 3).trim();

  const frontmatter: Frontmatter = {};
  for (const line of fmRaw.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.substring(0, colonIdx).trim();
      const value = line.substring(colonIdx + 1).trim().replace(/^['"]/g, "").replace(/['"]$/g, "");
      frontmatter[key] = value;
    }
  }

  return { frontmatter, body };
}

function renderMarkdown(md: string): string {
  // Simple markdown-to-HTML for headings, bold, lists, code blocks, tables
  let html = md;

  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g,
    '<pre class="bg-muted p-3 rounded-md overflow-x-auto text-xs font-mono my-3"><code>$2</code></pre>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs font-mono">$1</code>');

  // Headings
  html = html.replace(/^#### (.+)$/gm, '<h4 class="text-sm font-semibold mt-4 mb-1">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-5 mb-2">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mt-6 mb-3 border-b pb-1">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-6 mb-4">$1</h1>');

  // Bold / Italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary hover:underline">$1</a>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr class="my-4 border-border">');

  // Tables
  html = html.replace(/^\|(.+)\|$/gm, (match) => {
    const cells = match.split("|").filter(c => c.trim());
    if (match.includes("---")) return ""; // Skip separator rows
    const isHeader = cells.length > 0 && cells[0].trim().startsWith("#");
    const tag = isHeader ? "th" : "td";
    return `<tr>${cells.map(c =>
      `<${tag} class="border px-2 py-1 text-sm">${c.trim().replace(/^# /, "")}</${tag}>`
    ).join("")}</tr>`;
  });

  // Wrap table rows
  html = html.replace(/(<tr>[\s\S]*?<\/tr>)+/g,
    '<table class="w-full border-collapse border my-3 text-sm"><tbody class="[&_tr:first-child]:bg-muted/50">$&</tbody></table>');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-sm">$1</li>');
  html = html.replace(/(<li[\s\S]*?<\/li>)+/g, '<ul class="my-2 space-y-1">$&</ul>');

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-sm">$1</li>');

  // Paragraphs (non-empty lines that aren't already HTML tags)
  html = html.replace(/^(?!<[a-z/])([A-Za-z].+)$/gm, '<p class="text-sm my-2">$1</p>');

  return html;
}

// ── File resolution ──────────────────────────────────────────────────────────

function resolveFile(segments: string[]): { content: string; sourcePath: string; category: string } | null {
  const relPath = segments.join("/");

  // Try connectors/<name>/SKILL.md
  const connectorSkillPath = join(CWD, "connectors", segments[0], "SKILL.md");
  if (existsSync(connectorSkillPath)) {
    return {
      content: readFileSync(connectorSkillPath, "utf-8"),
      sourcePath: `connectors/${segments[0]}/SKILL.md`,
      category: "connector",
    };
  }

  // Try connectors/<name>/PLAYBOOK.md
  const connectorPlaybookPath = join(CWD, "connectors", segments[0], "PLAYBOOK.md");
  if (existsSync(connectorPlaybookPath)) {
    return {
      content: readFileSync(connectorPlaybookPath, "utf-8"),
      sourcePath: `connectors/${segments[0]}/PLAYBOOK.md`,
      category: "connector",
    };
  }

  // Try playbooks/<domain>/<file>
  const playbookPath = join(CWD, "playbooks", ...segments);
  if (existsSync(playbookPath)) {
    return {
      content: readFileSync(playbookPath, "utf-8"),
      sourcePath: `playbooks/${relPath}`,
      category: "playbook",
    };
  }

  // Try playbooks/<domain>/playbook-<domain>.md
  const standardPlaybookPath = join(CWD, "playbooks", segments[0], `playbook-${segments[0]}.md`);
  if (segments.length === 1 && existsSync(standardPlaybookPath)) {
    return {
      content: readFileSync(standardPlaybookPath, "utf-8"),
      sourcePath: `playbooks/${segments[0]}/playbook-${segments[0]}.md`,
      category: "playbook",
    };
  }

  // Try skills/<category>/<name>/SKILL.md
  if (segments.length >= 2) {
    const skillPath = join(CWD, "skills", ...segments, "SKILL.md");
    if (existsSync(skillPath)) {
      return {
        content: readFileSync(skillPath, "utf-8"),
        sourcePath: `skills/${relPath}/SKILL.md`,
        category: "skill",
      };
    }
  }

  // Try skills/<category>/<name>.md
  const skillFlatPath = join(CWD, "skills", `${relPath}.md`);
  if (existsSync(skillFlatPath)) {
    return {
      content: readFileSync(skillFlatPath, "utf-8"),
      sourcePath: `skills/${relPath}.md`,
      category: "skill",
    };
  }

  return null;
}

function getCategoryIcon(category: string) {
  switch (category) {
    case "playbook": return <BookOpen size={20} />;
    case "connector": return <Plug size={20} />;
    case "skill": return <Sparkles size={20} />;
    default: return <FileText size={20} />;
  }
}

// ── Page Component ────────────────────────────────────────────────────────────

export default async function LibraryPathPage({ params }: PageProps) {
  const { path } = await params;
  const resolved = resolveFile(path);

  if (!resolved) {
    notFound();
  }

  const { frontmatter, body } = parseFrontmatter(resolved.content);

  // Try to get title from frontmatter or first heading
  const title = frontmatter.name
    || frontmatter.title
    || path[path.length - 1]?.replace(/\.md$/, "").replace(/-/g, " ")
    || "Document";

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/chat" className="hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft size={14} />
          <span>Neptune</span>
        </Link>
        <span>/</span>
        <span className="capitalize">{resolved.category}</span>
        <span>/</span>
        <span className="text-foreground font-medium capitalize">{title}</span>
      </div>

      {/* Frontmatter header card */}
      {(frontmatter.name || frontmatter.description || frontmatter.domain) && (
        <Card className="mb-8">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="text-primary">
                {getCategoryIcon(resolved.category)}
              </div>
              <div>
                <CardTitle className="text-xl capitalize">{title}</CardTitle>
                {frontmatter.description && (
                  <p className="text-sm text-muted-foreground mt-1">{frontmatter.description}</p>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {frontmatter.domain && (
                <Badge variant="secondary" className="text-xs">
                  {frontmatter.domain}
                </Badge>
              )}
              {frontmatter.version && (
                <Badge variant="outline" className="text-xs font-mono">
                  v{frontmatter.version}
                </Badge>
              )}
              {frontmatter.mcp && (
                <Badge variant="secondary" className="text-xs bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  MCP
                </Badge>
              )}
              {frontmatter.custom_client === "true" && (
                <Badge variant="secondary" className="text-xs bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                  Custom Client
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Source path */}
      <div className="text-xs text-muted-foreground mb-4 font-mono">
        📄 {resolved.sourcePath}
      </div>

      <Separator className="mb-6" />

      {/* Rendered body */}
      <div
        className="prose prose-sm dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }}
      />
    </div>
  );
}
