import { AppShell } from "@/components/app-shell";
import { PendingMatchListSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <AppShell title="Partidas" subtitle="Recentes e Pendentes" showBack>
      <div className="space-y-4">
        <div className="flex gap-3 text-sm font-semibold">
          <button className="rounded-full bg-primary/15 px-3 py-2 text-primary">
            Pendentes
          </button>
          <button className="rounded-full bg-muted/70 px-3 py-2 text-foreground">
            Recentes
          </button>
        </div>
        <PendingMatchListSkeleton count={4} />
      </div>
    </AppShell>
  );
}
