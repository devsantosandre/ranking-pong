import { AppShell } from "@/components/app-shell";
import { PlayerListSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <AppShell title="Jogadores" subtitle="Gerenciar jogadores" showBack>
      <div className="space-y-4">
        <Skeleton className="h-9 w-full rounded-md" />
        <Skeleton className="h-10 w-full rounded-md" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-16 rounded-full" />
          <Skeleton className="h-8 w-16 rounded-full" />
          <Skeleton className="h-8 w-16 rounded-full" />
        </div>
        <PlayerListSkeleton count={6} />
      </div>
    </AppShell>
  );
}
