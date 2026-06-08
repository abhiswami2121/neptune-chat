/**
 * app/api/workflow/run/route.ts — Workflow SDK 5 route.
 *
 * PRD ref: Section 3, Layer 2 — Workflow SDK 5 for inline durable flows.
 * Uses @ai-sdk/workflow WorkflowAgent with the same inline tools as the chat route.
 *
 * Accepts: POST { task, params?, model? }
 * Returns: { workflowId, status, messages, steps }
 */

import { WorkflowAgent } from "@ai-sdk/workflow";
import { convertToModelMessages } from "ai";
import { getAvailableTools } from "@/lib/agent/inline-tools";

export const maxDuration = 120;

interface WorkflowRequestBody {
  task: string;
  params?: Record<string, unknown>;
  model?: string;
  maxSteps?: number;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as WorkflowRequestBody;

    if (!body.task || typeof body.task !== "string") {
      return Response.json(
        { error: "task (string) is required" },
        { status: 400 }
      );
    }

    const modelId = body.model ?? "deepseek-v4-pro";
    const maxSteps = Math.min(body.maxSteps ?? 10, 25);

    const tools = getAvailableTools();

    // @ai-sdk/workflow is beta (0.0.0-bf6e4b15) with incompatible
    // provider-utils types vs the stable ai SDK. Cast for runtime compatibility.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agent = new WorkflowAgent({
      model: modelId as any,
      tools: tools as any,
      instructions:
        "You are a workflow agent. Execute the given task using available tools when helpful. " +
        "After completing the task, provide a clear summary of what was done and the results.",
      prepareCall: async ({ instructions }) => ({
        instructions: `TASK TO COMPLETE: ${body.task}\n\n${
          body.params ? `Parameters: ${JSON.stringify(body.params)}\n\n` : ""
        }Follow these steps:\n1. Understand the task\n2. Use tools as needed to gather data\n3. Complete the task\n4. Provide a summary of results\n\n${instructions}`,
      }),
    });

    // Build messages
    const messages = await convertToModelMessages([
      {
        role: "user" as const,
        parts: [{ type: "text" as const, text: body.task }],
      },
    ]);

    const result = await agent.stream({
      messages,
      maxSteps,
      stopWhen: (state) => {
        // Stop when no more tool calls needed
        const lastStep = state.steps.at(-1);
        if (lastStep?.text && !lastStep.toolCalls?.length) {
          return true;
        }
        return false;
      },
    });

    const workflowId = `wf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    return Response.json({
      workflowId,
      status: "completed",
      steps: result.steps.length,
      finalText: result.steps.at(-1)?.text ?? "",
      messages: result.messages.map((m) => ({
        role: m.role,
        content:
          typeof (m as { content?: unknown }).content === "string"
            ? (m as { content: string }).content.slice(0, 500)
            : "[complex content]",
      })),
      toolCalls: result.toolCalls.map((tc) => ({
        toolName: tc.toolName,
        input: tc.input,
      })),
      toolResults: result.toolResults.map((tr) => ({
        toolName: tr.toolName,
        output:
          typeof tr.output === "string"
            ? tr.output.slice(0, 300)
            : "[structured output]",
      })),
    });
  } catch (error) {
    console.error("Workflow error:", error);
    return Response.json(
      {
        workflowId: `wf_error_${Date.now().toString(36)}`,
        status: "failed",
        error:
          error instanceof Error ? error.message : "Unknown workflow error",
      },
      { status: 500 }
    );
  }
}
