import { Skeleton } from "@/components/ui/skeleton";

export function NewsCardSkeleton() {
  return (
    <article className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-3 w-16" />
      </div>
      {/* Confronto */}
      <div className="flex items-center justify-between">
        <div className="flex-1 space-y-1 text-center">
          <Skeleton className="mx-auto h-4 w-20" />
          <Skeleton className="mx-auto h-3 w-14" />
        </div>
        <Skeleton className="mx-4 h-8 w-16" />
        <div className="flex-1 space-y-1 text-center">
          <Skeleton className="mx-auto h-4 w-20" />
          <Skeleton className="mx-auto h-3 w-14" />
        </div>
      </div>
      {/* Points bar */}
      <Skeleton className="h-10 w-full rounded-xl" />
    </article>
  );
}

export function NewsListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <NewsCardSkeleton key={i} />
      ))}
    </div>
  );
}
