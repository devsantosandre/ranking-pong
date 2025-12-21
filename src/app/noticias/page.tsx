"use client";

import { AppShell } from "@/components/app-shell";
import { useNews } from "@/lib/queries";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { NewsListSkeleton } from "@/components/skeletons";
import { useMemo } from "react";

export default function NoticiasPage() {
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNews();

  // Flatten paginated data
  const news = useMemo(() => {
    return data?.pages.flatMap((page) => page.news) ?? [];
  }, [data]);

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Agora";
    if (diffMins < 60) return `${diffMins} min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays === 1) return "Ontem";
    if (diffDays < 7) return `${diffDays} dias atrás`;
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };

  if (isLoading) {
    return (
      <AppShell
        title="Notícias"
        subtitle="Feed de resultados e destaques"
        showBack
      >
        <NewsListSkeleton count={4} />
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell
        title="Notícias"
        subtitle="Feed de resultados e destaques"
        showBack
      >
        <p className="py-8 text-center text-sm text-red-500">
          Erro ao carregar notícias. Tente novamente.
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Notícias"
      subtitle="Feed de resultados e destaques"
      showBack
    >
      <div className="space-y-4">
        {news.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum resultado registrado ainda. Jogue partidas para ver o feed!
          </p>
        ) : (
          <>
            {news.map((item) => (
              <article
                key={item.id}
                className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-primary/15 px-3 py-1 text-[11px] font-semibold text-primary">
                    Resultado
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatTimeAgo(item.createdAt)}
                  </span>
                </div>

                {/* Confronto */}
                <div className="flex items-center justify-between">
                  <div className="flex-1 text-center">
                    <p className="text-sm font-semibold text-green-600">{item.winner.name}</p>
                    <p className="text-[11px] text-muted-foreground">Vencedor</p>
                  </div>
                  <div className="px-4">
                    <p className="text-2xl font-bold text-primary">{item.score}</p>
                  </div>
                  <div className="flex-1 text-center">
                    <p className="text-sm font-semibold text-red-500">{item.loser.name}</p>
                    <p className="text-[11px] text-muted-foreground">Perdedor</p>
                  </div>
                </div>

                {/* Pontuação */}
                <div className="flex items-center justify-center gap-6 rounded-xl bg-muted/60 p-2">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">{item.winner.name}</p>
                    <p className="text-sm font-semibold text-green-600">+{item.pointsWinner} pts</p>
                  </div>
                  <div className="h-6 w-px bg-border" />
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">{item.loser.name}</p>
                    <p className="text-sm font-semibold text-blue-600">+{item.pointsLoser} pts</p>
                  </div>
                </div>
              </article>
            ))}

            {/* Botao Carregar mais */}
            <LoadMoreButton
              onClick={() => fetchNextPage()}
              isLoading={isFetchingNextPage}
              hasMore={!!hasNextPage}
            />
          </>
        )}
      </div>
    </AppShell>
  );
}
