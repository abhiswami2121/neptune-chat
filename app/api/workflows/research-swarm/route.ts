/**
 * /api/workflows/research-swarm — Research swarm workflow (Phase 6)
 *
 * Thin wrapper around parallel-agents fan-out pattern.
 * 3 research agents (Analyst, Skeptic, Synthesizer) attack a topic in parallel.
 * Reducer: vote (consensus synthesis).
 *
 * POST { prompt: "Research topic X" }
 * → SSE stream
 */

import { getLanguageModel } from "@/lib/ai/providers";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { requireAllowlist } from "@/lib/auth/require-allowlist";

export const maxDuration = 300;

const RESEARCH_PERSONAS = [
  "You are a Research Analyst. Systematically explore the topic: gather facts, cite sources, organize findings by theme. Be exhaustive and evidence-based. Structure your response with clear sections.",
  "You are a Research Skeptic. Challenge every claim. What evidence is missing? What are the counterarguments? What are the failure modes or risks? Identify gaps in the prevailing narrative.",
  "You are a Research Synthesizer. Combine and reconcile the best insights. Find connections between disparate findings. Produce a clear, narrative-driven synthesis that a non-expert can understand.",
];

async function reduceVote(texts: string[], task: string, modelId: string): Promise<string> {
  const model = getLanguageModel(modelId || DEFAULT_CHAT_MODEL);
  const formatted = texts.map((t, i) => `### Agent ${i + 1}\n${t.slice(0, 2500)}`).join("\n\n");
  const { streamText } = await import("ai");
  const result = streamText({
    model,
    system: "You are a consensus synthesizer. Combine multiple research perspectives into one coherent report. Highlight agreements, note disagreements, and produce a unified conclusion.",
    messages: [{ role: "user", content: `TOPIC: ${task}\n\nRESEARCH:\n${formatted}\n\nSynthesize into one report.` }],
    temperature: 0.3,
    maxOutputTokens: 4096,
  });
  let full = "";
  for await (const chunk of result.textStream) full += chunk;
  return `# Research Synthesis: ${task}\n\n${full.trim()}`;
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
        send({ type: "meta", workflow: "research-swarm", fanout: 3, timestamp: Date.now() });
        send({ type: "status", status: "researching", timestamp: Date.now() });

        const { streamText } = await import("ai");
        const tasks = RESEARCH_PERSONAS.map(async (persona, i) => {
          try {
            send({ type: "agent-start", agentIndex: i, timestamp: Date.now() });
            const r = streamText({ model, system: persona, messages: [{ role: "user" as const, content: prompt }], temperature: 0.7, maxOutputTokens: 4096 });
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

        send({ type: "status", status: "synthesizing", timestamp: Date.now() });
        const output = await reduceVote(results, prompt, DEFAULT_CHAT_MODEL);
        send({ type: "result", output, timestamp: Date.now() });
        send({ type: "done", timestamp: Date.now() });
        controller.close();
      } catch (e) { send({ type: "error", error: String(e) }); controller.close(); }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
});
