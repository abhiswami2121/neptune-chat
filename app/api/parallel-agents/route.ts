/**
 * /api/parallel-agents — Multi-Agent Orchestration (Phase 6)
 *
 * Fan-out 1-5 parallel AI subagents, each streaming independently,
 * then reduce results via concat | vote | best.
 *
 * POST { task, fanout?, reducer?, modelId?, systemPrompt?, subagentPersonas? }
 * → SSE stream of agent-start / agent-chunk / agent-done / reduce / result / error
 *
 * Architecture: Promise.all(streamText(...)) for concurrent fan-out.
 * Each subagent gets a unique persona slant for output diversity.
 */

import { getLanguageModel } from "@/lib/ai/providers";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { requireAllowlist } from "@/lib/auth/require-allowlist";

export const maxDuration = 300; // 5 min max for parallel agents

// ── Constants ──────────────────────────────────────────────────────────────

const MAX_FANOUT = 5;
const MIN_FANOUT = 1;

type ReducerMode = "concat" | "vote" | "best";

interface SubagentConfig {
  index: number;
  persona: string;
  systemPrompt: string;
}

interface ParallelAgentsRequest {
  task: string;
  fanout?: number;
  reducer?: ReducerMode;
  modelId?: string;
  systemPrompt?: string;
  subagentPersonas?: string[]; // optional custom personas per agent
}

// ── Default personas for diverse parallel outputs ──────────────────────────

const DEFAULT_PERSONAS = [
  "You are Agent Alpha — pragmatic and action-oriented. Focus on concrete steps, specific tools, and measurable outcomes. Be direct and concise.",
  "You are Agent Beta — analytical and thorough. Examine edge cases, trade-offs, and hidden assumptions. Provide structured analysis with pros/cons.",
  "You are Agent Gamma — creative and divergent. Explore unconventional approaches, novel combinations, and outside-the-box solutions. Challenge assumptions.",
  "You are Agent Delta — risk-aware and defensive. Identify failure modes, security concerns, scalability bottlenecks, and what could go wrong. Be the skeptic.",
  "You are Agent Epsilon — synthesizer and communicator. Focus on clarity, narrative structure, and making complex ideas accessible. Write for human consumption.",
];

// ── Reducer: Concat ────────────────────────────────────────────────────────

function reduceConcat(results: string[], task: string): string {
  const parts = results.map((r, i) => {
    const name = DEFAULT_PERSONAS[i]?.split("—")[0]?.replace("You are ", "").trim() || `Agent ${i + 1}`;
    return `## ${name}\n\n${r.trim()}`;
  });
  return `# Multi-Agent Analysis: ${task.slice(0, 80)}${task.length > 80 ? "..." : ""}\n\n${parts.join("\n\n---\n\n")}`;
}

// ── Reducer: Vote ──────────────────────────────────────────────────────────

async function reduceVote(
  results: string[],
  task: string,
  modelId: string,
): Promise<string> {
  if (results.length === 1) return `# Consensus: ${task}\n\n${results[0]}`;

  const model = getLanguageModel(modelId || DEFAULT_CHAT_MODEL);

  const formattedResults = results
    .map((r, i) => `### Agent ${i + 1}\n${r.slice(0, 2000)}`)
    .join("\n\n");

  const { streamText } = await import("ai");

  const result = streamText({
    model,
    system:
      "You are a consensus synthesizer. Review multiple AI agent outputs for the same task. Identify agreements, disagreements, and produce a unified consensus that: (1) states where all agents agree, (2) notes key disagreements and why, (3) recommends the best combined approach. Be fair and evidence-based.",
    messages: [
      {
        role: "user",
        content: `TASK: ${task}\n\nAGENT OUTPUTS:\n${formattedResults}\n\nProduce a consensus synthesis.`,
      },
    ],
    temperature: 0.3,
    maxOutputTokens: 4096,
  });

  let full = "";
  for await (const chunk of result.textStream) {
    full += chunk;
  }
  return `# Consensus Synthesis\n\n${full.trim()}`;
}

// ── Reducer: Best ──────────────────────────────────────────────────────────

async function reduceBest(
  results: string[],
  task: string,
  modelId: string,
): Promise<string> {
  if (results.length === 1) return results[0];

  const model = getLanguageModel(modelId || DEFAULT_CHAT_MODEL);

  const formattedResults = results
    .map((r, i) => `### Option ${i + 1}\n${r.slice(0, 2000)}`)
    .join("\n\n");

  const { streamText } = await import("ai");

  const result = streamText({
    model,
    system:
      "You are an evaluator. Review multiple AI outputs for the same task. Pick the SINGLE best one based on: accuracy, completeness, clarity, actionability. Explain your choice in 2-3 sentences, then present the chosen output verbatim. Start with 'CHOSEN: Option N' then a blank line then the full output.",
    messages: [
      {
        role: "user",
        content: `TASK: ${task}\n\nOPTIONS:\n${formattedResults}\n\nPick the single best option.`,
      },
    ],
    temperature: 0.2,
    maxOutputTokens: 4096,
  });

  let full = "";
  for await (const chunk of result.textStream) {
    full += chunk;
  }
  return full.trim();
}

// ── Build subagent configs ─────────────────────────────────────────────────

function buildSubagentConfigs(
  fanout: number,
  systemPrompt: string,
  customPersonas?: string[],
): SubagentConfig[] {
  const configs: SubagentConfig[] = [];
  for (let i = 0; i < fanout; i++) {
    const persona =
      customPersonas?.[i] || DEFAULT_PERSONAS[i] || DEFAULT_PERSONAS[0];
    configs.push({
      index: i,
      persona,
      systemPrompt: `${systemPrompt}\n\n${persona}`,
    });
  }
  return configs;
}

// ── Route Handler ──────────────────────────────────────────────────────────

export const POST = requireAllowlist(async (req: Request) => {
  const body = (await req.json().catch(() => ({}))) as ParallelAgentsRequest;
  const {
    task,
    fanout = 2,
    reducer = "concat",
    modelId,
    systemPrompt = "",
    subagentPersonas,
  } = body;

  // Validate
  if (!task || typeof task !== "string" || !task.trim()) {
    return new Response(
      JSON.stringify({ error: "Missing required field: task (string)" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const safeFanout = Math.min(Math.max(fanout, MIN_FANOUT), MAX_FANOUT);
  const safeReducer: ReducerMode = ["concat", "vote", "best"].includes(reducer)
    ? reducer
    : "concat";

  const subagents = buildSubagentConfigs(
    safeFanout,
    systemPrompt || `You are a specialized AI agent. Complete this task thoroughly and accurately.`,
    subagentPersonas,
  );

  const model = getLanguageModel(modelId || DEFAULT_CHAT_MODEL);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        send({
          type: "meta",
          fanout: safeFanout,
          reducer: safeReducer,
          task: task.slice(0, 200),
          modelId: modelId || DEFAULT_CHAT_MODEL,
          timestamp: Date.now(),
        });

        // ── Phase 1: Fan-out parallel agents ────────────────────────────
        send({ type: "status", status: "fanning-out", agentCount: safeFanout, timestamp: Date.now() });

        const agentResults: { index: number; text: string; error?: string }[] = [];

        const { streamText } = await import("ai");

        const agentPromises = subagents.map(async (agent) => {
          try {
            send({
              type: "agent-start",
              agentIndex: agent.index,
              persona: agent.persona.slice(0, 120),
              timestamp: Date.now(),
            });

            const result = streamText({
              model,
              system: agent.systemPrompt,
              messages: [{ role: "user" as const, content: task }],
              temperature: 0.7, // higher temp for diversity across agents
              maxOutputTokens: 4096,
            });

            let fullText = "";
            for await (const chunk of result.textStream) {
              fullText += chunk;
              send({
                type: "agent-chunk",
                agentIndex: agent.index,
                data: chunk,
                timestamp: Date.now(),
              });
            }

            send({
              type: "agent-done",
              agentIndex: agent.index,
              textLength: fullText.length,
              preview: fullText.slice(0, 200),
              timestamp: Date.now(),
            });

            return { index: agent.index, text: fullText };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            send({
              type: "agent-error",
              agentIndex: agent.index,
              error: message,
              timestamp: Date.now(),
            });
            return { index: agent.index, text: "", error: message };
          }
        });

        const results = await Promise.all(agentPromises);
        agentResults.push(...results);

        // Check: did we get at least one successful result?
        const successResults = agentResults.filter((r) => !r.error && r.text.trim());
        if (successResults.length === 0) {
          send({
            type: "error",
            error: "All parallel agents failed",
            agentErrors: agentResults.filter((r) => r.error).map((r) => ({ index: r.index, error: r.error })),
            timestamp: Date.now(),
          });
          controller.close();
          return;
        }

        // ── Phase 2: Reduce ────────────────────────────────────────────
        send({
          type: "status",
          status: "reducing",
          reducer: safeReducer,
          successCount: successResults.length,
          totalCount: agentResults.length,
          timestamp: Date.now(),
        });

        let finalOutput: string;
        const texts = successResults.map((r) => r.text);

        switch (safeReducer) {
          case "vote":
            finalOutput = await reduceVote(texts, task, modelId || DEFAULT_CHAT_MODEL);
            break;
          case "best":
            finalOutput = await reduceBest(texts, task, modelId || DEFAULT_CHAT_MODEL);
            break;
          case "concat":
          default:
            finalOutput = reduceConcat(texts, task);
            break;
        }

        send({
          type: "result",
          reducer: safeReducer,
          output: finalOutput,
          agentCount: successResults.length,
          totalCount: agentResults.length,
          agentPreview: successResults.map((r, i) => ({
            idx: i,
            length: r.text.length,
            start: r.text.slice(0, 100),
          })),
          timestamp: Date.now(),
        });

        send({ type: "done", timestamp: Date.now() });
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        send({ type: "error", error: message, timestamp: Date.now() });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
