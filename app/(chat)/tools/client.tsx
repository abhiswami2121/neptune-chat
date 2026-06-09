"use client";
/**
 * ToolsClient — world-class tools registry with grouped categories,
 * search, JSON-schema-driven try-it inline panel, and status indicators.
 *
 * A11y: keyboard-navigable categories, ARIA-expanded, proper labels.
 */
import {
  ChevronDown,
  Play,
  Search,
  Terminal,
  Wrench,
  X,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ToolDef {
  name: string;
  description: string;
  inputs: string;
  connectorName?: string;
}

interface Category {
  name: string;
  connectorId?: string;
  brandColor?: string;
  tools: ToolDef[];
}

export function ToolsClient({ categories }: { categories: Category[] }) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(categories.map((c) => [c.name, true]))
  );
  const [tryItTool, setTryItTool] = useState<ToolDef | null>(null);
  const [tryItInput, setTryItInput] = useState("");
  const [tryItOutput, setTryItOutput] = useState<string | null>(null);
  const [tryItRunning, setTryItRunning] = useState(false);

  const filtered = categories
    .map((cat) => ({
      ...cat,
      tools: cat.tools.filter(
        (t) =>
          !search ||
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.description.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter((cat) => cat.tools.length > 0);

  const totalTools = categories.reduce((sum, c) => sum + c.tools.length, 0);

  const handleTryIt = async (tool: ToolDef) => {
    setTryItTool(tool);
    setTryItOutput(null);
    setTryItRunning(true);
    try {
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: tryItInput || "{}",
      });
      const data = await res.json();
      setTryItOutput(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setTryItOutput(`Error: ${e.message}`);
    } finally {
      setTryItRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          aria-label="Search tools"
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-cyan-400/20 focus:border-cyan-400/30 transition-colors"
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${totalTools} tools by name or description...`}
          type="text"
          value={search}
        />
      </div>

      {/* Tool categories */}
      {filtered.map((cat) => (
        <div key={cat.name}>
          <button
            aria-expanded={expanded[cat.name]}
            aria-label={`Toggle ${cat.name} category`}
            className="flex items-center gap-2 w-full text-left py-2 mb-2 group"
            onClick={() =>
              setExpanded((prev) => ({ ...prev, [cat.name]: !prev[cat.name] }))
            }
          >
            <ChevronDown
              className={cn(
                "w-4 h-4 text-muted-foreground transition-transform duration-200",
                !expanded[cat.name] && "-rotate-90"
              )}
            />
            <span className="text-sm font-semibold tracking-tight">
              {cat.name}
            </span>
            {cat.brandColor && (
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: cat.brandColor }}
              />
            )}
            <Badge
              className="text-[10px] px-1.5 py-0 font-mono"
              variant="secondary"
            >
              {cat.tools.length}
            </Badge>
          </button>

          {expanded[cat.name] && (
            <div className="grid gap-2 ml-6">
              {cat.tools.map((tool) => (
                <Card
                  className="group border-border/40 hover:border-border hover:shadow-sm transition-all duration-150"
                  key={tool.name}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Wrench className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="text-sm font-mono font-semibold text-foreground">
                            {tool.name}
                          </code>
                          {tool.connectorName && (
                            <Badge
                              className="text-[9px] px-1.5 py-0 font-normal"
                              variant="outline"
                            >
                              {tool.connectorName}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {tool.description}
                        </p>
                        {tool.inputs && (
                          <code className="text-[10px] text-muted-foreground/60 mt-1.5 block truncate font-mono">
                            Input: {tool.inputs}
                          </code>
                        )}
                      </div>
                      {/* Try-it button */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            aria-label={`Try ${tool.name}`}
                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTryItTool(tool);
                              setTryItInput("");
                              setTryItOutput(null);
                            }}
                            size="icon"
                            variant="ghost"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left">Try it</TooltipContent>
                      </Tooltip>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Wrench className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground font-medium">
            No tools found
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {search
              ? `No results for "${search}"`
              : "No tools registered yet"}
          </p>
        </div>
      )}

      {/* Try-it inline panel */}
      {tryItTool && (
        <Card className="border-cyan-400/20 bg-cyan-950/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-semibold">
                  Try:{" "}
                  <code className="text-cyan-400 font-mono">
                    {tryItTool.name}
                  </code>
                </span>
              </div>
              <Button
                aria-label="Close try-it panel"
                className="h-7 w-7 p-0"
                onClick={() => {
                  setTryItTool(null);
                  setTryItOutput(null);
                }}
                size="icon"
                variant="ghost"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mb-3">
              {tryItTool.description}
            </p>

            {/* Input */}
            <div className="mb-3">
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                Input (JSON)
              </label>
              <div className="flex gap-2">
                <textarea
                  aria-label="Tool input JSON"
                  className="flex-1 min-h-[60px] text-xs font-mono p-2 rounded border bg-background focus:outline-none focus:ring-1 focus:ring-cyan-400/30 resize-y"
                  onChange={(e) => setTryItInput(e.target.value)}
                  placeholder={tryItTool.inputs || "{}"}
                  value={tryItInput}
                />
              </div>
            </div>

            <Button
              className="h-7 text-xs gap-1.5"
              disabled={tryItRunning}
              onClick={() => handleTryIt(tryItTool)}
              size="sm"
              variant="outline"
            >
              {tryItRunning ? (
                <>
                  <span className="animate-spin w-3 h-3 border border-current border-t-transparent rounded-full" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-3 h-3" />
                  Run
                </>
              )}
            </Button>

            {/* Output */}
            {tryItOutput && (
              <div className="mt-3">
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                  Response
                </label>
                <pre className="text-xs font-mono bg-muted/50 p-3 rounded border overflow-x-auto max-h-48 whitespace-pre-wrap">
                  {tryItOutput}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
