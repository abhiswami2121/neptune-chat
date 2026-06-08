"use client";
/**
 * ConnectorDetailSheet — right drawer with Overview / Capabilities / Playbook / Logs tabs.
 */
import { ExternalLinkIcon, WrenchIcon } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ConnectorManifest } from "@/lib/connectors/types";

interface ConnectorDetailSheetProps {
  manifest: ConnectorManifest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: { connected: boolean; message?: string };
}

export function ConnectorDetailSheet({ manifest, open, onOpenChange, status }: ConnectorDetailSheetProps) {
  if (!manifest) return null;
  const Icon = manifest.icon;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[420px] sm:max-w-[420px] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <SheetHeader className="p-4 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${manifest.brandColor}15`, color: manifest.brandColor }}
            >
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <SheetTitle className="text-base">{manifest.name}</SheetTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{manifest.description}</p>
            </div>
          </div>
        </SheetHeader>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
          <TabsList className="px-4 pt-2 justify-start gap-1 bg-transparent border-b rounded-none flex-shrink-0">
            <TabsTrigger value="overview" className="text-xs data-[state=active]:bg-muted">Overview</TabsTrigger>
            <TabsTrigger value="capabilities" className="text-xs data-[state=active]:bg-muted">Capabilities</TabsTrigger>
            <TabsTrigger value="playbook" className="text-xs data-[state=active]:bg-muted">Playbook</TabsTrigger>
            <TabsTrigger value="logs" className="text-xs data-[state=active]:bg-muted">Logs</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1">
            {/* Overview Tab */}
            <TabsContent value="overview" className="p-4 space-y-4 mt-0">
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Status</h4>
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", status.connected ? "bg-emerald-500" : "bg-yellow-500")} />
                  <span className="text-sm">{status.message || (status.connected ? "Connected" : "Not Configured")}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Environment Keys</h4>
                <div className="space-y-1.5">
                  {manifest.envKeys.map((key) => (
                    <div key={key} className="flex items-center gap-2 text-xs">
                      <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded font-mono">{key}</code>
                      <span className={cn("text-[10px]", "text-yellow-500")}>● Set</span>
                    </div>
                  ))}
                </div>
              </div>

              {manifest.docs && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Documentation</h4>
                  <a href={manifest.docs.official} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <ExternalLinkIcon className="w-3 h-3" /> Official docs
                  </a>
                </div>
              )}
            </TabsContent>

            {/* Capabilities Tab */}
            <TabsContent value="capabilities" className="p-4 space-y-2 mt-0">
              {manifest.capabilities.map((cap) => (
                <Card key={cap.id} className="p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <WrenchIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">{cap.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 ml-5.5">{cap.description}</p>
                </Card>
              ))}
            </TabsContent>

            {/* Playbook Tab */}
            <TabsContent value="playbook" className="p-4 mt-0">
              <Card className="p-4 bg-muted/20">
                <p className="text-xs text-muted-foreground italic">
                  Playbook: <code className="text-[11px]">{manifest.playbookPath}</code>
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Playbook rendering (MDX) will be available after next build. The playbook contains domain-specific guidance, anti-patterns, and best practices for this connector.
                </p>
              </Card>
            </TabsContent>

            {/* Logs Tab */}
            <TabsContent value="logs" className="p-4 mt-0">
              <Card className="p-4 bg-muted/20">
                <p className="text-xs text-muted-foreground italic">
                  Connector invocation logs will appear here after the first tool call. Session data is stored in SessionDataStore.
                </p>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
