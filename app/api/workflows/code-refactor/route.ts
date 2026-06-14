/**
 * /api/workflows/code-refactor — Code refactoring workflow (Phase 6)
 *
 * Thin wrapper around parallel-agents fan-out pattern.
 * 2 agents (Pattern Matcher, Risk Auditor) analyze code in parallel.
 * Reducer: concat (side-by-side analysis).
 *
 * POST { prompt: "Refactor the auth module to..." }
 * → SSE stream
 */

import { getLanguageModel } from "@/lib/ai/providers";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { requireAllowlist } from "@/lib/auth/require-allowlist";

export const maxDuration = 300;

const REFACTOR_PERSONAS = [
  "You are a Code Pattern Matcher. When refactoring, identify existing patterns in the codebase, suggest improvements that align with the project's conventions, and provide concrete before/after code examples. Focus on: consistency, readability, and adherence to the project's established patterns.",
  "You are a Code Risk Auditor. When refactoring, identify what could break: API contracts, type changes, side effects, performance regressions, and test coverage gaps. Flag every risk with severity (P0/P1/P2). Suggest safe refactoring that minimizes blast radius.",
];

function reduceRefactor(texts: string[]): string {
  return [
    "# Code Refactoring Analysis",
    "",
    "## Pattern & Consistency Analysis",
    texts[0] || "(No output)",
    "",
    "---",
    "",
    "## Risk & Safety Audit",
    texts[1] || "(No output)",
    "",
    "---",
    "",
    "## Recommended Approach",
    "Review both analyses above. Execute changes only after addressing flagged risks.",
  ].join("\n");
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
        send({ type: "meta", workflow: "code-refactor", fanout: 2, timestamp: Date.now() });
        send({ type: "status", status: "analyzing", timestamp: Date.now() });

        const { streamText } = await import("ai");
        const tasks = REFACTOR_PERSONAS.map(async (persona, i) => {
          try {
            send({ type: "agent-start", agentIndex: i, timestamp: Date.now() });
            const r = streamText({ model, system: persona, messages: [{ role: "user" as const, content: prompt }], temperature: 0.5, maxOutputTokens: 4096 });
            let text = "";
            for await (const c of r.textStream) { text += c; send({ type: "agent-chunk", agentIndex: i, data: c, timestamp: Date.now() }); }
            send({ type: "agent-done", agentIndex: i, length: text.length, timestamp: Date.now() });
            return text;
          } catch (e) {
            send({ type: "agent-error", agentIndex: i, error: String(e), timestamp: Date.now() });
            return "";
          }
        });

        const results = await Promise.all(tasks);
        if (!results.filter(Boolean).length) { send({ type: "error", error: "All agents failed" }); controller.close(); return; }

        send({ type: "status", status: "combining", timestamp: Date.now() });
        const output = reduceRefactor(results);
        send({ type: "result", output, timestamp: Date.now() });
        send({ type: "done", timestamp: Date.now() });
        controller.close();
      } catch (e) { send({ type: "error", error: String(e) }); controller.close(); }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
});
