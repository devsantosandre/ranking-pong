import { Skeleton } from "@/components/ui/skeleton";

export function AppShellLoadingSkeleton() {
  return (
    <main className="min-h-screen bg-[#f5f4fa] text-foreground">
      <header className="fixed inset-x-0 top-0 z-50 flex justify-center bg-primary text-primary-foreground shadow-xl ring-1 ring-primary">
        <div className="w-full max-w-[440px]">
          <div className="flex items-center gap-3 px-4 py-4 sm:px-6">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full bg-primary-foreground/20" />

            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-24 bg-primary-foreground/20" />
              <Skeleton className="h-6 w-32 bg-primary-foreground/20" />
              <Skeleton className="h-3 w-44 bg-primary-foreground/20" />
            </div>

            <Skeleton className="h-7 w-20 rounded-full bg-primary-foreground/20" />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[420px] flex-col gap-8 px-4 pb-32 pt-32 sm:px-6">
        <section className="space-y-4 rounded-3xl bg-card p-5 shadow-xl ring-1 ring-border">
          <article className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-8 w-24" />
              </div>
              <div className="space-y-2 text-right">
                <Skeleton className="ml-auto h-5 w-20 rounded-full" />
                <Skeleton className="ml-auto h-3 w-14" />
              </div>
            </div>
          </article>

          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
          </div>
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-card/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[440px] items-center justify-between px-3 py-3 sm:px-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-1"
            >
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-2.5 w-10" />
            </div>
          ))}
        </div>
      </nav>

      <div className="fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 sm:bottom-16">
        <Skeleton className="h-12 w-40 rounded-full" />
      </div>
    </main>
  );
}
