import { NeptuneSidebar } from '@/components/sidebar/neptune-sidebar';

export default function ReportsPage() {
  return (
    <div className="flex h-dvh">
      <NeptuneSidebar />
      <main className="flex-1 p-6 overflow-y-auto">
        <h1 className="text-2xl font-bold mb-4 capitalize">reports</h1>
        <p className="text-muted-foreground">Reports panel — coming soon. Grand Unification 2026-06-08.</p>
      </main>
    </div>
  );
}
