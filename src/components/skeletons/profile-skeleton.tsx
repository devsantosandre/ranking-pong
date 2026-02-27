import { Skeleton } from "@/components/ui/skeleton";
import { StatsGridSkeleton } from "./stats-skeleton";

export function ProfileHeaderSkeleton() {
  return (
    <article className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-4">
        <Skeleton className="h-14 w-14 rounded-full" />
        <div className="flex-1 space-y-2.5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-14 rounded-full" />
          </div>
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    </article>
  );
}

const chartHeights = [45, 35, 55, 40, 50, 30, 60];

function AchievementsSectionSkeleton() {
  return (
    <article className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-14" />
        </div>
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>

      <div className="px-4 pb-2">
        <Skeleton className="h-2 w-full rounded-full" />
      </div>

      <div className="space-y-4 px-4 pb-4">
        <div className="flex flex-wrap gap-1">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-[4.5rem] rounded-full" />
        </div>

        <div className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 10 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        </div>

        <div className="space-y-2 border-t border-border pt-2">
          <Skeleton className="h-3 w-20" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-5 w-16 rounded-lg" />
            <Skeleton className="h-5 w-16 rounded-lg" />
            <Skeleton className="h-5 w-16 rounded-lg" />
            <Skeleton className="h-5 w-20 rounded-lg" />
          </div>
        </div>
      </div>
    </article>
  );
}

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
      <Skeleton className="mx-auto mt-3 h-3 w-44" />
    </article>
  );
}

function RecentProfileMatchCardSkeleton() {
  return (
    <article className="flex items-center justify-between rounded-2xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-14" />
        </div>
      </div>
      <Skeleton className="h-4 w-14" />
    </article>
  );
}

function ProfileQuickLinksSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 2 }).map((_, index) => (
        <article
          key={index}
          className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-36" />
            </div>
          </div>
          <Skeleton className="h-4 w-4" />
        </article>
      ))}
    </div>
  );
}

function ProfileLogoutSkeleton() {
  return (
    <article className="rounded-2xl border border-red-200 bg-red-50 p-3">
      <Skeleton className="mx-auto h-4 w-24 bg-red-200/80" />
    </article>
  );
}

export function ProfilePageSkeleton() {
  return (
    <div className="space-y-4">
      <ProfileHeaderSkeleton />
      <StatsGridSkeleton />
      <AchievementsSectionSkeleton />
      <div className="space-y-3">
        <Skeleton className="h-4 w-44" />
        <HistoryChartSkeleton />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <RecentProfileMatchCardSkeleton key={index} />
          ))}
        </div>
      </div>
      <ProfileQuickLinksSkeleton />
      <ProfileLogoutSkeleton />
    </div>
  );
}
