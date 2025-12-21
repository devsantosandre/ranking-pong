import { Skeleton } from "@/components/ui/skeleton";
import { TopRankingSkeleton } from "./top-ranking-skeleton";
import { PendingMatchListSkeleton, MatchListSkeleton } from "./match-card-skeleton";

export function UserPointsCardSkeleton() {
  return (
    <article className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="space-y-2 text-right">
          <Skeleton className="ml-auto h-5 w-24 rounded-full" />
          <Skeleton className="ml-auto h-3 w-16" />
        </div>
      </div>
    </article>
  );
}

export function SectionHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between px-1">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

export function HomePageSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <UserPointsCardSkeleton />

      <div className="space-y-3">
        <SectionHeaderSkeleton />
        <TopRankingSkeleton />
      </div>

      <div className="space-y-3">
        <SectionHeaderSkeleton />
        <PendingMatchListSkeleton count={2} />
      </div>

      <div className="space-y-3">
        <SectionHeaderSkeleton />
        <MatchListSkeleton count={2} />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
      </div>
    </div>
  );
}
