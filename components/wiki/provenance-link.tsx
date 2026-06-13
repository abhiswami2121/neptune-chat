import type { Provenance } from "@/lib/knowledge/types";

export function ProvenanceChip({ provenance }: { provenance: Provenance | null }) {
  if (!provenance) return null;

  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
      <span className="i-lucide-link h-3 w-3" />
      {provenance.sessionId?.slice(0, 8)}...
      {provenance.timestamp && (
        <> · {new Date(provenance.timestamp).toLocaleDateString()}</>
      )}
    </span>
  );
}
