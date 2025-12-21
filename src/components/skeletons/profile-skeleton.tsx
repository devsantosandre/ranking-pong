import { Skeleton } from "@/components/ui/skeleton";
import { StatsGridSkeleton } from "./stats-skeleton";
import { MatchListSkeleton } from "./match-card-skeleton";

export function ProfileHeaderSkeleton() {
  return (
    <article className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-4">
        <Skeleton className="h-14 w-14 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-6 w-10 rounded-full" />
      </div>
    </article>
  );
}

const chartHeights = [45, 35, 55, 40, 50, 30, 60];

export function HistoryChartSkeleton() {
  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="grid grid-cols-7 items-end gap-2">
        {chartHeights.map((height, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <Skeleton className="h-3 w-6" />
            <Skeleton
              className="w-full rounded-md"
              style={{ height: `${height}px` }}
            />
            <Skeleton className="h-3 w-6" />
          </div>
        ))}
      </div>
    </article>
  );
}

export function ProfilePageSkeleton() {
  return (
    <div className="space-y-4">
      <ProfileHeaderSkeleton />
      <StatsGridSkeleton />
      <div className="space-y-3">
        <Skeleton className="h-4 w-40 px-1" />
        <HistoryChartSkeleton />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-24 px-1" />
        <MatchListSkeleton count={3} />
      </div>
    </div>
  );
}
