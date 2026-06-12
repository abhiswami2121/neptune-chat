/**
 * update-playbook-md.ts — U2.5.A skill-author script
 *
 * Updates a domain playbook's markdown file to include a new connector reference.
 * Adds the connector to `associated_connectors` in YAML frontmatter AND
 * appends a connector reference line to the playbook body.
 *
 * Safety: only updates playbooks/_test_* OR playbook explicitly named in args.
 *
 * Usage via execute_skill:
 *   execute_skill skills/skill-author scripts/update-playbook-md.ts {
 *     playbook_domain: "engineering",
 *     connector_name: "cat-facts",
 *     connector_path: "connectors/cat-facts"
 *   }
 */

import { z } from "zod";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

// ── Schema ──────────────────────────────────────────────────────────────────

export const UpdatePlaybookMdSchema = z.object({
  playbook_domain: z.string().min(2).describe("Domain of the playbook to update (e.g., 'engineering')"),
  connector_name: z.string().min(2).describe("Connector name to add (e.g., 'cat-facts')"),
  connector_path: z.string().optional().describe("Full connector path (e.g., 'connectors/cat-facts')"),
});

export type UpdatePlaybookMdInput = z.infer<typeof UpdatePlaybookMdSchema>;

// ── Output ──────────────────────────────────────────────────────────────────

export interface SkillScriptOutput {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

// ── Safety ──────────────────────────────────────────────────────────────────

function isSafeTarget(domain: string): boolean {
  if (domain.startsWith("_test_")) return true;
  // Allow updates to non-critical domains for skill-author
  const critical = ["billing", "disputes", "customer-support", "customer-enrollment"];
  if (critical.includes(domain)) {
    throw new Error(
      `SAFETY: Cannot edit critical playbook '${domain}'. This protects production playbooks. Use _test_ prefix for testing.`
    );
  }
  return true;
}

// ── Main Function ───────────────────────────────────────────────────────────

export async function execute(input: UpdatePlaybookMdInput): Promise<SkillScriptOutput> {
  try {
    const { playbook_domain, connector_name, connector_path } =
      UpdatePlaybookMdSchema.parse(input);

    isSafeTarget(playbook_domain);

    const CWD = process.cwd();
    const playbookPath = join(
      CWD,
      "playbooks",
      playbook_domain,
      `playbook-${playbook_domain}.md`
    );

    if (!existsSync(playbookPath)) {
      return {
        success: false,
        error: `Playbook not found: playbooks/${playbook_domain}/playbook-${playbook_domain}.md`,
      };
    }

    let content = readFileSync(playbookPath, "utf-8");
    const connPath = connector_path || `connectors/${connector_name}`;

    // ── 1. Add to YAML frontmatter associated_connectors (if list) ──
    const frontmatterStart = content.indexOf("---");
    const frontmatterEnd = content.indexOf("---", frontmatterStart + 3);

    if (frontmatterStart >= 0 && frontmatterEnd > frontmatterStart) {
      let fm = content.slice(frontmatterStart + 3, frontmatterEnd);
      const lines = fm.split("\n");

      // Find or create associated_connectors list
      let connIdx = lines.findIndex((l) =>
        l.trimStart().startsWith("associated_connectors:")
      );

      if (connIdx >= 0) {
        // Check if already listed
        if (fm.includes(`- ${connector_name}`) || fm.includes(`- ${connPath}`)) {
          // Already present — skip
        } else {
          // Add as indented list item right after the key
          const insertAt = connIdx + 1;
          // Find the end of the current list (next key: value without leading space)
          let listEnd = insertAt;
          while (listEnd < lines.length && /^\s{2,}-|^\s*$/.test(lines[listEnd])) {
            listEnd++;
          }
          lines.splice(listEnd, 0, `  - ${connector_name}`);
          fm = lines.join("\n");
          content = content.slice(0, frontmatterStart + 3) + fm + content.slice(frontmatterEnd);
        }
      } else {
        // No associated_connectors key — add before the closing ---
        const insertLine = `associated_connectors:\n  - ${connector_name}`;
        fm += "\n" + insertLine;
        content = content.slice(0, frontmatterStart + 3) + fm + content.slice(frontmatterEnd);
      }
    }

    // ── 2. Add connector reference to playbook body ──
    // Find the "## Routines" section and add a new connector note before it
    if (!content.includes(connPath)) {
      const routinesIdx = content.indexOf("## Routines");
      const insertBefore = routinesIdx >= 0 ? routinesIdx : content.length;

      const connectorNote = `\n## Connector: ${connector_name}\n\n- **Path:** ${connPath}\n- **Status:** active\n- **Domain:** ${playbook_domain}\n- **Added:** ${new Date().toISOString()}\n\n`;

      content =
        content.slice(0, insertBefore) + connectorNote + content.slice(insertBefore);
    }

    writeFileSync(playbookPath, content);

    return {
      success: true,
      data: {
        playbook_domain,
        connector_name,
        connector_path: connPath,
        file_updated: `playbooks/${playbook_domain}/playbook-${playbook_domain}.md`,
        next_step: "Run regenerate-skill-index.ts to update the master index.",
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `update-playbook-md failed: ${msg}` };
  }
}

export default execute;
