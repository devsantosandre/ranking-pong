import { Skeleton } from "@/components/ui/skeleton";

export function TopRankingCardSkeleton() {
  return (
    <article className="flex items-center justify-between rounded-2xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <Skeleton className="h-6 w-12" />
    </article>
  );
}

export function TopRankingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <TopRankingCardSkeleton key={i} />
      ))}
    </div>
  );
}
