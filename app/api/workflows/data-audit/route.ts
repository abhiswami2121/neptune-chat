/**
 * /api/workflows/data-audit — Data integrity audit workflow (Phase 6)
 *
 * Thin wrapper around parallel-agents fan-out pattern.
 * 2 agents (Completeness Checker, Anomaly Detector) audit data in parallel.
 * Reducer: vote (weighted consensus).
 *
 * POST { prompt: "Audit customer records for duplicates" }
 * → SSE stream
 */

import { getLanguageModel } from "@/lib/ai/providers";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { requireAllowlist } from "@/lib/auth/require-allowlist";

export const maxDuration = 300;

const AUDIT_PERSONAS = [
  "You are a Data Completeness Auditor. Check for: missing required fields, null values where data is expected, inconsistent formats (dates, phones, emails), truncated values, and orphaned references. Produce a severity-ranked finding list with specific record counts and examples.",
  "You are a Data Anomaly Detector. Check for: statistical outliers, unusual value distributions, impossible combinations (e.g., negative amounts, future dates for past events), duplicate records, and pattern breaks. Flag anomalies with confidence levels and recommended investigation priority.",
];

async function reduceAudit(texts: string[], task: string, modelId: string): Promise<string> {
  const model = getLanguageModel(modelId || DEFAULT_CHAT_MODEL);
  const formatted = texts.map((t, i) => `### Auditor ${i + 1}\n${t.slice(0, 2500)}`).join("\n\n");
  const { streamText } = await import("ai");
  const result = streamText({
    model,
    system: "You are a Data Quality Lead. Merge two audit reports into one prioritized action plan. Group findings as CRITICAL/HIGH/MEDIUM/LOW. For each finding, state the evidence, impact, and remediation. Consolidate duplicates.",
    messages: [{ role: "user", content: `AUDIT SCOPE: ${task}\n\nFINDINGS:\n${formatted}\n\nProduce a consolidated audit report.` }],
    temperature: 0.2,
    maxOutputTokens: 4096,
  });
  let full = "";
  for await (const chunk of result.textStream) full += chunk;
  return `# Data Audit Report: ${task}\n\n${full.trim()}`;
}

export const POST = requireAllowlist(async (req: Request) => {
  const { prompt } = (await req.json().catch(() => ({}))) as { prompt?: string };
  if (!prompt) return new Response(JSON.stringify({ error: "Missing prompt" }), { status: 400, headers: { "Content-Type": "application/json" } });

  const model = getLanguageModel(DEFAULT_CHAT_MODEL);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (d: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(d)}\n\n`));
      try {
        send({ type: "meta", workflow: "data-audit", fanout: 2, timestamp: Date.now() });
        send({ type: "status", status: "auditing", timestamp: Date.now() });

        const { streamText } = await import("ai");
        const tasks = AUDIT_PERSONAS.map(async (persona, i) => {
          try {
            send({ type: "agent-start", agentIndex: i, timestamp: Date.now() });
            const r = streamText({ model, system: persona, messages: [{ role: "user" as const, content: prompt }], temperature: 0.4, maxOutputTokens: 4096 });
            let text = "";
            for await (const c of r.textStream) { text += c; send({ type: "agent-chunk", agentIndex: i, data: c, timestamp: Date.now() }); }
            send({ type: "agent-done", agentIndex: i, length: text.length, timestamp: Date.now() });
            return text;
          } catch (e) {
            send({ type: "agent-error", agentIndex: i, error: String(e), timestamp: Date.now() });
            return "";
          }
        });

        const results = (await Promise.all(tasks)).filter(Boolean);
        if (!results.length) { send({ type: "error", error: "All agents failed" }); controller.close(); return; }

        send({ type: "status", status: "consolidating", timestamp: Date.now() });
        const output = await reduceAudit(results, prompt, DEFAULT_CHAT_MODEL);
        send({ type: "result", output, timestamp: Date.now() });
        send({ type: "done", timestamp: Date.now() });
        controller.close();
      } catch (e) { send({ type: "error", error: String(e) }); controller.close(); }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
});
