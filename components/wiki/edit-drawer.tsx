"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { KgEntity } from "@/lib/knowledge/types";

export function EditDrawer({ entity }: { entity: KgEntity }) {
  const [annotation, setAnnotation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleSubmit() {
    if (!annotation.trim()) return;
    setSubmitting(true);
    try {
      // Annotations are READ-ONLY for agent in v1 — user annotations stored as note
      await fetch(`/api/wiki/entity/${entity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annotation }),
      });
      setOpen(false);
      setAnnotation("");
    } catch {
      // Annotation save failed — non-blocking
    }
    setSubmitting(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          ✏️ Annotate
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Annotate Entity</SheetTitle>
          <SheetDescription>
            Add your annotation to {entity.name}. Note: the agent cannot modify
            the knowledge graph directly — only humans and the extraction pipeline
            can write.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <div className="text-sm">
            <span className="font-medium">Entity:</span> {entity.name}
          </div>
          <Textarea
            placeholder="Add your notes, corrections, or insights about this entity..."
            value={annotation}
            onChange={(e) => setAnnotation(e.target.value)}
            rows={6}
          />
          <Button
            onClick={handleSubmit}
            disabled={submitting || !annotation.trim()}
          >
            {submitting ? "Saving..." : "Save Annotation"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
