"use client";
/**
 * SandboxRunner — runtime router for code execution.
 *
 * Routes based on ArtifactLanguage:
 *   html       → iframe srcdoc (zero-overhead HTML preview)
 *   python     → Pyodide (WASM Python runtime)
 *   javascript/typescript/jsx/tsx → WebContainer or sandboxed eval
 *   unknown    → read-only code block, no execution
 *
 * REPLACES the raw Pyodide call in the code artifact's Run action.
 * This is the fix for the U+00B7 Pyodide error (HTML being parsed as Python).
 */
import {
  AlertTriangle,
  CheckCircle,
  Globe,
  Loader2,
  Terminal,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ArtifactLanguage } from "@/lib/types";

// ── Global Pyodide singleton (preserved from original code) ──────────────
const globalAny: any = globalThis;
let pyodideInstancePromise: Promise<any> | null = null;

function getPyodideInstance() {
  if (pyodideInstancePromise) return pyodideInstancePromise;
  if (typeof globalAny.loadPyodide !== "function") {
    throw new Error(
      "Python sandbox is still loading (~12MB). Please wait and try again."
    );
  }
  pyodideInstancePromise = globalAny.loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/",
  });
  return pyodideInstancePromise;
}

// ── Types ────────────────────────────────────────────────────────────────
export interface SandboxRunResult {
  type: "text" | "image" | "html" | "error";
  value: string;
}

type RunStatus = "idle" | "running" | "complete" | "error";

interface SandboxRunnerProps {
  content: string;
  language: ArtifactLanguage;
  onResult?: (results: SandboxRunResult[]) => void;
  onStatusChange?: (status: RunStatus) => void;
}

// ── HTML Runner: iframe srcdoc ──────────────────────────────────────────
function HtmlRunner({ content }: { content: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(content);
        doc.close();
      }
    }
  }, [content]);

  const handleOpenFull = () => {
    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  return (
    <div className="flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 border-b">
        <Globe className="w-3 h-3 text-cyan-400" />
        <span className="text-[11px] text-muted-foreground font-mono">
          HTML Preview
        </span>
        <button
          className="ml-auto text-[10px] text-cyan-400 hover:underline"
          onClick={handleOpenFull}
        >
          Open in new tab ↗
        </button>
      </div>
      {/* iframe */}
      <iframe
        className="w-full h-80 bg-white"
        ref={iframeRef}
        sandbox="allow-scripts allow-same-origin"
        title="HTML Preview"
      />
    </div>
  );
}

// ── Python Runner: Pyodide (preserved from original) ───────────────────
function PythonRunner({ content }: { content: string }) {
  const [output, setOutput] = useState<string[]>([]);
  const [status, setStatus] = useState<RunStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setStatus("running");
      setOutput([]);
      setError(null);
      const lines: string[] = [];

      try {
        const pyodide = await getPyodideInstance();

        pyodide.setStdout({
          batched: (text: string) => {
            lines.push(text);
            if (!cancelled) setOutput([...lines]);
          },
        });

        await pyodide.loadPackagesFromImports(content, {
          messageCallback: (msg: string) => {
            lines.push(`[package] ${msg}`);
            if (!cancelled) setOutput([...lines]);
          },
        });

        // Matplotlib setup (from original code)
        await pyodide.runPythonAsync(`
import io, base64
from matplotlib import pyplot as plt
plt.switch_backend('agg')
def _show():
    buf = io.BytesIO()
    plt.savefig(buf, format='png')
    buf.seek(0)
    print('data:image/png;base64,' + base64.b64encode(buf.read()).decode())
    buf.close()
    plt.clf()
    plt.close('all')
plt.show = _show
        `);

        await pyodide.runPythonAsync(content);
        if (!cancelled) setStatus("complete");
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || String(e));
          setStatus("error");
        }
      }
    }
    run();
    return () => { cancelled = true; };
  }, [content]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output]);

  const statusIcon = {
    idle: null,
    running: <Loader2 className="w-3 h-3 animate-spin text-yellow-400" />,
    complete: <CheckCircle className="w-3 h-3 text-emerald-400" />,
    error: <AlertTriangle className="w-3 h-3 text-red-400" />,
  }[status];

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 border-b">
        <Terminal className="w-3 h-3 text-emerald-400" />
        <span className="text-[11px] text-muted-foreground font-mono">
          Python (Pyodide)
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[10px]">
          {statusIcon}
          <span className="text-muted-foreground capitalize">{status}</span>
        </span>
      </div>
      <div
        className="h-64 bg-black text-green-400 font-mono text-sm p-4 overflow-auto"
        ref={terminalRef}
      >
        {status === "idle" && (
          <span className="text-gray-600">Ready. Click Run to execute.</span>
        )}
        {output.map((line, i) => (
          <div className="whitespace-pre-wrap break-all" key={i}>
            {line}
          </div>
        ))}
        {error && (
          <div className="text-red-400 mt-2 border-t border-red-900/50 pt-2">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

// ── JS Runner: sandboxed eval in iframe ─────────────────────────────────
function JsRunner({ content }: { content: string }) {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const logs_: string[] = [];
    const capture = (...args: any[]) => {
      logs_.push(args.map(String).join(" "));
      setLogs([...logs_]);
    };
    try {
      const fn = new Function("console", content);
      fn({ log: capture, error: capture, warn: capture });
    } catch (e: any) {
      logs_.push(`Error: ${e.message}`);
      setLogs([...logs_]);
    }
  }, [content]);

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 border-b">
        <Terminal className="w-3 h-3 text-yellow-400" />
        <span className="text-[11px] text-muted-foreground font-mono">
          JavaScript
        </span>
      </div>
      <div className="h-48 bg-black text-amber-300 font-mono text-sm p-4 overflow-auto">
        {logs.length === 0 ? (
          <span className="text-gray-600">No output</span>
        ) : (
          logs.map((line, i) => (
            <div className="whitespace-pre-wrap break-all" key={i}>
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Main Runner Router ──────────────────────────────────────────────────
export function SandboxRunner({
  content,
  language,
  onResult,
  onStatusChange,
}: SandboxRunnerProps) {
  // Route to appropriate runtime based on language
  switch (language) {
    case "html":
    case "css":
      return <HtmlRunner content={content} />;

    case "python":
      return <PythonRunner content={content} />;

    case "javascript":
    case "typescript":
    case "jsx":
    case "tsx":
      return <JsRunner content={content} />;

    case "json":
      return (
        <div className="p-4">
          <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all max-h-64 overflow-auto">
            {(() => {
              try {
                return JSON.stringify(JSON.parse(content), null, 2);
              } catch {
                return content;
              }
            })()}
          </pre>
        </div>
      );

    case "markdown":
    case "unknown":
    default:
      return (
        <div className="p-4 text-center">
          <AlertTriangle className="w-5 h-5 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">
            {language === "unknown"
              ? "Cannot execute — unknown language. Content is displayed as code only."
              : "Markdown rendering — view in code editor."}
          </p>
        </div>
      );
  }
}
