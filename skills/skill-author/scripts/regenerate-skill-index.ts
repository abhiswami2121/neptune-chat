/**
 * regenerate-skill-index.ts — U2.5.A skill-author script
 *
 * Scans playbooks/, connectors/, and skills/ directories and
 * regenerates skills/playbook-skills.md — the master index of
 * all loadable skill paths used by the Progressive Disclosure system.
 *
 * Safety: only writes to skills/playbook-skills.md. Read-only on all other paths.
 *
 * Usage via execute_skill:
 *   execute_skill skills/skill-author scripts/regenerate-skill-index.ts
 *   (no params needed)
 */

import { z } from "zod";
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

// ── Schema ──────────────────────────────────────────────────────────────────

export const RegenerateSkillIndexSchema = z.object({
  // No required params — scans everything
});

export type RegenerateSkillIndexInput = z.infer<typeof RegenerateSkillIndexSchema>;

// ── Output ──────────────────────────────────────────────────────────────────

export interface SkillScriptOutput {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

// ── Types ───────────────────────────────────────────────────────────────────

interface PlaybookEntry {
  domain: string;
  path: string;
  file: string;
}

interface ConnectorEntry {
  name: string;
  path: string;
  domain: string;
  mcp: boolean;
  description: string;
}

interface SkillEntry {
  name: string;
  path: string;
  domain: string;
}

// ── Main Function ───────────────────────────────────────────────────────────

export async function execute(_input?: RegenerateSkillIndexInput): Promise<SkillScriptOutput> {
  try {
    const CWD = process.cwd();
    const stats = { playbooks: 0, connectors: 0, capabilities: 0, functions: 0, connectorSkills: 0 };

    // ── 1. Scan playbooks ──────────────────────────────────────────────

    const playbooks: PlaybookEntry[] = [];
    const playbooksRoot = join(CWD, "playbooks");
    if (existsSync(playbooksRoot)) {
      for (const dir of readdirSync(playbooksRoot)) {
        const dirPath = join(playbooksRoot, dir);
        if (!statSync(dirPath).isDirectory() || dir.startsWith(".") || dir.startsWith("_")) continue;
        const pbName = `playbook-${dir}.md`;
        const pbPath = join(dirPath, pbName);
        if (existsSync(pbPath)) {
          playbooks.push({ domain: dir, path: `playbooks/${dir}/`, file: pbName });
        } else {
          // Try alternate names
          for (const alt of ["PLAYBOOK.md", "playbook.md", "SKILL.md"]) {
            if (existsSync(join(dirPath, alt))) {
              playbooks.push({ domain: dir, path: `playbooks/${dir}/`, file: alt });
              break;
            }
          }
        }
      }
    }
    stats.playbooks = playbooks.length;

    // ── 2. Scan connectors ─────────────────────────────────────────────

    const connectors: ConnectorEntry[] = [];
    const connectorsRoot = join(CWD, "connectors");
    if (existsSync(connectorsRoot)) {
      for (const dir of readdirSync(connectorsRoot)) {
        const dirPath = join(connectorsRoot, dir);
        if (!statSync(dirPath).isDirectory() || dir.startsWith(".") || dir.startsWith("_")) continue;

        let domain = "general";
        let mcp = false;
        let description = `${dir} connector`;

        // Try to read SKILL.md frontmatter
        const skillPath = join(dirPath, "SKILL.md");
        if (existsSync(skillPath)) {
          const skill = readFileSync(skillPath, "utf-8");
          const domainMatch = skill.match(/domain:\s*(.+)/);
          if (domainMatch) domain = domainMatch[1].trim();
          const mcpMatch = skill.match(/mcp:\s*(true|false)/i);
          if (mcpMatch) mcp = mcpMatch[1].toLowerCase() === "true";
          const descMatch = skill.match(/description:\s*(.+)/);
          if (descMatch) description = descMatch[1].trim();
        }

        // Check for MCP config file
        if (existsSync(join(dirPath, "mcp-config.json"))) mcp = true;

        connectors.push({ name: dir, path: `connectors/${dir}/`, domain, mcp, description });
      }
    }
    stats.connectors = connectors.length;

    // ── 3. Scan skills/capabilities ─────────────────────────────────────

    const capabilities: SkillEntry[] = [];
    const capsRoot = join(CWD, "skills", "capabilities");
    if (existsSync(capsRoot)) {
      for (const dir of readdirSync(capsRoot)) {
        const dirPath = join(capsRoot, dir);
        if (!statSync(dirPath).isDirectory() || dir.startsWith(".")) continue;
        let domain = "general";
        if (existsSync(join(dirPath, "SKILL.md"))) {
          const skill = readFileSync(join(dirPath, "SKILL.md"), "utf-8");
          const dm = skill.match(/domain:\s*(.+)/);
          if (dm) domain = dm[1].trim();
        }
        capabilities.push({ name: dir, path: `skills/capabilities/${dir}/`, domain });
      }
    }
    stats.capabilities = capabilities.length;

    // ── 4. Scan skills/functions ────────────────────────────────────────

    const functions: SkillEntry[] = [];
    const funcsRoot = join(CWD, "skills", "functions");
    if (existsSync(funcsRoot)) {
      for (const dir of readdirSync(funcsRoot)) {
        const dirPath = join(funcsRoot, dir);
        if (!statSync(dirPath).isDirectory() || dir.startsWith(".")) continue;
        let domain = "general";
        if (existsSync(join(dirPath, "SKILL.md"))) {
          const skill = readFileSync(join(dirPath, "SKILL.md"), "utf-8");
          const dm = skill.match(/domain:\s*(.+)/);
          if (dm) domain = dm[1].trim();
        }
        functions.push({ name: dir, path: `skills/functions/${dir}/`, domain });
      }
    }
    stats.functions = functions.length;

    // ── 5. Scan skills/connectors (per-connector docs) ──────────────────

    const connectorSkills: SkillEntry[] = [];
    const connSkillsRoot = join(CWD, "skills", "connectors");
    if (existsSync(connSkillsRoot)) {
      for (const dir of readdirSync(connSkillsRoot)) {
        const dirPath = join(connSkillsRoot, dir);
        if (!statSync(dirPath).isDirectory() || dir.startsWith(".")) continue;
        connectorSkills.push({
          name: dir,
          path: `skills/connectors/${dir}/`,
          domain: "connector-docs",
        });
      }
    }
    const totalConnSkills = connectorSkills.length;

    // ── 6. Generate markdown ───────────────────────────────────────────

    const domainNames: Record<string, string> = {
      "agent-orchestration": "Agent Orchestration",
      billing: "Billing",
      "customer-support": "Customer Support",
      "deploy-vercel-github": "Deploy (Vercel + GitHub)",
      disputes: "Disputes",
      engineering: "Engineering",
      HR: "HR",
      marketing: "Marketing",
      reporting: "Reporting",
      "vercel-discipline": "Vercel Discipline",
      "vps-ops": "VPS Ops",
    };

    const total =
      stats.playbooks +
      stats.connectors +
      stats.capabilities +
      stats.functions +
      totalConnSkills;

    let md = `# Playbook Skills — Master Index\n\n`;
    md += `Auto-generated master index of all skills, connectors, and capabilities.  \n`;
    md += `Source of truth for the Progressive Disclosure skill loading system (U2).\n`;
    md += `\n*Regenerated: ${new Date().toISOString()} by skill-author/regenerate-skill-index*\n\n`;

    // Playbooks table
    md += `## 📚 Playbooks (${playbooks.length} domains)\n\n`;
    md += `| Domain | Path | Playbook File |\n`;
    md += `|--------|------|---------------|\n`;
    for (const pb of playbooks) {
      const display = domainNames[pb.domain] || pb.domain;
      md += `| ${display} | ${pb.path} | ${pb.file} |\n`;
    }
    md += `\n`;

    // Connectors table
    md += `## 🔌 Connectors (${connectors.length} integration packs)\n\n`;
    md += `| Connector | Path | Domain | MCP | Description |\n`;
    md += `|-----------|------|--------|-----|-------------|\n`;
    for (const c of connectors) {
      const displayName = c.name.charAt(0).toUpperCase() + c.name.slice(1);
      md += `| ${displayName} | ${c.path} | ${c.domain} | ${c.mcp ? "✓" : "-"} | ${c.description} |\n`;
    }
    md += `\n`;

    // Capabilities table
    md += `## ✨ Capabilities (${capabilities.length} agent skills)\n\n`;
    md += `| Skill | Path | Domain |\n`;
    md += `|-------|------|--------|\n`;
    for (const c of capabilities) {
      md += `| ${c.name} | ${c.path} | ${c.domain} |\n`;
    }
    md += `\n`;

    // Functions table
    md += `## 🔧 Functions (${functions.length} domain functions)\n\n`;
    md += `| Function | Path | Domain |\n`;
    md += `|----------|------|--------|\n`;
    for (const f of functions) {
      md += `| ${f.name} | ${f.path} | ${f.domain} |\n`;
    }
    md += `\n`;

    // Connector skills table
    md += `## 🔗 Connector Skills (${totalConnSkills} per-connector docs)\n\n`;
    md += `| Skill | Path |\n`;
    md += `|-------|------|\n`;
    for (const cs of connectorSkills) {
      md += `| ${cs.name} | ${cs.path} |\n`;
    }
    md += `\n`;

    // Load instructions
    md += `## Load via \`load_skill\`\n\n`;
    md += "```\n";
    if (playbooks.length > 0) {
      md += `playbooks/${playbooks[0].domain}\n`;
    }
    if (connectors.length > 0) {
      md += `connectors/${connectors[0].name}\n`;
    }
    if (capabilities.length > 0) {
      md += `capabilities/${capabilities[0].name}\n`;
    }
    if (functions.length > 0) {
      md += `skills/functions/${functions[0].name}\n`;
    }
    md += "```\n\n";

    // Totals
    md += `## Totals\n\n`;
    md += `- **${playbooks.length}** playbook domains\n`;
    md += `- **${connectors.length}** connector integration packs\n`;
    md += `- **${capabilities.length}** capabilities\n`;
    md += `- **${functions.length}** functions\n`;
    md += `- **${totalConnSkills}** connector skill docs\n`;
    md += `- **${total}** total loadable skill paths\n`;
    md += `\n*Regenerated ${new Date().toISOString()}*\n`;

    // Write
    const indexPath = join(CWD, "skills", "playbook-skills.md");
    writeFileSync(indexPath, md);

    return {
      success: true,
      data: {
        regenerated: true,
        output_path: "skills/playbook-skills.md",
        stats,
        total_loadable_paths: total,
        next_step: "Index regenerated. No further action needed.",
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `regenerate-skill-index failed: ${msg}` };
  }
}

export default execute;
