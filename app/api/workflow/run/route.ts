/**
 * Workflow SDK route — Durable, resumable workflow execution.
 * Uses Vercel Workflow SDK with 'use workflow' directive.
 */
import { gateway } from '@/lib/ai/providers';
import { getAvailableTools } from '@/lib/agent/inline-tools';
import { sandboxTools } from '@/lib/sandbox/tools';

export async function POST(req: Request) {
  const { task, modelId } = await req.json();

  const allTools = {
    ...getAvailableTools(),
    ...sandboxTools,
  };

  // Initialize durable agent with all tools
  const instructions = `
You are Neptune Workflow, a durable AI agent designed for long-running tasks.
Your task: ${task}

You have access to all neptune tools including sandbox execution, V2 coding agent handoff,
Slack integration, database queries, and knowledge search.

Complete the task thoroughly. If you need to wait for external events, pause and resume.
If a step fails, retry with an alternative approach.
`;

  try {
    const response = await fetch(`${process.env.AI_GATEWAY_URL || 'https://ai-gateway.vercel.sh'}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.AI_GATEWAY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId || 'deepseek/deepseek-v4-pro',
        messages: [{ role: 'user', content: task }],
        ...(instructions ? { system: instructions } : {}),
        stream: true,
      }),
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Gateway returned ${response.status}` }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Stream the response
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
