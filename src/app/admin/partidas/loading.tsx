import { AppShell } from "@/components/app-shell";
import { MatchListSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <AppShell title="Partidas" subtitle="Gerenciar partidas" showBack>
      <div className="space-y-4">
        <div className="flex gap-2">
          <Skeleton className="h-8 w-16 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
        <MatchListSkeleton count={5} />
      </div>
    </AppShell>
  );
}
