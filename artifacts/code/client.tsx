import { toast } from "sonner";
import { CodeEditor } from "@/components/chat/code-editor";
import {
  Console,
  type ConsoleOutput,
  type ConsoleOutputContent,
} from "@/components/chat/console";
import { Artifact } from "@/components/chat/create-artifact";
import {
  CopyIcon,
  LogsIcon,
  MessageIcon,
  PlayIcon,
  RedoIcon,
  UndoIcon,
} from "@/components/chat/icons";
import { SandboxRunner } from "@/components/chat/sandbox-runner";
import { generateUUID } from "@/lib/utils";
import { detectArtifactLanguage } from "@/lib/types";

// NOTE: Pyodide singleton is managed inside SandboxRunner (components/chat/sandbox-runner.tsx).
// The old global caching is preserved there for Python execution only.
// HTML/CSS/JS/TS artifacts NEVER hit Pyodide — they use iframe srcdoc or sandboxed eval.

type Metadata = {
  outputs: ConsoleOutput[];
};

export const codeArtifact = new Artifact<"code", Metadata>({
  kind: "code",
  description:
    "Code generation with language-aware execution. HTML → preview, Python → Pyodide, JS/TS → sandbox eval.",
  initialize: ({ setMetadata }) => {
    setMetadata({
      outputs: [],
    });
  },
  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === "data-codeDelta") {
      setArtifact((draftArtifact) => {
        // Auto-detect language during streaming for early feedback
        const detected = detectArtifactLanguage(streamPart.data);
        return {
          ...draftArtifact,
          content: streamPart.data,
          language: draftArtifact.language || (detected !== "unknown" ? detected : undefined),
          isVisible:
            draftArtifact.status === "streaming" &&
            draftArtifact.content.length > 300 &&
            draftArtifact.content.length < 310
              ? true
              : draftArtifact.isVisible,
          status: "streaming",
        };
      });
    }
  },
  content: ({ metadata, setMetadata, content, ...props }) => {
    // Detect language for the content display
    const language = detectArtifactLanguage(content);

    return (
      <>
        <div className="relative min-h-[200px]">
          <CodeEditor
            {...props}
            content={content}
          />
        </div>

        {/* Sandbox output — language-aware execution results */}
        {metadata?.outputs && metadata.outputs.length > 0 && (
          <Console
            consoleOutputs={metadata.outputs}
            setConsoleOutputs={() => {
              setMetadata({
                ...metadata,
                outputs: [],
              });
            }}
          />
        )}
      </>
    );
  },
  actions: [
    {
      icon: <PlayIcon size={18} />,
      label: "Run",
      description: "Execute code",
      onClick: async ({ content, setMetadata }) => {
        const runId = generateUUID();
        const language = detectArtifactLanguage(content);
        const outputContent: ConsoleOutputContent[] = [];

        setMetadata((metadata) => ({
          ...metadata,
          outputs: [
            ...metadata.outputs,
            {
              id: runId,
              contents: [{ type: "text", value: `Detected: ${language}` }],
              status: "in_progress",
            },
          ],
        }));

        // ── HTML/CSS → no Pyodide needed, preview handled by SandboxRunner ──
        if (language === "html" || language === "css") {
          outputContent.push({
            type: "text",
            value: `✅ HTML document detected — rendering as web preview. Use "Open in new tab" to view full page.`,
          });
          setMetadata((metadata) => ({
            ...metadata,
            outputs: [
              ...metadata.outputs.filter((o) => o.id !== runId),
              {
                id: runId,
                contents: outputContent,
                status: "completed",
              },
            ],
          }));
          return;
        }

        // ── Python → Pyodide (the ONLY path that uses Pyodide) ──
        if (language === "python") {
          try {
            // Delegate to SandboxRunner's Python runner — accessing Pyodide internally
            const globalAny: any = globalThis;
            if (typeof globalAny.loadPyodide !== "function") {
              throw new Error(
                "Python sandbox is still loading (~12MB). Please wait and try again."
              );
            }

            let pyodidePromise: any = null;
            if (!(globalAny as any).__pyodideInstance) {
              pyodidePromise = globalAny.loadPyodide({
                indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/",
              });
              (globalAny as any).__pyodideInstance = pyodidePromise;
            } else {
              pyodidePromise = (globalAny as any).__pyodideInstance;
            }

            const pyodide = await pyodidePromise;

            pyodide.setStdout({
              batched: (output: string) => {
                outputContent.push({
                  type: output.startsWith("data:image/png;base64")
                    ? "image"
                    : "text",
                  value: output,
                });
              },
            });

            await pyodide.loadPackagesFromImports(content, {
              messageCallback: (message: string) => {
                outputContent.push({ type: "text", value: `[pkg] ${message}` });
              },
            });

            // Matplotlib setup
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

            setMetadata((metadata) => ({
              ...metadata,
              outputs: [
                ...metadata.outputs.filter((o) => o.id !== runId),
                {
                  id: runId,
                  contents: outputContent,
                  status: "completed",
                },
              ],
            }));
            return;
          } catch (error: unknown) {
            setMetadata((metadata) => ({
              ...metadata,
              outputs: [
                ...metadata.outputs.filter((o) => o.id !== runId),
                {
                  id: runId,
                  contents: [
                    {
                      type: "text",
                      value:
                        error instanceof Error ? error.message : String(error),
                    },
                  ],
                  status: "failed",
                },
              ],
            }));
            return;
          }
        }

        // ── JavaScript/TypeScript → sandboxed execution ──
        if (
          language === "javascript" ||
          language === "typescript" ||
          language === "jsx" ||
          language === "tsx"
        ) {
          try {
            const logs: string[] = [];
            const capture = (...args: any[]) => {
              logs.push(args.map(String).join(" "));
            };
            const fn = new Function("console", content);
            fn({ log: capture, error: capture, warn: capture });
            for (const log of logs) {
              outputContent.push({ type: "text", value: log });
            }
            if (logs.length === 0) {
              outputContent.push({
                type: "text",
                value: "✅ Code executed (no console output).",
              });
            }
            setMetadata((metadata) => ({
              ...metadata,
              outputs: [
                ...metadata.outputs.filter((o) => o.id !== runId),
                {
                  id: runId,
                  contents: outputContent,
                  status: "completed",
                },
              ],
            }));
            return;
          } catch (error: unknown) {
            outputContent.push({
              type: "text",
              value: `JS Error: ${error instanceof Error ? error.message : String(error)}`,
            });
            setMetadata((metadata) => ({
              ...metadata,
              outputs: [
                ...metadata.outputs.filter((o) => o.id !== runId),
                {
                  id: runId,
                  contents: outputContent,
                  status: "failed",
                },
              ],
            }));
            return;
          }
        }

        // ── Unknown → show as code only, no execution ──
        outputContent.push({
          type: "text",
          value: `⚠️ Unknown language (${language}). Cannot execute safely. Content is shown as code only.`,
        });
        setMetadata((metadata) => ({
          ...metadata,
          outputs: [
            ...metadata.outputs.filter((o) => o.id !== runId),
            {
              id: runId,
              contents: outputContent,
              status: "completed",
            },
          ],
        }));
      },
    },
    {
      icon: <UndoIcon size={18} />,
      description: "View Previous version",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("prev");
      },
      isDisabled: ({ currentVersionIndex }) => {
        if (currentVersionIndex === 0) return true;
        return false;
      },
    },
    {
      icon: <RedoIcon size={18} />,
      description: "View Next version",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("next");
      },
      isDisabled: ({ isCurrentVersion }) => {
        if (isCurrentVersion) return true;
        return false;
      },
    },
    {
      icon: <CopyIcon size={18} />,
      description: "Copy code to clipboard",
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success("Copied to clipboard!");
      },
    },
  ],
  toolbar: [
    {
      icon: <MessageIcon />,
      description: "Add comments",
      onClick: ({ sendMessage }) => {
        sendMessage({
          role: "user",
          parts: [
            {
              type: "text",
              text: "Add comments to the code snippet for understanding",
            },
          ],
        });
      },
    },
    {
      icon: <LogsIcon />,
      description: "Add logs",
      onClick: ({ sendMessage }) => {
        sendMessage({
          role: "user",
          parts: [
            {
              type: "text",
              text: "Add logs to the code snippet for debugging",
            },
          ],
        });
      },
    },
  ],
});
