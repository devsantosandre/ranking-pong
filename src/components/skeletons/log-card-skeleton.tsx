import { Skeleton } from "@/components/ui/skeleton";

export function LogCardSkeleton() {
  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-24 rounded-full" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-3 w-16" />
      </div>
    </article>
  );
}

export function LogListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <LogCardSkeleton key={i} />
      ))}
    </div>
  );
}
