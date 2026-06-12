/**
 * Hierarchical Playbook Loader — reads organization/domain playbooks from filesystem.
 *
 * Architecture (Vercel-compatible):
 *   1. Primary: Read markdown playbooks from organizations/ directory (filesystem)
 *   2. Fallback: Inline bundled content for critical domains (billing, disputes, etc.)
 *
 * Routine support: Each playbook's ## Routines section is parsed into structured
 * steps with trigger words and parallelization hints.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

// ── Types ───────────────────────────────────────────────────────────────────

export interface RoutineStep {
  stepNumber: number;
  description: string;
  parallel?: boolean;
}

export interface Routine {
  name: string;
  triggerWords: string[];
  steps: RoutineStep[];
  safeguards?: string[];
}

export interface PlaybookDocument {
  path: string;
  domain: string;
  title: string;
  frontmatter: Record<string, unknown>;
  /** U2.4 enriched frontmatter fields */
  intentTags: string[];
  associatedConnectors: string[];
  associatedSkills: string[];
  associatedFunctions: string[];
  priority: string;
  routinesCount: number;
  graphTagPath: string | null;
  operationalKnowledge: string;
  businessContext: string;
  antiPatterns: string[];
  safeguards: string[];
  routines: Routine[];
  refinementNotes: string;
  rawContent: string;
}

export interface PlaybookLoadResult {
  domain: string;
  playbook: PlaybookDocument;
  matchedRoutine?: Routine;
  confidence: number; // 0-100
}

// ── Inline Fallback Content ──────────────────────────────────────────────────

const BILLING_FALLBACK = `
## Billing Domain — Operational Knowledge

### Core Rules (CRITICAL)
1. CONSENT BEFORE CURRENCY: No charge without verified Day 0 CIT.
2. VAULT BEFORE CHARGE: Verify vault in NMI before every charge. No direct card charges.
3. source_transaction_id is BANNED. Use initial_transaction_id.
4. Hard Decline = STOP. Never auto-retry hard declines (codes: 201, 222, 251, 253).
5. Soft Decline = Smart Retry (codes: 202, 223). Enqueue in smart-retry-engine.
6. Config Decline = Fix ONCE then retry (codes: 225, 300, 400).

### Safeguards
- Refunds over $200 need Jennifer approval (P0 safeguard).
- Refunds under $200: confirm customer identity, verify original transaction, process via NMI.
- Never refund without verifying the original charge exists in PaymentLog.
`;

const DISPUTES_FALLBACK = `
## Credit Disputes Domain — Operational Knowledge

### Core Rules
1. NEVER admit fault in writing. "We are investigating" only.
2. All dispute responses must reference specific FCRA sections.
3. 30-day response window from dispute receipt date.
4. Round tracking: each dispute round must be documented.

### Safeguards
- Before sending any dispute: verify customer has active enrollment.
- Round 2 disputes require supervisor review before sending.
- Always attach supporting documentation (credit report, dispute letter).
`;

const SUPPORT_FALLBACK = `
## Support Triage Domain — Operational Knowledge

### Core Rules
1. Classify every ticket: billing | disputes | enrollment | technical | general.
2. Billing tickets: route to billing-flow domain.
3. Dispute tickets: route to credit-disputes domain.
4. Response SLA: 4 hours during business hours, 24 hours otherwise.

### Safeguards
- Never promise specific outcomes.
- Never share internal pricing or margins.
- Always check customer profile before responding.
`;

const ENROLLMENT_FALLBACK = `
## Customer Enrollment Domain — Operational Knowledge

### Core Rules
1. Every enrollment needs: signed agreement, credit report pull, payment method on file.
2. Day 0 CIT must be completed before any billing begins.
3. Welcome sequence: agreement signed → credit pulled → payment set up → Day 0 CIT → welcome email.

### Safeguards
- Never enroll without signed agreement.
- Verify identity before pulling credit.
- Payment method must pass $1 auth before considering enrollment complete.
`;

const AGENT_ORCHESTRATION_FALLBACK = `
## Agent Orchestration Domain — Operational Knowledge

### Core Rules
1. Route tasks to the right agent based on domain expertise.
2. Multi-agent coordination: dispatch parallel tasks when possible.
3. Self-heal: if an agent fails, retry with backoff or reassign.

### Safeguards
- Never dispatch without verifying agent availability.
- Track all dispatched tasks for completion audit.
`;

const DEPLOY_FALLBACK = `
## Deploy (Vercel + GitHub) Domain — Operational Knowledge

### Core Rules
1. Every deploy goes through Vercel REST API or GitHub PR.
2. Pre-commit validation: lint + type-check before push.
3. Smoke test after every deploy.
4. NEVER push directly to main on protected repos.

### Safeguards
- CI must pass per commit.
- Rollback if production breaks.
`;

const ENGINEERING_FALLBACK = `
## Engineering Domain — Operational Knowledge

### Core Rules
1. Code review: check for patterns, anti-patterns, security, performance.
2. Architecture decisions: use ADR process with trade-off analysis.
3. PRDs: follow standard template with success criteria.

### Safeguards
- Never merge without review on critical paths.
- Always update playbooks after significant changes.
`;

const REPORTING_FALLBACK = `
## Reporting Domain — Operational Knowledge

### Core Rules
1. Use reportingHub for pre-aggregated operational data.
2. Morning pulse: daily overview of critical metrics.
3. Warehouse queries: read-only, always add LIMIT.

### Safeguards
- Never query without filters on large entities.
- Report critical findings to Slack #jarvis-admin.
`;

const VPS_OPS_FALLBACK = `
## VPS Operations Domain — Operational Knowledge

### Core Rules
1. NEVER edit VPS Python scripts or pm2 reload (cardinal 6a153d63).
2. Use native Bash/Read/Write/Edit tools for VPS work.
3. Monitor CPU/memory before running heavy operations.

### Safeguards
- Never restart pm2 without explicit user approval.
- Check Cloudflare status before assuming server is down.
`;

const VERCEL_DISCIPLINE_FALLBACK = `
## Vercel Discipline Domain — Operational Knowledge

### Core Rules
1. Vercel REST API only — never Vercel CLI on VPS.
2. env vars: managed via Vercel dashboard or API.
3. Domain management: verify DNS before switching.

### Safeguards
- Never delete production deployments.
- Always verify build succeeded before considering deploy complete.
`;

const MARKETING_FALLBACK = `
## Marketing Domain — Operational Knowledge

### Core Rules
1. DNC compliance: check DncList before every outbound contact.
2. SMS opt-out required: every message must include STOP instructions.
3. Campaign tracking: attribute leads to source for ROI measurement.

### Safeguards
- Never contact numbers on DncList.
- 10DLC compliance required for all SMS campaigns.
`;

const HR_FALLBACK = `
## HR Domain — Operational Knowledge

### Core Rules
1. Agent availability tracking: monitor staffing levels.
2. Onboarding: follow compliance training checklist.
3. PCI training: mandatory for all agents handling payment data.

### Safeguards
- Never share personnel information in public channels.
- Track training completion for audit compliance.
`;

// ── File System Playbook Loader ─────────────────────────────────────────────

const PLAYBOOKS_ROOT = join(process.cwd(), "playbooks");
const ORGS_LEGACY_ROOT = join(process.cwd(), "organizations");
const SKILLS_ROOT = join(process.cwd(), "skills");

/**
 * Parse a playbook markdown file into structured sections.
 */
/**
 * Parse YAML list items from frontmatter. Handles:
 *   - flow style: [a, b, c]
 *   - block style with dashes
 *   - comma-separated bare values
 */
function parseYamlList(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "[]") return [];
  // Flow style: [a, b, c]
  const bracketMatch = trimmed.match(/^\[(.*)\]$/);
  if (bracketMatch) {
    return bracketMatch[1].split(",").map((s) => s.trim().replace(/['"]/g, "")).filter(Boolean);
  }
  // Plain comma-separated
  if (trimmed.includes(",")) {
    return trimmed.split(",").map((s) => s.trim().replace(/['"]/g, "")).filter(Boolean);
  }
  // Single value
  return [trimmed.replace(/['"]/g, "")];
}

/**
 * Parse full YAML frontmatter block. Handles nested/indented list items
 * for intent_tags, associated_connectors, associated_skills, associated_functions.
 */
function parseFullFrontmatter(content: string): Record<string, unknown> {
  const fm: Record<string, unknown> = {};
  if (!content.startsWith("---")) return fm;

  const end = content.indexOf("---", 3);
  if (end < 0) return fm;

  const fmRaw = content.substring(3, end).trim();
  const lines = fmRaw.split("\n");

  let currentListKey: string | null = null;
  let currentListValues: string[] = [];

  for (const line of lines) {
    // Indented list item (under a list key)
    const listMatch = line.match(/^\s{2,}-\s+(.+)/);
    if (listMatch && currentListKey) {
      currentListValues.push(listMatch[1].trim().replace(/['"]/g, ""));
      continue;
    }

    // Flush the current list if we hit a non-list line
    if (currentListKey && currentListValues.length > 0) {
      fm[currentListKey] = currentListValues;
      currentListKey = null;
      currentListValues = [];
    }

    // Key: value line
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.substring(0, colonIdx).trim();
      const value = line.substring(colonIdx + 1).trim();

      // Check if value is a list indicator (empty or starts with indent marker)
      if (value === "" || value === "[]") {
        currentListKey = key;
        currentListValues = [];
      } else if (value.startsWith("[") && value.endsWith("]")) {
        fm[key] = parseYamlList(value);
      } else {
        fm[key] = value.replace(/^['"]/g, "").replace(/['"]$/g, "");
      }
    }
  }

  // Flush any remaining list
  if (currentListKey && currentListValues.length > 0) {
    fm[currentListKey] = currentListValues;
  }

  return fm;
}

function parsePlaybookMarkdown(content: string, filePath: string): PlaybookDocument {
  const lines = content.split("\n");
  const sections: Record<string, string[]> = { _current: [] };
  let currentSection = "_preamble";
  sections[currentSection] = [];

  for (const line of lines) {
    const h1 = line.match(/^# (.+)/);
    const h2 = line.match(/^## (.+)/);
    if (h1 && !h2) {
      currentSection = "title";
      sections[currentSection] = [h1[1]];
    } else if (h2) {
      const name = h2[1].toLowerCase().replace(/\s+/g, "_");
      currentSection = name;
      sections[currentSection] = [];
    } else {
      if (!sections[currentSection]) sections[currentSection] = [];
      sections[currentSection].push(line);
    }
  }

  // Extract title
  const title = (sections.title || sections._preamble || [""])[0] || filePath;

  // Parse enriched frontmatter (U2.4)
  const frontmatter = parseFullFrontmatter(content);

  // U2.4 enriched fields
  const intentTags = Array.isArray(frontmatter.intent_tags)
    ? frontmatter.intent_tags as string[]
    : typeof frontmatter.intent_tags === "string"
      ? parseYamlList(frontmatter.intent_tags as string)
      : [];
  const associatedConnectors = Array.isArray(frontmatter.associated_connectors)
    ? frontmatter.associated_connectors as string[]
    : typeof frontmatter.associated_connectors === "string"
      ? parseYamlList(frontmatter.associated_connectors as string)
      : [];
  const associatedSkills = Array.isArray(frontmatter.associated_skills)
    ? frontmatter.associated_skills as string[]
    : typeof frontmatter.associated_skills === "string"
      ? parseYamlList(frontmatter.associated_skills as string)
      : [];
  const associatedFunctions = Array.isArray(frontmatter.associated_functions)
    ? frontmatter.associated_functions as string[]
    : typeof frontmatter.associated_functions === "string"
      ? parseYamlList(frontmatter.associated_functions as string)
      : [];
  const priority = (frontmatter.priority as string) || "P2";
  const routinesCount = typeof frontmatter.routines_count === "number"
    ? frontmatter.routines_count as number
    : parseInt(frontmatter.routines_count as string, 10) || 0;

  // Check for GRAPH-TAG.json
  const dirName = filePath.substring(0, filePath.lastIndexOf("/"));
  const graphTagPath = join(dirName, "GRAPH-TAG.json");
  const hasGraphTag = existsSync(graphTagPath);

  // Parse anti-patterns
  const antiPatterns = (sections.anti_patterns || sections["anti-patterns"] || [])
    .filter((l) => l.match(/^\d+\.|^-\s|DON'T/))
    .map((l) => l.replace(/^\d+\.\s*/, "").replace(/^-\s+/, "").trim())
    .filter(Boolean);

  // Parse safeguards
  const safeguards = (sections.safeguards || [])
    .filter((l) => l.match(/^\d+\.|^-\s/))
    .map((l) => l.replace(/^\d+\.\s*/, "").replace(/^-\s+/, "").trim())
    .filter(Boolean);

  // Parse routines
  const routines = parseRoutines(sections.routines || sections.routines_ || []);

  return {
    path: filePath,
    domain: filePath.split("/").slice(-2, -1)[0] || "root",
    title,
    frontmatter,
    intentTags,
    associatedConnectors,
    associatedSkills,
    associatedFunctions,
    priority,
    routinesCount: routinesCount || routines.length,
    graphTagPath: hasGraphTag ? graphTagPath : null,
    operationalKnowledge: (sections.operational_knowledge || []).join("\n").trim(),
    businessContext: (sections.business_context || []).join("\n").trim(),
    antiPatterns,
    safeguards,
    routines,
    refinementNotes: (sections.refinement_notes || []).join("\n").trim(),
    rawContent: content,
  };
}

/**
 * Parse routines section into structured Routine objects.
 * Handles multi-line trigger word definitions (indented continuation lines).
 */
function parseRoutines(lines: string[]): Routine[] {
  const routines: Routine[] = [];
  let currentRoutine: Routine | null = null;
  let currentSteps: string[] = [];
  let inSteps = false;
  let collectingTriggers = false;
  let triggerAccumulator = "";

  for (const line of lines) {
    // Match "### Routine: Name"
    const routineHeader = line.match(/^###\s*Routine:\s*(.+)/i);
    if (routineHeader) {
      if (currentRoutine) {
        currentRoutine.steps = parseSteps(currentSteps);
        routines.push(currentRoutine);
      }
      currentRoutine = { name: routineHeader[1].trim(), triggerWords: [], steps: [], safeguards: [] };
      currentSteps = [];
      inSteps = false;
      collectingTriggers = false;
      triggerAccumulator = "";
      continue;
    }

    if (!currentRoutine) continue;

    // Collect continuation lines for multi-line trigger definitions
    if (collectingTriggers) {
      // Continuation lines are indented and contain trigger content (quotes, commas, or names)
      if (/^\s{6,}/.test(line) && /['"\[,\]]/.test(line)) {
        triggerAccumulator += " " + line.trim();
        continue;
      }
      // Done collecting — parse accumulated triggers
      currentRoutine.triggerWords = triggerAccumulator
        .split(/[,;]/)
        .map((w) => w.trim().replace(/['"]/g, ""))
        .filter(Boolean);
      collectingTriggers = false;
      triggerAccumulator = "";
    }

    // Trigger words (primary line)
    const triggerMatch = line.match(/Trigger\s*words?:?\s*(.+)/i);
    if (triggerMatch) {
      triggerAccumulator = triggerMatch[1];
      collectingTriggers = true;
      continue;
    }

    // Step detection
    if (line.match(/Mandatory\s*steps?/i) || line.match(/^\d+\.\s/)) {
      inSteps = true;
    }

    if (inSteps && line.match(/^\d+\.\s/)) {
      currentSteps.push(line.replace(/^\d+\.\s*/, "").trim());
    }

    // Parallel hint
    if (line.toLowerCase().includes("parallel") && currentSteps.length > 0) {
      currentSteps[currentSteps.length - 1] += " [PARALLEL]";
    }
  }

  // Flush any remaining trigger accumulator
  if (currentRoutine && collectingTriggers && triggerAccumulator) {
    currentRoutine.triggerWords = triggerAccumulator
      .split(/[,;]/)
      .map((w) => w.trim().replace(/['"]/g, ""))
      .filter(Boolean);
  }

  if (currentRoutine) {
    currentRoutine.steps = parseSteps(currentSteps);
    routines.push(currentRoutine);
  }

  return routines;
}

function parseSteps(rawSteps: string[]): RoutineStep[] {
  return rawSteps.map((s, i) => ({
    stepNumber: i + 1,
    description: s.replace(" [PARALLEL]", "").trim(),
    parallel: s.includes("[PARALLEL]"),
  }));
}

/**
 * Try to load a playbook from the filesystem.
 * First tries new flat playbooks/<domain>/ layout,
 * then legacy organizations/<org>/<domain>/ layout.
 */
function loadPlaybookFile(orgPath: string, domain: string): PlaybookDocument | null {
  // New paths: flat playbooks/<domain>/ layout
  const newPaths = [
    join(PLAYBOOKS_ROOT, domain, `playbook-${domain}.md`),
    join(PLAYBOOKS_ROOT, domain, "PLAYBOOK.md"),
    join(PLAYBOOKS_ROOT, domain, "playbook.md"),
  ];

  for (const p of newPaths) {
    if (existsSync(p)) {
      return parsePlaybookMarkdown(readFileSync(p, "utf-8"), p);
    }
  }

  // Legacy paths: organizations/<org>/<domain>/ layout
  const legacyPaths = [
    join(orgPath, domain, `playbook-${domain}.md`),
    join(orgPath, domain, "PLAYBOOK.md"),
    join(orgPath, domain, "playbook.md"),
  ];

  for (const p of legacyPaths) {
    if (existsSync(p)) {
      return parsePlaybookMarkdown(readFileSync(p, "utf-8"), p);
    }
  }
  return null;
}

/**
 * Scan playbooks/ and organizations/ directories for available playbooks.
 */
export function listAvailablePlaybooks(): string[] {
  const results: string[] = [];

  // 1. New flat playbooks/ layout (U2.2+)
  if (existsSync(PLAYBOOKS_ROOT)) {
    const domains = readdirSync(PLAYBOOKS_ROOT).filter((d) =>
      statSync(join(PLAYBOOKS_ROOT, d)).isDirectory()
    );
    for (const domain of domains) {
      const pb = loadPlaybookFile("", domain); // orgPath unused in flat layout
      if (pb) results.push(`playbooks/${domain}`);
    }
  }

  // 2. Legacy organizations/<org>/<domain>/ layout
  if (existsSync(ORGS_LEGACY_ROOT)) {
    const orgs = readdirSync(ORGS_LEGACY_ROOT);
    for (const org of orgs) {
      const orgPath = join(ORGS_LEGACY_ROOT, org);
      if (!statSync(orgPath).isDirectory()) continue;
      const domains = readdirSync(orgPath).filter((d) =>
        statSync(join(orgPath, d)).isDirectory()
      );
      for (const domain of domains) {
        const pb = loadPlaybookFile(orgPath, domain);
        if (pb) results.push(`${org}/${domain}`);
      }
    }
  }

  return results;
}

// ── Intent Matching ─────────────────────────────────────────────────────────

interface TriggerEntry {
  domain: string;
  triggers: string[];
  fallbackContent: string;
}

const TRIGGER_ENTRIES: TriggerEntry[] = [
  // ── P0: Billing & Payments ──
  {
    domain: "billing",
    triggers: ["refund", "charge", "bill", "payment", "transaction", "nmi", "vault", "decline", "subscription", "recurring", "invoice", "fee", "amount", "credit card", "card", "hyperswitch", "newleaf-pay", "merchant", "cvv", "225", "broken chain", "orphan sub", "billing link", "collect.js", "pay now", "update card", "reschedule", "payment date"],
    fallbackContent: BILLING_FALLBACK,
  },
  // ── P0: Customer Support ──
  {
    domain: "customer-support",
    triggers: ["ticket", "support", "help", "issue", "problem", "complaint", "cfpb", "legal", "look up", "who is", "customer", "check on", "pull up", "status", "find", "customer 360", "triage", "classify", "route", "assign", "sla", "resolve", "chargeback", "unauthorized", "frustrated"],
    fallbackContent: SUPPORT_FALLBACK,
  },
  // ── P0: Disputes & FCRA ──
  {
    domain: "disputes",
    triggers: ["dispute", "credit report", "fcra", "bureau", "equifax", "experian", "transunion", "deletion", "investigation", "round 2", "dispute round", "bureau letter", "forth", "deletion", "negative item"],
    fallbackContent: DISPUTES_FALLBACK,
  },
  // ── P1: Deploy & Ship ──
  {
    domain: "deploy-vercel-github",
    triggers: ["ship", "deploy", "land", "merge", "release", "push to prod", "pr", "pull request", "open pr", "create pr", "stale", "not updating", "old version", "cache", "rollback", "revert", "undo deploy"],
    fallbackContent: DEPLOY_FALLBACK,
  },
  // ── P1: Engineering & Code ──
  {
    domain: "engineering",
    triggers: ["review", "code review", "audit code", "architecture", "design", "pattern", "write prd", "spec out", "plan feature", "refactor", "clean up", "improve", "restructure", "debug", "bug", "error", "not working", "broken", "crash", "build", "create", "implement", "new feature", "edit file", "fix code", "modify"],
    fallbackContent: ENGINEERING_FALLBACK,
  },
  // ── P1: Agent Orchestration ──
  {
    domain: "agent-orchestration",
    triggers: ["dispatch", "send to agent", "assign", "handoff", "delegate", "multi agent", "parallel", "team", "swarm", "collaborate", "agent failed", "retry", "stuck", "agent status", "spawn", "v2 sandbox", "sandbox", "coding agent"],
    fallbackContent: AGENT_ORCHESTRATION_FALLBACK,
  },
  // ── P1: Reporting ──
  {
    domain: "reporting",
    triggers: ["morning pulse", "daily report", "today summary", "overview", "how many customers", "mrr", "revenue", "churn", "growth", "billing chain", "recon", "broken chains", "agent metrics", "commissions", "performance", "sales", "sync health", "data freshness", "warehouse", "ingestion", "enrollment stats", "funnel", "conversion", "pipeline", "report", "analytics", "query", "stats", "dashboard", "metrics"],
    fallbackContent: REPORTING_FALLBACK,
  },
  // ── P1: VPS Ops ──
  {
    domain: "vps-ops",
    triggers: ["vps health", "server status", "system check", "cpu", "memory", "vps down", "server crashed", "outage", "offline", "not responding", "vps deploy", "update server", "restart service", "pm2", "logs", "error log", "access log", "nginx", "ssl", "cert", "https", "certificate", "tls", "expired"],
    fallbackContent: VPS_OPS_FALLBACK,
  },
  // ── P1: Vercel Discipline ──
  {
    domain: "vercel-discipline",
    triggers: ["vercel deploy", "push live", "ship to cloud", "is it live", "deploy status", "build status", "vercel check", "env vars", "vercel config", "domain", "security headers", "vercel security"],
    fallbackContent: VERCEL_DISCIPLINE_FALLBACK,
  },
  // ── P2: Marketing ──
  {
    domain: "marketing",
    triggers: ["campaign", "dialer", "outbound", "call campaign", "auto dialer", "nurture", "sequence", "follow up", "drip", "sms sequence", "blast", "mass sms", "bulk email", "broadcast", "dnc", "do not call", "opt out", "unsubscribe", "campaign roi", "conversion rate", "lead source", "attribution", "enrollment flow", "signup", "onboarding sequence"],
    fallbackContent: MARKETING_FALLBACK,
  },
  // ── P2: HR ──
  {
    domain: "HR",
    triggers: ["team", "who is working", "agent availability", "staffing", "onboard", "new hire", "new agent", "welcome", "setup account", "training", "pci training", "compliance", "certification"],
    fallbackContent: HR_FALLBACK,
  },
  // ── P0: Customer Enrollment (playbook-os) ──
  {
    domain: "customer-enrollment",
    triggers: ["enroll", "sign up", "new customer", "onboarding", "welcome", "agreement", "docusign", "credit pull", "identity", "verify identity"],
    fallbackContent: ENROLLMENT_FALLBACK,
  },
];

function scoreMatch(message: string, triggers: string[]): number {
  const lower = message.toLowerCase();
  let score = 0;
  for (const trigger of triggers) {
    if (lower.includes(trigger.toLowerCase())) {
      score += trigger.length;
    }
  }
  return score;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Load relevant playbook for a user message.
 * Tries filesystem first, falls back to inline content.
 */
export function loadPlaybookForIntent(
  userMessage: string,
  org = "newleaf-financial"
): PlaybookLoadResult | null {
  const orgPath = join(ORGS_LEGACY_ROOT, org);
  const scores = TRIGGER_ENTRIES.map((entry) => ({
    entry,
    score: scoreMatch(userMessage, entry.triggers),
  }));

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  if (!best || best.score === 0) return null;

  // Try filesystem first
  let playbook = loadPlaybookFile(orgPath, best.entry.domain);
  let domain = best.entry.domain;

  // Map domain names
  if (!playbook && best.entry.domain === "customer-support") {
    playbook = loadPlaybookFile(orgPath, "customer-support");
  }

  // Build playbook from fallback if filesystem unavailable
  if (!playbook) {
    playbook = {
      path: "inline",
      domain: best.entry.domain,
      title: `${best.entry.domain} Playbook`,
      frontmatter: {},
      intentTags: [],
      associatedConnectors: [],
      associatedSkills: [],
      associatedFunctions: [],
      priority: "P1",
      routinesCount: 0,
      graphTagPath: null,
      operationalKnowledge: best.entry.fallbackContent,
      businessContext: "",
      antiPatterns: [],
      safeguards: [],
      routines: [],
      refinementNotes: "",
      rawContent: best.entry.fallbackContent,
    };
  }

  const confidence = Math.min(100, Math.round((best.score / 80) * 100));

  // Match routine
  let matchedRoutine: Routine | undefined;
  for (const routine of playbook.routines) {
    for (const trigger of routine.triggerWords) {
      const normalizedTrigger = trigger.toLowerCase().replace(/\[name\]/g, "");
      if (userMessage.toLowerCase().includes(normalizedTrigger)) {
        matchedRoutine = routine;
        break;
      }
    }
    if (matchedRoutine) break;
  }

  return {
    domain,
    playbook,
    matchedRoutine,
    confidence,
  };
}

/**
 * Load multiple playbooks matching intent above minimum threshold.
 */
export function loadPlaybooksForIntent(
  userMessage: string,
  minConfidence = 10,
  org = "newleaf-financial"
): PlaybookLoadResult[] {
  const orgPath = join(ORGS_LEGACY_ROOT, org);
  const allScores = TRIGGER_ENTRIES.map((entry) => ({
    entry,
    score: scoreMatch(userMessage, entry.triggers),
  }));

  return allScores
    .filter((s) => s.score > 0)
    .map((s) => {
      const playbook = loadPlaybookFile(orgPath, s.entry.domain) || {
        path: "inline",
        domain: s.entry.domain,
        title: `${s.entry.domain} Playbook`,
        frontmatter: {},
        intentTags: [],
        associatedConnectors: [],
        associatedSkills: [],
        associatedFunctions: [],
        priority: "P2",
        routinesCount: 0,
        graphTagPath: null,
        operationalKnowledge: s.entry.fallbackContent,
        businessContext: "",
        antiPatterns: [],
        safeguards: [],
        routines: [],
        refinementNotes: "",
        rawContent: s.entry.fallbackContent,
      };
      const confidence = Math.min(100, Math.round((s.score / 80) * 100));

      let matchedRoutine: Routine | undefined;
      for (const routine of playbook.routines || []) {
        for (const trigger of routine.triggerWords) {
          const normalizedTrigger = trigger.toLowerCase().replace(/\[name\]/g, "");
          if (userMessage.toLowerCase().includes(normalizedTrigger)) {
            matchedRoutine = routine;
            break;
          }
        }
        if (matchedRoutine) break;
      }

      return { domain: s.entry.domain, playbook, matchedRoutine, confidence };
    })
    .filter((r) => r.confidence >= minConfidence)
    .sort((a, b) => b.confidence - a.confidence);
}

/**
 * Format playbook results for system prompt injection.
 */
export function formatPlaybookContext(results: PlaybookLoadResult[]): string {
  if (results.length === 0) return "";

  const sections = results.map((r) => {
    let section = `[LOADED: ${r.domain} | Priority: ${r.playbook.priority} | Confidence: ${r.confidence}%]`;
    if (r.playbook.operationalKnowledge)
      section += `\n${r.playbook.operationalKnowledge}`;
    if (r.playbook.safeguards.length > 0)
      section += `\nSafeguards:\n${r.playbook.safeguards.map((s) => `  - ${s}`).join("\n")}`;
    if (r.playbook.associatedConnectors.length > 0)
      section += `\n\nConnector context: ${r.playbook.associatedConnectors.join(", ")}`;
    if (r.matchedRoutine) {
      section += `\n\n▶ MATCHED ROUTINE: ${r.matchedRoutine.name}`;
      section += `\n${r.matchedRoutine.steps
        .map((s) => `  ${s.stepNumber}. ${s.description}${s.parallel ? " [PARALLEL]" : ""}`)
        .join("\n")}`;
    }
    return section;
  });

  return `## OPERATIONAL CONTEXT\n\nThe following playbooks and routines apply. Follow them exactly:\n\n${sections.join("\n\n---\n\n")}`;
}

/**
 * Get the full assembled system prompt for debugging (/memory page).
 */
export function getSystemPromptContext(): {
  neptuneMd: string;
  playbooks: string[];
  skillsInScope: string[];
} {
  const neptuneMdPath = join(process.cwd(), "NEPTUNE.md");
  const neptuneMd = existsSync(neptuneMdPath)
    ? readFileSync(neptuneMdPath, "utf-8")
    : "NEPTUNE.md not found";

  const playbooks = listAvailablePlaybooks();
  const skillsInScope: string[] = [];

  if (existsSync(SKILLS_ROOT)) {
    for (const dir of ["connectors", "functions", "capabilities"]) {
      const dirPath = join(SKILLS_ROOT, dir);
      if (existsSync(dirPath))
        for (const skill of readdirSync(dirPath))
          if (statSync(join(dirPath, skill)).isDirectory())
            skillsInScope.push(`${dir}/${skill}`);
    }
  }

  return { neptuneMd, playbooks, skillsInScope };
}
