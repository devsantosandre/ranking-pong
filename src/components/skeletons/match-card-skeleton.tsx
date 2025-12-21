import { Skeleton } from "@/components/ui/skeleton";

export function MatchCardSkeleton() {
  return (
    <article className="space-y-2 rounded-2xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="mx-auto h-5 w-32" />
      <Skeleton className="mx-auto h-3 w-16" />
    </article>
  );
}

export function PendingMatchCardSkeleton() {
  return (
    <article className="space-y-3 rounded-2xl border border-border bg-muted/60 p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-5 w-28 rounded-full" />
      </div>
      <Skeleton className="mx-auto h-6 w-16" />
      <Skeleton className="mx-auto h-3 w-48" />
      <div className="flex gap-2">
        <Skeleton className="h-9 flex-1 rounded-full" />
        <Skeleton className="h-9 flex-1 rounded-full" />
      </div>
    </article>
  );
}

export function MatchListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <MatchCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function PendingMatchListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <PendingMatchCardSkeleton key={i} />
      ))}
    </div>
  );
}
