/**
 * Sandbox Run Artifact — Server Component
 * Fetches sandbox run state and renders Terminal + FileTree.
 */
import { SandboxRunClient } from './client';

interface SandboxRunServerProps {
  runId: string;
  toolName: string;
  runtime: string;
  userId: string;
  streamUrl: string;
}

export async function SandboxRunServer({
  runId,
  toolName,
  runtime,
  userId,
  streamUrl,
}: SandboxRunServerProps) {
  return (
    <div className="sandbox-run-artifact border rounded-lg overflow-hidden bg-gray-950">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-mono text-gray-300">{toolName}</span>
          <span className="text-xs text-gray-500">{runtime}</span>
        </div>
        <span className="text-xs text-gray-600 font-mono">run_{runId}</span>
      </div>
      <SandboxRunClient
        runId={runId}
        toolName={toolName}
        streamUrl={streamUrl}
        userId={userId}
      />
    </div>
  );
}
