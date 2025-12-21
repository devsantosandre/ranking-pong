import { Skeleton } from "@/components/ui/skeleton";

export function PlayerCardSkeleton() {
  return (
    <article className="flex items-center justify-between rounded-2xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-center gap-3">
        {/* Position circle */}
        <Skeleton className="h-10 w-10 rounded-full" />
        {/* Player info */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      {/* Points */}
      <div className="space-y-1 text-right">
        <Skeleton className="ml-auto h-5 w-12" />
        <Skeleton className="ml-auto h-3 w-10" />
      </div>
    </article>
  );
}

export function PlayerListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <PlayerCardSkeleton key={i} />
      ))}
    </div>
  );
}
