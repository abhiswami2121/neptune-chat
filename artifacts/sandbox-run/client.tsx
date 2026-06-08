/**
 * Sandbox Run Artifact — Client Component
 * Terminal output viewer with SSE streaming, run stats, and controls.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { Terminal, XCircle, CheckCircle, Clock, Copy, Download } from 'lucide-react';

interface SandboxRunClientProps {
  runId: string;
  toolName: string;
  streamUrl: string;
  userId: string;
}

interface StreamEvent {
  type: 'status' | 'stdout' | 'stderr' | 'done' | 'error' | 'destroyed';
  data?: string;
  runId?: string;
  status?: string;
  durationMs?: number;
  stderr?: string;
}

export function SandboxRunClient({ runId, toolName, streamUrl, userId }: SandboxRunClientProps) {
  const [output, setOutput] = useState<string[]>([]);
  const [status, setStatus] = useState<string>('connecting');
  const [duration, setDuration] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const startTime = useRef<number>(Date.now());

  useEffect(() => {
    const es = new EventSource(streamUrl);

    es.onmessage = (event) => {
      try {
        const evt: StreamEvent = JSON.parse(event.data);

        switch (evt.type) {
          case 'status':
            setStatus(evt.status || 'running');
            break;
          case 'stdout':
            setOutput((prev) => [...prev, evt.data || '']);
            break;
          case 'stderr':
            setOutput((prev) => [...prev, `[stderr] ${evt.data}`]);
            break;
          case 'done':
            setStatus('completed');
            setDuration(evt.durationMs || Date.now() - startTime.current);
            es.close();
            break;
          case 'error':
            setStatus('error');
            setError(evt.stderr || evt.data || 'Unknown error');
            es.close();
            break;
          case 'destroyed':
            setStatus('destroyed');
            es.close();
            break;
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      setStatus('disconnected');
      es.close();
    };

    return () => es.close();
  }, [streamUrl]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output]);

  const handleCopy = () => {
    navigator.clipboard.writeText(output.join('\n'));
  };

  const handleDownload = () => {
    const blob = new Blob([output.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sandbox-${runId}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusIcon = {
    connecting: <Clock className="w-4 h-4 text-yellow-400 animate-spin" />,
    running: <Terminal className="w-4 h-4 text-green-400 animate-pulse" />,
    completed: <CheckCircle className="w-4 h-4 text-green-400" />,
    error: <XCircle className="w-4 h-4 text-red-400" />,
    destroyed: <XCircle className="w-4 h-4 text-gray-400" />,
    disconnected: <XCircle className="w-4 h-4 text-yellow-400" />,
  }[status];

  return (
    <div className="flex flex-col">
      {/* Terminal Output */}
      <div
        ref={terminalRef}
        className="h-64 overflow-auto bg-black text-green-400 font-mono text-sm p-4"
      >
        {output.length === 0 && status === 'connecting' && (
          <span className="text-gray-600 animate-pulse">Connecting to sandbox...</span>
        )}
        {output.map((line, i) => (
          <div key={i} className="whitespace-pre-wrap break-all">
            {line}
          </div>
        ))}
        {error && <div className="text-red-400 mt-2">{error}</div>}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-t border-gray-800">
        <div className="flex items-center gap-2 text-xs">
          {statusIcon}
          <span className="text-gray-400 capitalize">{status}</span>
          {duration > 0 && (
            <span className="text-gray-600">· {(duration / 1000).toFixed(1)}s</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
            title="Copy output"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
            title="Download log"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
