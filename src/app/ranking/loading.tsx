import { AppShell } from "@/components/app-shell";
import { PlayerListSkeleton } from "@/components/skeletons";
import { Search } from "lucide-react";

export default function Loading() {
  return (
    <AppShell title="Ranking" subtitle="Classificação dos jogadores" showBack>
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            className="h-10 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            placeholder="Buscar jogador..."
            disabled
          />
        </div>
        <PlayerListSkeleton count={8} />
      </div>
    </AppShell>
  );
}
