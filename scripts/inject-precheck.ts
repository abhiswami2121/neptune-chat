/**
 * U7.6: Playbook Pre-Check Knowledge Injector
 *
 * Adds PRE-CHECK KNOWLEDGE section to all domain playbooks.
 * Updates routines.json with pre_check_knowledge fields.
 *
 * Usage: npx tsx scripts/inject-precheck.ts [--dry-run]
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "fs";
import { join } from "path";

const PLAYBOOKS_DIR = join(process.cwd(), "playbooks");

const DOMAIN_KNOWLEDGE_QUERIES: Record<string, string[]> = {
  billing: [
    "knowledge://billing/cardinal-rules",
    "knowledge://billing/recent-patterns",
    "knowledge://billing/connector-quirks",
    "knowledge://nmi/transaction-patterns",
  ],
  "agent-orchestration": [
    "knowledge://orchestration/cardinal-rules",
    "knowledge://orchestration/dispatch-patterns",
    "knowledge://connector/quirks",
  ],
  reporting: [
    "knowledge://reporting/cardinal-rules",
    "knowledge://reporting/query-patterns",
  ],
  "customer-support": [
    "knowledge://support/cardinal-rules",
    "knowledge://support/recent-patterns",
    "knowledge://support/connector-quirks",
  ],
  disputes: [
    "knowledge://disputes/cardinal-rules",
    "knowledge://disputes/recent-patterns",
  ],
  "deploy-vercel-github": [
    "knowledge://deploy/cardinal-rules",
    "knowledge://deploy/recent-patterns",
    "knowledge://deploy/env-var-dependencies",
    "knowledge://vercel/deploy-patterns",
  ],
  engineering: [
    "knowledge://engineering/cardinal-rules",
    "knowledge://engineering/connector-quirks",
  ],
  marketing: [
    "knowledge://marketing/cardinal-rules",
    "knowledge://marketing/recent-patterns",
  ],
  "planning-research": [
    "knowledge://planning/cardinal-rules",
    "knowledge://planning/research-patterns",
  ],
  HR: [
    "knowledge://hr/cardinal-rules",
  ],
  "vercel-discipline": [
    "knowledge://vercel/cardinal-rules",
    "knowledge://vercel/deploy-patterns",
    "knowledge://vercel/connector-quirks",
  ],
  "vps-ops": [
    "knowledge://vps-ops/cardinal-rules",
    "knowledge://vps-ops/recent-patterns",
  ],
};

const PRE_CHECK_TEMPLATE = (domain: string, queries: string[]) => `
## 🧠 PRE-CHECK KNOWLEDGE (U7.4)

Before executing any routine in this domain, the agent MUST query the Knowledge Graph:

${queries.map((q) => `- \`${q}\``).join("\n")}

If the user query mentions a specific entity (customer, transaction, deploy, connector), also query that entity for context.

**Cardinal rules from the KG get TOP PRIORITY (confidence=1.0).**
If the KG returns conflicting information with this playbook, NOTE the conflict but FOLLOW the playbook — the U4.1 self-healing loop will resolve.
`;

function injectPreCheck(domain: string, dryRun = false) {
  const domainDir = join(PLAYBOOKS_DIR, domain);
  if (!existsSync(domainDir)) {
    console.log(`  ⚠️  ${domain}: directory not found, skipping`);
    return;
  }

  // Find the playbook markdown file
  const files = readdirSync(domainDir);
  const playbookFile = files.find(
    (f) => f.startsWith("playbook-") && f.endsWith(".md")
  );
  if (!playbookFile) {
    console.log(`  ⚠️  ${domain}: no playbook-*.md found, skipping`);
    return;
  }

  const playbookPath = join(domainDir, playbookFile);
  let content = readFileSync(playbookPath, "utf-8");

  // Check if already injected
  if (content.includes("PRE-CHECK KNOWLEDGE")) {
    console.log(`  ✅ ${domain}: already has PRE-CHECK`);
    return;
  }

  const queries = DOMAIN_KNOWLEDGE_QUERIES[domain] ?? [
    `knowledge://${domain}/cardinal-rules`,
    `knowledge://${domain}/recent-patterns`,
  ];

  const preCheck = PRE_CHECK_TEMPLATE(domain, queries);

  // Insert after first heading or at end
  const headingEnd = content.indexOf("\n\n", content.indexOf("# "));
  if (headingEnd > 0) {
    content = content.slice(0, headingEnd + 2) + preCheck + content.slice(headingEnd + 2);
  } else {
    content = content + "\n" + preCheck;
  }

  if (dryRun) {
    console.log(`  📝 ${domain}: would inject PRE-CHECK (${queries.length} queries)`);
  } else {
    writeFileSync(playbookPath, content, "utf-8");
    console.log(`  ✅ ${domain}: PRE-CHECK injected (${queries.length} queries)`);
  }

  // Update routines.json
  const routinesPath = join(domainDir, "routines.json");
  if (existsSync(routinesPath)) {
    const routines = JSON.parse(readFileSync(routinesPath, "utf-8"));
    const routineList = Array.isArray(routines) ? routines : routines.routines ?? [];

    for (const routine of routineList) {
      if (!routine.pre_check_knowledge) {
        routine.pre_check_knowledge = {
          queries,
          required: true,
          timeoutMs: 5000,
        };
      }
    }

    if (!dryRun) {
      writeFileSync(routinesPath, JSON.stringify(routines, null, 2), "utf-8");
    }
  }
}

// Main
const dryRun = process.argv.includes("--dry-run");
console.log(`U7.6 Pre-Check Injector ${dryRun ? "(DRY RUN)" : "(LIVE)"}\n`);

const domains = readdirSync(PLAYBOOKS_DIR).filter((d) => {
  const fullPath = join(PLAYBOOKS_DIR, d);
  if (!statSync(fullPath).isDirectory()) return false;
  const entries = readdirSync(fullPath);
  return entries.some((f) => f.startsWith("playbook-") && f.endsWith(".md"));
});

for (const domain of domains) {
  injectPreCheck(domain, dryRun);
}

console.log(`\n✅ ${domains.length} playbooks processed`);
