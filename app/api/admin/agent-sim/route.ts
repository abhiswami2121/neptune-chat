/**
 * POST /api/admin/agent-sim — Agent Simulation endpoint (Phase 12.E)
 *
 * Runs the SAME user query through two modes and returns comparison stats:
 *   1. "Bloated" mode — full system prompt with connector catalog + all tools
 *   2. "Progressive Disclosure" mode — minimal prompt + 3 loader tools
 *
 * Returns: tokens, tools, estimated cost, hypothetical paths, and answer placeholders.
 *
 * This is a SIMULATION — it estimates token counts and tool counts rather than
 * making actual LLM calls, so it's fast and free. Real A/B testing can be done
 * by toggling PROGRESSIVE_DISCLOSURE_ENABLED and observing live chats.
 */
import { NextResponse } from "next/server";
import { requireAllowlist } from "@/lib/auth/require-allowlist";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// ── Types ──────────────────────────────────────────────────────────────────

interface SimulationRequest {
  query: string;
}

interface ModeResult {
  mode: "bloated" | "progressive";
  systemPromptTokens: number;
  systemPromptPreview?: string;
  toolsAvailable: string[];
  toolsCount: number;
  estimatedTotalTokens: number;
  estimatedCost: string;
  discoveryPath: string[];
  pathDepth: number;
  hypotheticalAnswer: string;
  latencyEstimate: string;
}

interface SimulationResponse {
  query: string;
  bloated: ModeResult;
  progressive: ModeResult;
  comparison: {
    tokenReduction: string;
    toolReduction: string;
    costSavings: string;
    winner: "progressive" | "bloated" | "tie";
    winnerReason: string;
  };
}

// ── Constants ──────────────────────────────────────────────────────────────

const NEPTUNE_ROOT = "/home/neptune/neptune-chat";

function estimateTokens(text: string): number {
  // Rough: ~4 chars per token
  return Math.round(text.length / 4);
}

function estimateCost(tokens: number, modelName = "claude-sonnet-4-20250514"): string {
  // Claude Sonnet pricing: $3/M input tokens
  const cost = (tokens / 1_000_000) * 3;
  return `$${cost.toFixed(4)}`;
}

// ── Domain Intent Detection ────────────────────────────────────────────────

interface DomainMatch { domain: string; confidence: number; playbook: string; connectors: string[]; triggers: string[]; }

function detectDomain(query: string): DomainMatch | null {
  const lower = query.toLowerCase();

  const domainMap: Record<string, DomainMatch> = {
    billing: {
      domain: "billing-flow",
      confidence: 0,
      playbook: "billing",
      connectors: ["nmi-connector", "hyperswitch-connector", "forth-connector", "base44-connector"],
      triggers: ["refund", "decline", "charge", "payment", "billing", "invoice", "retry payment"],
    },
    "customer-support": {
      domain: "support-triage",
      confidence: 0,
      playbook: "customer-support",
      connectors: ["slack-connector", "vapi-connector", "ghl-connector", "base44-connector", "linear-connector"],
      triggers: ["ticket", "support", "customer issue", "help", "escalate", "call log"],
    },
    disputes: {
      domain: "credit-disputes",
      confidence: 0,
      playbook: "disputes",
      connectors: ["forth-connector", "base44-connector", "slack-connector"],
      triggers: ["dispute", "credit report", "negative item", "FCRA", "debt validation"],
    },
    marketing: {
      domain: "marketing",
      confidence: 0,
      playbook: "marketing",
      connectors: ["ghl-connector", "affy-connector", "slack-connector"],
      triggers: ["campaign", "lead", "email blast", "nurture", "marketing"],
    },
    reporting: {
      domain: "reporting",
      confidence: 0,
      playbook: "reporting",
      connectors: ["base44-connector", "slack-connector", "wiki-connector"],
      triggers: ["report", "dashboard", "snapshot", "morning pulse", "analytics", "metrics"],
    },
    engineering: {
      domain: "engineering",
      confidence: 0,
      playbook: "engineering",
      connectors: ["github-connector", "vercel-connector", "linear-connector", "mcp-hub-connector", "neptune-connector"],
      triggers: ["code review", "PR", "deploy", "build", "feature", "architecture", "refactor"],
    },
    "planning-research": {
      domain: "planning-research",
      confidence: 0,
      playbook: "planning-research",
      connectors: ["neptune-connector", "github-connector", "base44-connector"],
      triggers: ["plan", "research", "PRD", "TRD", "architecture", "design", "gap analysis"],
    },
    "vps-ops": {
      domain: "vps-ops",
      confidence: 0,
      playbook: "vps-ops",
      connectors: ["slack-connector", "wiki-connector"],
      triggers: ["VPS", "server", "pm2", "nginx", "Cloudflare", "DNS", "Hostinger"],
    },
    "vercel-discipline": {
      domain: "vercel-discipline",
      confidence: 0,
      playbook: "vercel-discipline",
      connectors: ["vercel-connector", "github-connector", "slack-connector"],
      triggers: ["vercel", "deploy", "ship", "preview", "production"],
    },
  };

  let bestMatch: DomainMatch | null = null;
  let bestScore = 0;

  for (const [, dm] of Object.entries(domainMap)) {
    let score = 0;
    for (const t of dm.triggers) {
      if (lower.includes(t)) score += 10;
    }
    // Also check domain name
    if (lower.includes(dm.playbook.replace(/-/g, " "))) score += 5;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = { ...dm, confidence: Math.min(score / 30, 1) };
    }
  }

  return bestMatch;
}

// ── Load Prompt Sizes ──────────────────────────────────────────────────────

function getBloatedSystemPrompt(): string {
  // Simulate what the full system prompt looks like
  const catalogPath = join(NEPTUNE_ROOT, "skills", "playbook-skills.md");
  const connectorCount = 17;
  const avgToolDocSize = 600; // chars per tool doc

  let prompt = "You are Neptune Chat — an SOP-executing AI agent... [~500 words identity]";
  prompt += "\n\n## Available Connectors\n\n";
  prompt += `| # | Connector | Status | Tools | Tool Names |\n`;
  for (let i = 0; i < connectorCount; i++) {
    prompt += `| ${i + 1} | connector-${i + 1} | 🟡 configured | ${Math.floor(Math.random() * 6) + 2} | tool_a, tool_b, tool_c |\n`;
  }
  prompt += "\n## PLAYBOOK-ROUTER (Intent Map)\n\n[~3000 chars playbook router]\n";
  prompt += "\n## PRE-CHECK KNOWLEDGE\n\n[~800 chars KG pre-check]\n";
  prompt += "\n## Artifacts\n\n[~2000 chars artifact instructions]\n";
  prompt += "\n## Connector Playbooks\n\n[~5000 chars operational context]\n";
  prompt += "\n## Self-Modification\n\n[~600 chars routing]\n";

  return prompt;
}

function getProgressiveSystemPrompt(): string {
  return `You are Neptune, an AI agent for NewLeaf Financial.

## Your ONE Move
When you receive a message:
1. Identify the business domain
2. Call load_playbook with the matching domain name
3. Follow the playbook's instructions exactly
4. Use load_connector for integration-specific instructions
5. Use load_function for detailed function signatures

## Cardinal Rules
- load_playbook FIRST — before any other action
- Never guess — load the playbook for instructions
- Follow SOPs in order — do not skip steps`;
}

// ── Handler ────────────────────────────────────────────────────────────────

export const POST = requireAllowlist(async (request: Request) => {
  let query: string;
  try {
    const body = await request.json() as SimulationRequest;
    query = body.query || "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!query.trim()) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  const domain = detectDomain(query) || {
    domain: "general",
    confidence: 0.1,
    playbook: "planning-research",
    connectors: ["neptune-connector"],
    triggers: [],
  };

  // ── Bloated Mode ────────────────────────────────────────────────────────
  const bloatedPrompt = getBloatedSystemPrompt();
  const bloatedSystemTokens = estimateTokens(bloatedPrompt);
  const bloatedTools = [
    "getWeather", "createDocument", "editDocument", "updateDocument", "requestSuggestions",
    "viewFile", "executeSkill", "listPlaybooks", "loadSkill", "selfCode", "spawnCodingAgent",
    "nmi.queryTransactions", "nmi.getVault", "slack.pullMessages", "slack.postMessage",
    "github.readFile", "github.createPR", "base44.entity_query", "base44.entity_get",
    "ghl.sendSMS", "ghl.getContact", "hyperswitch.createPayment", "forth.queryDisputes",
    "vapi.getCallLog", "vercel.deploy", "affy.submitAffidavit", "wiki.ingest",
    "linear.createIssue", "mcpHub.bridge", "aiSdk6.streamText", "workflowDevKit.createWorkflow",
  ];
  const bloatedUserTokens = estimateTokens(query);
  const bloatedTotal = bloatedSystemTokens + bloatedUserTokens + 2000; // + response estimate

  // ── Progressive Mode ─────────────────────────────────────────────────────
  const progressivePrompt = getProgressiveSystemPrompt();
  const progressiveSystemTokens = estimateTokens(progressivePrompt);
  const progressiveTools = ["load_playbook", "load_connector", "load_function"];

  // Simulate discovery path: playbook → connector → function
  const discoveryPath = [
    `1. load_playbook("${domain.playbook}") → ${domain.confidence > 0.2 ? "✓ matched" : "⚠️ low confidence"}`,
    domain.connectors.length > 0
      ? `2. load_connector("${domain.connectors[0]}") → loaded tool manifest`
      : "2. (no connectors needed)",
    `3. Execute task using discovered tools`,
    `4. Report outcome`,
  ];

  // Progressive adds tokens for each loaded piece (~800 per playbook, ~600 per connector)
  const loadedTokens =
    estimateTokens(`[playbook: ${domain.playbook} ~800]`) +
    (domain.connectors.length > 0 ? estimateTokens(`[connector: ${domain.connectors[0]} ~600]`) : 0) +
    500; // function loading overhead
  const progressiveTotal = progressiveSystemTokens + bloatedUserTokens + loadedTokens + 1500;

  // ── Comparison ───────────────────────────────────────────────────────────
  const tokenReduction = bloatedTotal > 0
    ? `${Math.round((1 - progressiveTotal / bloatedTotal) * 100)}%`
    : "N/A";
  const toolReduction = `${bloatedTools.length} → ${progressiveTools.length} (${Math.round((1 - progressiveTools.length / bloatedTools.length) * 100)}% fewer)`;
  const costBloated = estimateCost(bloatedTotal);
  const costProgressive = estimateCost(progressiveTotal);
  const costSavings = `${costBloated} → ${costProgressive}`;
  const winner = progressiveTotal < bloatedTotal ? "progressive" : "bloated";
  const winnerReason =
    winner === "progressive"
      ? `Progressive uses ${tokenReduction} fewer system tokens. The agent discovers only what it needs at runtime.`
      : "Bloated mode wins for this query — the domain is well-covered by the pre-loaded connector catalog.";

  const response: SimulationResponse = {
    query,
    bloated: {
      mode: "bloated",
      systemPromptTokens: bloatedSystemTokens,
      systemPromptPreview: bloatedPrompt.slice(0, 300) + "...",
      toolsAvailable: bloatedTools.slice(0, 12),
      toolsCount: bloatedTools.length,
      estimatedTotalTokens: bloatedTotal,
      estimatedCost: costBloated,
      discoveryPath: ["1. System prompt already contains full connector catalog + playbook router + all tools"],
      pathDepth: 1,
      hypotheticalAnswer: `[Bloated mode] Agent would see ${bloatedTools.length} tools immediately. Domain: ${domain.playbook}. It would likely call loadSkill("${domain.playbook}") then execute the SOP directly with pre-loaded tools.`,
      latencyEstimate: "~2-3s (single round-trip with large context)",
    },
    progressive: {
      mode: "progressive",
      systemPromptTokens: progressiveSystemTokens,
      systemPromptPreview: progressivePrompt.slice(0, 300) + "...",
      toolsAvailable: progressiveTools,
      toolsCount: progressiveTools.length,
      estimatedTotalTokens: progressiveTotal,
      estimatedCost: costProgressive,
      discoveryPath,
      pathDepth: 3,
      hypotheticalAnswer: `[Progressive mode] Agent would call load_playbook("${domain.playbook}") → receive SOP → call load_connector("${domain.connectors[0] || "base44-connector"}") → execute using discovered tools. Total path: ${discoveryPath.length} steps.`,
      latencyEstimate: "~4-5s (3 round-trips to load playbook + connector)",
    },
    comparison: {
      tokenReduction,
      toolReduction,
      costSavings,
      winner,
      winnerReason,
    },
  };

  return NextResponse.json(response, {
    status: 200,
    headers: {
      "Cache-Control": "no-cache",
    },
  });
});
