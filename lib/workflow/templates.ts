/**
 * Starter workflow templates — 5 pre-built workflows that demonstrate
 * the 7 node types and common integration patterns.
 */

import type { WorkflowDefinition } from "./types";

function generateId(): string {
  return `node_${Math.random().toString(36).slice(2, 10)}`;
}

const TEMPLATE_NODE_OFFSETS = {
  x: 250,
  yGap: 120,
} as const;

// ── Template 1: Morning Pulse (Daily System Health) ────────────────────────

export const morningPulseTemplate: WorkflowDefinition = {
  id: "morning-pulse",
  name: "Morning Pulse",
  description: "Daily system health check — queries Base44 reports, summarizes with AI, posts to Slack",
  category: "Operations",
  source: "manual",
  createdAt: "2026-06-09",
  updatedAt: "2026-06-09",
  nodes: [
    {
      id: generateId(),
      type: "trigger",
      position: { x: TEMPLATE_NODE_OFFSETS.x, y: 0 },
      data: {
        label: "Schedule 8am Daily",
        nodeType: "trigger",
        triggerType: "cron",
        cronExpression: "0 8 * * 1-5",
      },
    },
    {
      id: generateId(),
      type: "action",
      position: { x: TEMPLATE_NODE_OFFSETS.x, y: 120 },
      data: {
        label: "Run Morning Pulse Report",
        nodeType: "action",
        connectorId: "base44",
        toolName: "reportingHub",
        params: { action: "morning_pulse" },
      },
    },
    {
      id: generateId(),
      type: "ai",
      position: { x: TEMPLATE_NODE_OFFSETS.x, y: 240 },
      data: {
        label: "AI: Summarize Health",
        nodeType: "ai",
        prompt: "Summarize this morning's system health report into a 3-bullet Slack update. Highlight any critical issues.",
        modelId: "deepseek-v4-pro",
      },
    },
    {
      id: generateId(),
      type: "output",
      position: { x: TEMPLATE_NODE_OFFSETS.x, y: 360 },
      data: {
        label: "Post to #jarvis-admin",
        nodeType: "output",
        outputType: "slack",
        outputConfig: {
          channel: "jarvis-admin",
          channelId: "C0AQDDC3HAB",
        },
      },
    },
  ],
  edges: [],
};

// ── Template 2: Billing Sweep ──────────────────────────────────────────────

export const billingSweepTemplate: WorkflowDefinition = {
  id: "billing-sweep",
  name: "Billing Sweep",
  description: "Process billing queue — query failed payments, retry soft declines, notify customers via GHL",
  category: "Finance",
  source: "manual",
  createdAt: "2026-06-09",
  updatedAt: "2026-06-09",
  nodes: [
    {
      id: generateId(),
      type: "trigger",
      position: { x: TEMPLATE_NODE_OFFSETS.x, y: 0 },
      data: {
        label: "Daily 10am",
        nodeType: "trigger",
        triggerType: "cron",
        cronExpression: "0 10 * * *",
      },
    },
    {
      id: generateId(),
      type: "action",
      position: { x: TEMPLATE_NODE_OFFSETS.x, y: 120 },
      data: {
        label: "Query Billing Queue",
        nodeType: "action",
        connectorId: "base44",
        toolName: "queryEntity",
        params: { entity: "BillingQueue", filter: { status: "pending" }, limit: 100 },
      },
    },
    {
      id: generateId(),
      type: "action",
      position: { x: 100, y: 240 },
      data: {
        label: "Retry via Hyperswitch",
        nodeType: "action",
        connectorId: "hyperswitch",
        toolName: "createPaymentLink",
        params: { amount: 12999, styleId: "newleaf-sub-signup" },
      },
    },
    {
      id: generateId(),
      type: "action",
      position: { x: 400, y: 240 },
      data: {
        label: "Send SMS via GHL",
        nodeType: "action",
        connectorId: "ghl",
        toolName: "sendSms",
        params: { contactId: "$prev.contactId", message: "Your payment needs attention..." },
      },
    },
    {
      id: generateId(),
      type: "output",
      position: { x: TEMPLATE_NODE_OFFSETS.x, y: 360 },
      data: {
        label: "Log to #newleaf-admin",
        nodeType: "output",
        outputType: "slack",
        outputConfig: { channel: "newleaf-admin", channelId: "C096PSS45Q9" },
      },
    },
  ],
  edges: [],
};

// ── Template 3: Slack Digest ───────────────────────────────────────────────

export const slackDigestTemplate: WorkflowDefinition = {
  id: "slack-digest",
  name: "Slack Digest",
  description: "Pull messages from Slack, summarize with AI, post digest to channel",
  category: "Communication",
  source: "manual",
  createdAt: "2026-06-09",
  updatedAt: "2026-06-09",
  nodes: [
    {
      id: generateId(),
      type: "trigger",
      position: { x: TEMPLATE_NODE_OFFSETS.x, y: 0 },
      data: {
        label: "Schedule 6pm Daily",
        nodeType: "trigger",
        triggerType: "cron",
        cronExpression: "0 18 * * 1-5",
      },
    },
    {
      id: generateId(),
      type: "action",
      position: { x: TEMPLATE_NODE_OFFSETS.x, y: 120 },
      data: {
        label: "Pull from #newleaf-admin",
        nodeType: "action",
        connectorId: "slack",
        toolName: "pullMessages",
        params: { channel: "newleaf-admin", limit: 100, since: "24 hours ago" },
      },
    },
    {
      id: generateId(),
      type: "transform",
      position: { x: TEMPLATE_NODE_OFFSETS.x, y: 240 },
      data: {
        label: "Extract Key Messages",
        nodeType: "transform",
        transformCode: "filter messages by reactions > 0 or contains 'urgent'",
      },
    },
    {
      id: generateId(),
      type: "ai",
      position: { x: TEMPLATE_NODE_OFFSETS.x, y: 360 },
      data: {
        label: "AI: Digest Summary",
        nodeType: "ai",
        prompt: "Create a Slack digest from these messages. Group by topic, highlight urgent items, keep under 500 words.",
        modelId: "deepseek-v4-pro",
      },
    },
    {
      id: generateId(),
      type: "output",
      position: { x: TEMPLATE_NODE_OFFSETS.x, y: 480 },
      data: {
        label: "Post Digest",
        nodeType: "output",
        outputType: "slack",
        outputConfig: { channel: "jarvis-admin", channelId: "C0AQDDC3HAB" },
      },
    },
  ],
  edges: [],
};

// ── Template 4: Customer Journey Map ───────────────────────────────────────

export const customerJourneyTemplate: WorkflowDefinition = {
  id: "customer-journey",
  name: "Customer Journey Map",
  description: "Onboard new GHL contacts — check profile, send welcome sequence, track pipeline",
  category: "CRM",
  source: "manual",
  createdAt: "2026-06-09",
  updatedAt: "2026-06-09",
  nodes: [
    {
      id: generateId(),
      type: "trigger",
      position: { x: TEMPLATE_NODE_OFFSETS.x, y: 0 },
      data: {
        label: "New Contact Webhook",
        nodeType: "trigger",
        triggerType: "webhook",
      },
    },
    {
      id: generateId(),
      type: "action",
      position: { x: TEMPLATE_NODE_OFFSETS.x, y: 120 },
      data: {
        label: "Look Up Contact",
        nodeType: "action",
        connectorId: "base44",
        toolName: "customer360",
        params: { email: "$prev.email" },
      },
    },
    {
      id: generateId(),
      type: "conditional",
      position: { x: TEMPLATE_NODE_OFFSETS.x, y: 240 },
      data: {
        label: "Existing Customer?",
        nodeType: "conditional",
        condition: "$prev.customer !== null",
      },
    },
    {
      id: generateId(),
      type: "action",
      position: { x: 100, y: 360 },
      data: {
        label: "Send Welcome SMS",
        nodeType: "action",
        connectorId: "ghl",
        toolName: "sendSms",
        params: { contactId: "$prev.contactId", message: "Welcome to NewLeaf! Your credit specialist will reach out within 24h." },
      },
    },
    {
      id: generateId(),
      type: "action",
      position: { x: 400, y: 360 },
      data: {
        label: "Send Re-engagement Email",
        nodeType: "action",
        connectorId: "ghl",
        toolName: "sendEmail",
        params: { contactId: "$prev.contactId", subject: "We miss you!", body: "<p>Come back...</p>" },
      },
    },
    {
      id: generateId(),
      type: "output",
      position: { x: TEMPLATE_NODE_OFFSETS.x, y: 480 },
      data: {
        label: "Log Journey",
        nodeType: "output",
        outputType: "api",
      },
    },
  ],
  edges: [],
};

// ── Template 5: Code Review Pipeline ───────────────────────────────────────

export const codeReviewTemplate: WorkflowDefinition = {
  id: "code-review",
  name: "Code Review Pipeline",
  description: "Monitor GitHub PRs → AI reviews code → posts results to Slack",
  category: "Engineering",
  source: "manual",
  createdAt: "2026-06-09",
  updatedAt: "2026-06-09",
  nodes: [
    {
      id: generateId(),
      type: "trigger",
      position: { x: TEMPLATE_NODE_OFFSETS.x, y: 0 },
      data: {
        label: "Every 4 Hours",
        nodeType: "trigger",
        triggerType: "cron",
        cronExpression: "0 */4 * * *",
      },
    },
    {
      id: generateId(),
      type: "action",
      position: { x: TEMPLATE_NODE_OFFSETS.x, y: 120 },
      data: {
        label: "List Open PRs",
        nodeType: "action",
        connectorId: "github",
        toolName: "listPRs",
        params: { repo: "neptune-chat", state: "open", limit: 5 },
      },
    },
    {
      id: generateId(),
      type: "parallel",
      position: { x: TEMPLATE_NODE_OFFSETS.x, y: 240 },
      data: {
        label: "Review All PRs",
        nodeType: "parallel",
      },
    },
    {
      id: generateId(),
      type: "ai",
      position: { x: 100, y: 360 },
      data: {
        label: "AI: Security Review",
        nodeType: "ai",
        prompt: "Review this PR for security vulnerabilities. Check for: exposed secrets, SQL injection, XSS, CSRF, auth bypass. Report findings as bullet list.",
        modelId: "deepseek-v4-pro",
      },
    },
    {
      id: generateId(),
      type: "ai",
      position: { x: 400, y: 360 },
      data: {
        label: "AI: Code Quality",
        nodeType: "ai",
        prompt: "Review this PR for code quality. Check for: readability, performance issues, proper error handling, TypeScript types. Report findings as bullet list.",
        modelId: "deepseek-v4-pro",
      },
    },
    {
      id: generateId(),
      type: "transform",
      position: { x: TEMPLATE_NODE_OFFSETS.x, y: 480 },
      data: {
        label: "Merge Results",
        nodeType: "transform",
        transformCode: "combine security review + code quality into single message",
      },
    },
    {
      id: generateId(),
      type: "output",
      position: { x: TEMPLATE_NODE_OFFSETS.x, y: 600 },
      data: {
        label: "Post to #jarvis-admin",
        nodeType: "output",
        outputType: "slack",
        outputConfig: { channel: "jarvis-admin", channelId: "C0AQDDC3HAB" },
      },
    },
  ],
  edges: [],
};

// ── Template Registry ──────────────────────────────────────────────────────

export const BUILTIN_TEMPLATES: WorkflowDefinition[] = [
  morningPulseTemplate,
  billingSweepTemplate,
  slackDigestTemplate,
  customerJourneyTemplate,
  codeReviewTemplate,
];

// After definition, wire up the edges
function wireTemplateEdges(template: WorkflowDefinition): void {
  const { nodes, edges } = template;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    // ── Parallel node: wire to all children in the next layer ──────────
    if (node.data.nodeType === "parallel") {
      const childNodes = nodes.filter(
        (n) =>
          n.position.y > node.position.y &&
          n.position.y < node.position.y + 200 &&
          n.id !== node.id
      );
      for (const child of childNodes) {
        const exists = edges.find(
          (e) => e.source === node.id && e.target === child.id
        );
        if (!exists) {
          edges.push({
            id: `e-${node.id}-${child.id}`,
            source: node.id,
            target: child.id,
            data: { animated: true, flowColor: "#8B5CF6" },
          });
        }
      }
      continue;
    }

    // ── Conditional node: wire TRUE (left/center) + FALSE (right) ─────
    if (node.data.nodeType === "conditional") {
      const candidates = nodes.filter(
        (n) =>
          n.position.y > node.position.y &&
          n.position.y < node.position.y + 200 &&
          n.id !== node.id
      );

      // TRUE branch: closest to conditional's x (same or left)
      const trueBranch = candidates
        .filter((n) => n.position.x <= node.position.x + 20)
        .sort((a, b) => a.position.y - b.position.y)[0];

      // FALSE branch: right of conditional
      const falseBranch = candidates
        .filter((n) => n.position.x > node.position.x + 20)
        .sort((a, b) => a.position.y - b.position.y)[0];

      if (trueBranch) {
        const exists = edges.find(
          (e) => e.source === node.id && e.target === trueBranch.id
        );
        if (!exists) {
          edges.push({
            id: `e-${node.id}-${trueBranch.id}`,
            source: node.id,
            target: trueBranch.id,
            data: { animated: true, flowColor: "#F59E0B", label: "TRUE" },
          });
        }
      }
      if (falseBranch) {
        const exists = edges.find(
          (e) => e.source === node.id && e.target === falseBranch.id
        );
        if (!exists) {
          edges.push({
            id: `e-${node.id}-${falseBranch.id}`,
            source: node.id,
            target: falseBranch.id,
            data: { animated: true, flowColor: "#EF4444", label: "FALSE" },
          });
        }
      }
      continue;
    }

    // ── Standard sequential wiring ─────────────────────────────────────
    const nextNode = nodes.find(
      (n) =>
        n.position.y > node.position.y &&
        Math.abs(n.position.x - node.position.x) <= 200 &&
        n.id !== node.id
    );

    if (nextNode && nodes.indexOf(nextNode) > i) {
      const exists = edges.find(
        (e) => e.source === node.id && e.target === nextNode.id
      );
      if (!exists) {
        edges.push({
          id: `e-${node.id}-${nextNode.id}`,
          source: node.id,
          target: nextNode.id,
          data: { animated: true },
        });
      }
    }
  }
}

// Wire all templates
for (const template of BUILTIN_TEMPLATES) {
  wireTemplateEdges(template);
}
