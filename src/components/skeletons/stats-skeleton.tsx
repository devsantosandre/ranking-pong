import { Skeleton } from "@/components/ui/skeleton";

export function StatsGridSkeleton() {
  return (
    <div className="grid grid-cols-4 gap-2">
      {[1, 2, 3, 4].map((i) => (
        <article
          key={i}
          className="rounded-2xl border border-border bg-card p-3 shadow-sm text-center"
        >
          <Skeleton className="mx-auto h-6 w-12" />
          <Skeleton className="mx-auto mt-1 h-3 w-10" />
        </article>
      ))}
    </div>
  );
}
