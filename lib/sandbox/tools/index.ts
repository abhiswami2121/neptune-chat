export { runScriptTool } from './runScript';
export { scrapeURLTool } from './scrapeURL';
export { processDataTool } from './processData';
export { runWorkflowTool } from './runWorkflow';
export { spawnPersistentSessionTool } from './spawnPersistentSession';
export { spawnCodingAgent } from '@/lib/ai/tools/spawn-coding-agent';

import { runScriptTool } from './runScript';
import { scrapeURLTool } from './scrapeURL';
import { processDataTool } from './processData';
import { runWorkflowTool } from './runWorkflow';
import { spawnPersistentSessionTool } from './spawnPersistentSession';
import { spawnCodingAgent } from '@/lib/ai/tools/spawn-coding-agent';

export const sandboxTools = {
  runScript: runScriptTool,
  scrapeURL: scrapeURLTool,
  processData: processDataTool,
  runWorkflow: runWorkflowTool,
  spawnPersistentSession: spawnPersistentSessionTool,
  spawnCodingAgent,
};

export type SandboxToolName = keyof typeof sandboxTools;
