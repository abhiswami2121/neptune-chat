/**
 * Neptune Chat — Playbook OS V4 Client
 *
 * Drop-in for PlaybookOS.actionGroups.discover() integration.
 * V4 primary entry: Action Groups discovery via /core/action-groups/ SDK.
 *
 * Architecture:
 *   1. Primary: @playbook-os/sdk (npm package, Vercel-deployed)
 *   2. Fallback: /home/hermes/core/action-groups/ (VPS-local SDK)
 *
 * Installation:
 *   1. pnpm link /home/neptune/playbook-os (dev)
 *   2. Set PLAYBOOK_OS_REPO_PATH=/home/neptune/playbook-os in Vercel env
 */
import type { DiscoveryContext, TaskInput } from '@playbook-os/sdk';

let _playbookOS: any = null;

async function getPlaybookOS(): Promise<any> {
  if (_playbookOS) return _playbookOS;
  try {
    const { PlaybookOS } = await import('@playbook-os/sdk');
    _playbookOS = new PlaybookOS({
      repoPath: process.env.PLAYBOOK_OS_REPO_PATH || '/home/neptune/playbook-os',
      agent: 'neptune-chat',
    });
    return _playbookOS;
  } catch {
    console.warn('[PlaybookOS] SDK not available, using VPS-local action groups fallback');
    return null;
  }
}

/**
 * Discover action group + skills + playbooks for a task.
 * V4: Uses discoverActionGroup() as primary entry point.
 * Falls back to local /core/action-groups/ SDK if @playbook-os/sdk unavailable.
 */
export async function discoverActionGroup(task: TaskInput): Promise<string | null> {
  const pos = await getPlaybookOS();
  if (pos) {
    try {
      // V4 primary entry: Action Group discovery
      if (typeof pos.discoverActionGroup === 'function') {
        const result = await pos.discoverActionGroup({ prompt: task.prompt }, 'newleaf-financial');
        return typeof result === 'string' ? result : result?.context || null;
      }
      // Fallback: V3 discover
      const result = await pos.discover(task, 'neptune-chat');
      return typeof result === 'string' ? result : result?.context || null;
    } catch (err) {
      console.error('[PlaybookOS] Chat discovery failed:', err);
    }
  }

  // VPS-local fallback: use /home/hermes/core/action-groups/ SDK
  try {
    const { pos: localPos } = await import('/home/hermes/core/action-groups/index.js');
    await localPos.actionGroups.discover(task.prompt);
    const { context } = await localPos.actionGroups.discover(task.prompt);
    return context;
  } catch (err) {
    console.error('[PlaybookOS] Local action groups fallback failed:', err);
    return null;
  }
}

/**
 * Record outcome after task completion.
 */
export async function recordOutcome(params: {
  taskId: string;
  success: boolean;
  tokensUsed: number;
  durationMs: number;
}) {
  const pos = await getPlaybookOS();
  if (!pos) return;
  try {
    await pos.recordOutcome({
      task_id: params.taskId,
      success: params.success,
      tokens_used: params.tokensUsed,
      duration_ms: params.durationMs,
    });
  } catch (err) {
    console.error('[PlaybookOS] Chat outcome recording failed:', err);
  }
}

/**
 * Get session-persistent context for injection before prompts.
 */
export function getContextInjection(sessionId: string): string | null {
  if (!_playbookOS) return null;
  try {
    return _playbookOS.getContextInjection(sessionId);
  } catch {
    return null;
  }
}
