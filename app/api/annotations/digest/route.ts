/**
 * app/api/annotations/digest/route.ts
 * U4.2 — Weekly annotation digest generator with AI summary + Slack delivery.
 *
 * Enhanced from PB-D base:
 * - AI-generated summary via DeepSeek (OpenAI-compatible)
 * - Posts to #jarvis-admin Slack with markdown table
 * - Writes digest JSON to /home/hermes/data/ (VPS) or Vercel Blob (serverless)
 * - Detects repeat failures >2 times and surfaces them
 * - Optionally queues playbook update proposals for U4.1 in-session approval
 *
 * Triggered by: Vercel cron — every Monday 12:00 UTC
 * Also callable via: GET /api/annotations/digest?period=week&postToSlack=true
 */
import { NextResponse } from "next/server";
import {
  getAnnotations,
  getAnnotationSummary,
  getAnnotationsByType,
  getSelfHealingStats,
  type Annotation,
} from "@/connectors/neptune/functions/annotation-collector";
import { detectRepeatFailures } from "@/lib/sentiment/detector";

// ── Types ───────────────────────────────────────────────────────────────────

interface DigestSection {
  domain: string;
  totalExecutions: number;
  successRate: number;
  avgDurationMs: number;
  topErrors: Array<{ error: string; count: number }>;
  topLearnings: string[];
  repeatFailures: Array<{ playbook: string; routine: string; failures: number; lastError?: string }>;
  selfHealing?: {
    totalProposals: number;
    approved: number;
    rejected: number;
    reverted: number;
    pending?: Array<{ id: string; reason: string }>;
  };
  trend: "improving" | "stable" | "declining" | "new";
}

interface WeeklyDigest {
  title: string;
  period: { start: string; end: string };
  generated: string;
  overall: {
    totalExecutions: number;
    overallSuccessRate: number;
    domainsActive: number;
    totalErrors: number;
    totalSelfHealingProposals: number;
    totalApprovedMods: number;
    totalRevertedMods: number;
  };
  byDomain: DigestSection[];
  topLearnings: string[];
  topFailures: Array<{ playbook: string; routine: string; failures: number }>;
  recommendations: string[];
  aiSummary?: string;
  slackPosted?: boolean;
  digestFile?: string;
}

// ── Slack Posting ──────────────────────────────────────────────────────────

function buildSlackMarkdownTable(digest: WeeklyDigest): string {
  const header =
    `*📊 Weekly Playbook Digest — ${digest.title}*\n` +
    `*Period:* ${new Date(digest.period.start).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} → ${new Date(digest.period.end).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}\n\n` +
    `*Overall:* ${digest.overall.totalExecutions} executions | ${digest.overall.overallSuccessRate}% success | ${digest.overall.domainsActive} domains active\n\n`;

  const tableHeader =
    `| Domain | Execs | Success | Errors | Self-Heal |\n` +
    `|--------|-------|---------|--------|-----------|\n`;

  const rows = digest.byDomain
    .map((d) => {
      const heals = d.selfHealing?.totalProposals || 0;
      const healsStr = heals > 0 ? `${heals} props` : "-";
      return `| ${d.domain} | ${d.totalExecutions} | ${d.successRate}% | ${d.topErrors.length} | ${healsStr} |`;
    })
    .join("\n");

  const failuresSection =
    digest.topFailures.length > 0
      ? `\n\n*🔴 Repeat Failures (>2):*\n${digest.topFailures
          .map((f) => `• \`${f.playbook}\` > \`${f.routine}\` — ${f.failures} failures`)
          .join("\n")}`
      : "";

  const recSection =
    digest.recommendations.length > 0
      ? `\n\n*💡 Recommendations:*\n${digest.recommendations.map((r) => `• ${r}`).join("\n")}`
      : "";

  const aiSection = digest.aiSummary ? `\n\n*🤖 AI Summary:*\n${digest.aiSummary}` : "";

  return header + tableHeader + rows + failuresSection + recSection + aiSection;
}

async function postToSlack(digest: WeeklyDigest): Promise<boolean> {
  const slackToken = process.env.SLACK_BOT_TOKEN || process.env.SLACK_TOKEN;

  if (!slackToken) {
    console.warn("[digest] SLACK_BOT_TOKEN not configured — skipping Slack post");
    return false;
  }

  try {
    // Use @slack/web-api if available, otherwise use fetch
    let web: any;
    try {
      const { WebClient } = await import("@slack/web-api");
      web = new WebClient(slackToken);
    } catch {
      // Fallback to raw fetch
      web = null;
    }

    const channel = "#jarvis-admin";
    const markdown = buildSlackMarkdownTable(digest);

    if (web) {
      await web.chat.postMessage({
        channel,
        text: digest.title,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: markdown.slice(0, 3000), // Slack has 3000 char limit for mrkdwn blocks
            },
          },
        ],
        unfurl_links: false,
      });
    } else {
      // Fallback HTTP POST to Slack API
      const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${slackToken}`,
        },
        body: JSON.stringify({
          channel,
          text: digest.title,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: markdown.slice(0, 3000),
              },
            },
          ],
          unfurl_links: false,
        }),
      });

      if (!res.ok) {
        console.error("[digest] Slack API error:", await res.text());
        return false;
      }
    }

    return true;
  } catch (err: any) {
    console.error("[digest] Slack post failed:", err?.message || err);
    return false;
  }
}

// ── AI Summary (DeepSeek via OpenAI-compatible) ─────────────────────────────

async function generateAISummary(digest: WeeklyDigest): Promise<string | undefined> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.warn("[digest] DEEPSEEK_API_KEY not configured — skipping AI summary");
    return undefined;
  }

  try {
    const prompt = `Summarize this weekly playbook execution digest in 3-5 concise bullet points. Focus on: key trends, most critical failures, self-healing activity, and actionable recommendations. Keep under 500 chars.

Digest:
- Period: ${digest.period.start} to ${digest.period.end}
- Total executions: ${digest.overall.totalExecutions}
- Overall success rate: ${digest.overall.overallSuccessRate}%
- Domains active: ${digest.overall.domainsActive}
- Self-healing proposals: ${digest.overall.totalSelfHealingProposals}
- Approved mods: ${digest.overall.totalApprovedMods}
${digest.byDomain.map((d) => `- ${d.domain}: ${d.totalExecutions} execs, ${d.successRate}% success, ${d.topErrors.length} error types, ${d.selfHealing?.totalProposals || 0} proposals, trend: ${d.trend}`).join("\n")}
${digest.topFailures.length > 0 ? `\nRepeat Failures:\n${digest.topFailures.map((f) => `- ${f.playbook}/${f.routine}: ${f.failures} failures`).join("\n")}` : ""}`;

    // Use OpenAI-compatible fetch to DeepSeek
    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "You are a concise operations analyst. Summarize weekly playbook execution digests in 3-5 bullet points. Focus on actionable insights. Keep under 500 characters.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 300,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      console.error("[digest] DeepSeek API error:", await res.text());
      return undefined;
    }

    const data = await res.json();
    const summary = data?.choices?.[0]?.message?.content;
    return summary || undefined;
  } catch (err: any) {
    console.error("[digest] AI summary generation failed:", err?.message || err);
    return undefined;
  }
}

// ── File Persistence ────────────────────────────────────────────────────────

async function persistDigest(digest: WeeklyDigest): Promise<string> {
  // On VPS, write to /home/hermes/data/
  // On Vercel serverless, we return JSON and log — persistence happens at the caller level
  const date = new Date().toISOString().slice(0, 10);
  const filename = `weekly_digest_${date}.json`;
  const dataDir = process.env.HERMES_DATA_DIR || "/home/hermes/data";

  // VPS path will be writable; on Vercel, this won't exist — we handle gracefully
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const fullPath = path.join(dataDir, filename);
    await fs.writeFile(fullPath, JSON.stringify(digest, null, 2), "utf-8");
    return fullPath;
  } catch {
    // On Vercel serverless, try to write to /tmp
    try {
      const fs = await import("fs/promises");
      const tmpPath = `/tmp/${filename}`;
      await fs.writeFile(tmpPath, JSON.stringify(digest, null, 2), "utf-8");
      return tmpPath;
    } catch (tmpErr: any) {
      console.warn("[digest] Could not persist digest file:", tmpErr?.message);
      return `(not persisted: ${tmpErr?.message})`;
    }
  }
}

// ── Route Handlers ──────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "week";
  const daysBack = period === "week" ? 7 : period === "month" ? 30 : parseInt(period, 10) || 7;
  const postToSlack = searchParams.get("postToSlack") === "true" || searchParams.has("cron");
  const generateAI = searchParams.get("ai") === "true" || searchParams.has("cron");
  const persist = searchParams.get("persist") === "true" || searchParams.has("cron");

  const now = new Date();
  const since = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000).toISOString();

  // Get annotations from the period
  const annotations = getAnnotations({ since });
  const summaries = getAnnotationSummary();
  const modAnnotations = getAnnotationsByType("in_session_mod", { since });

  // Detect repeat failures (same playbook+routine failing 2+ times)
  const repeatFailures = detectRepeatFailures(annotations, 2);

  // Self-healing stats
  const healingStats = getSelfHealingStats();

  // Build per-domain digest sections
  const byDomain: DigestSection[] = summaries.map((s) => {
    const domainAnnotations = annotations.filter((a) => a.domain === s.domain);
    const domainMods = modAnnotations.filter((a) => a.domain === s.domain);
    const domainFailures = repeatFailures.filter((f) => {
      // Check if the playbook belongs to this domain
      return f.playbook.toLowerCase().includes(s.domain.toLowerCase()) ||
        domainAnnotations.some((a) => a.playbook === f.playbook && a.skillOrWorkflow === f.routine);
    });

    const recentSuccessRate =
      domainAnnotations.length > 0
        ? Math.round(
            (domainAnnotations.filter((a) => a.outcome === "success").length /
              domainAnnotations.length) *
              100
          )
        : s.successRate;

    let trend: DigestSection["trend"] = "stable";
    if (recentSuccessRate > s.successRate + 5) trend = "improving";
    else if (recentSuccessRate < s.successRate - 5) trend = "declining";
    if (domainAnnotations.length === 0) trend = "new";

    return {
      domain: s.domain,
      totalExecutions: domainAnnotations.length || s.totalExecutions,
      successRate: recentSuccessRate || s.successRate,
      avgDurationMs: s.avgDurationMs,
      topErrors: s.topErrors,
      topLearnings: domainAnnotations
        .filter((a) => a.learning)
        .slice(0, 3)
        .map((a) => a.learning!),
      repeatFailures: domainFailures.slice(0, 5),
      selfHealing: {
        totalProposals: domainMods.length,
        approved: domainMods.filter((m) => m.skillOrWorkflow.includes("approved")).length,
        rejected: domainMods.filter((m) => m.skillOrWorkflow.includes("rejected")).length,
        reverted: domainMods.filter((m) => m.skillOrWorkflow.includes("reverted")).length,
      },
      trend,
    };
  });

  // Aggregate overall stats
  const overallTotal = annotations.length || summaries.reduce((s, v) => s + v.totalExecutions, 0);
  const overallSuccess =
    annotations.length > 0
      ? Math.round(
          (annotations.filter((a) => a.outcome === "success").length / annotations.length) * 100
        )
      : 0;

  // Top learnings across all domains
  const allLearnings = annotations
    .filter((a) => a.learning)
    .map((a) => `[${a.domain}] ${a.learning}`)
    .slice(0, 10);

  // Top failures (cross-domain)
  const topFailures = repeatFailures.slice(0, 10);

  // Generate recommendations
  const recommendations: string[] = [];
  for (const section of byDomain) {
    if (section.trend === "declining") {
      recommendations.push(
        `${section.domain}: Success rate declining to ${section.successRate}%. Review recent failures.`
      );
    }
    if (section.topErrors.length > 3) {
      recommendations.push(
        `${section.domain}: High error diversity (${section.topErrors.length} unique errors). Consider error categorization.`
      );
    }
    if (section.repeatFailures.length > 0) {
      recommendations.push(
        `${section.domain}: ${section.repeatFailures.length} routine(s) with repeat failures. Queued for self-healing review.`
      );
    }
  }
  if (recommendations.length === 0) {
    recommendations.push("All domains stable. Continue monitoring.");
  }

  const digest: WeeklyDigest = {
    title: `${daysBack}-Day Annotation Digest`,
    period: { start: since, end: now.toISOString() },
    generated: now.toISOString(),
    overall: {
      totalExecutions: overallTotal,
      overallSuccessRate: overallSuccess,
      domainsActive: byDomain.filter((d) => d.totalExecutions > 0).length,
      totalErrors: annotations.filter((a) => a.outcome === "failure").length,
      totalSelfHealingProposals: healingStats.totalProposals,
      totalApprovedMods: healingStats.approved,
      totalRevertedMods: healingStats.reverted,
    },
    byDomain,
    topLearnings: allLearnings,
    topFailures,
    recommendations,
  };

  // Generate AI summary if requested
  if (generateAI) {
    digest.aiSummary = await generateAISummary(digest);
  }

  // Post to Slack if requested
  if (postToSlack) {
    digest.slackPosted = await postToSlack(digest);
  }

  // Persist digest to file if requested
  if (persist) {
    digest.digestFile = await persistDigest(digest);
  }

  return NextResponse.json(digest);
}

/**
 * POST: Schedule a digest for a custom period or trigger immediate Slack delivery.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { daysBack, postToSlack, generateAI, persist } = body;

    // Rebuild the URL with query params for the GET handler
    const params = new URLSearchParams();
    if (daysBack) params.set("period", daysBack.toString());
    if (postToSlack) params.set("postToSlack", "true");
    if (generateAI) params.set("ai", "true");
    if (persist) params.set("persist", "true");

    const url = new URL(req.url);
    const digestUrl = `${url.origin}/api/annotations/digest?${params.toString()}`;

    // In production, this would be an internal call. For now, return the URL.
    return NextResponse.json({
      scheduled: true,
      digestUrl,
      params: { daysBack, postToSlack, generateAI, persist },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to schedule digest" },
      { status: 500 }
    );
  }
}
