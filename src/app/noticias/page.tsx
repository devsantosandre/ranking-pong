"use client";

import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-store";
import { useNews, useSeasonNewsPosts, type NewsItem, type SeasonNewsPost } from "@/lib/queries";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { NewsListSkeleton } from "@/components/skeletons";
import {
  NewsReactionBarMock,
  type NewsReactionOverlayPanel,
} from "@/components/news/news-reaction-bar-mock";
import { useMemo, useState } from "react";
import { Trophy } from "lucide-react";

type MergedNewsItem =
  | (NewsItem & { _sortDate: string; _kind: "resultado" })
  | (SeasonNewsPost & { _sortDate: string; _kind: "temporada" });

export default function NoticiasPage() {
  const { user, loading: authLoading } = useAuth();
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNews(user?.id, !authLoading);
  const { data: seasonPosts, isLoading: seasonLoading } = useSeasonNewsPosts(!authLoading && !!user);

  const news = useMemo(() => {
    return data?.pages.flatMap((page) => page.news) ?? [];
  }, [data]);

  const merged = useMemo((): MergedNewsItem[] => {
    const matchItems: MergedNewsItem[] = news.map((item) => ({
      ...item,
      _kind: "resultado" as const,
      _sortDate: item.createdAt,
    }));
    const seasonItems: MergedNewsItem[] = (seasonPosts ?? []).map((item) => ({
      ...item,
      _kind: "temporada" as const,
      _sortDate: item.createdAt,
    }));
    return [...matchItems, ...seasonItems].sort(
      (a, b) => new Date(b._sortDate).getTime() - new Date(a._sortDate).getTime()
    );
  }, [news, seasonPosts]);

  const [openReactionOverlay, setOpenReactionOverlay] = useState<{
    matchId: string;
    panel: NewsReactionOverlayPanel;
  } | null>(null);

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

  const isPageLoading = authLoading || isLoading || seasonLoading;

  if (isPageLoading) {
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
        {merged.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum resultado registrado ainda. Jogue partidas para ver o feed!
          </p>
        ) : (
          <>
            {merged.map((item) => {
              if (item._kind === "temporada") {
                return (
                  <article
                    key={`season-${item.id}`}
                    className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="flex items-center gap-1.5 rounded-full bg-yellow-100 px-3 py-1 text-[11px] font-semibold text-yellow-700">
                        <Trophy className="h-3 w-3" />
                        Temporada
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTimeAgo(item.createdAt)}
                      </span>
                    </div>
                    <p className="font-semibold text-foreground">{item.title}</p>
                    {item.resumo && (
                      <p className="mt-1 text-sm text-muted-foreground">{item.resumo}</p>
                    )}
                  </article>
                );
              }

              // item._kind === "resultado"
              return (
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
                      <p className="text-[11px] text-muted-foreground">Pts ganhos</p>
                      <p className="text-sm font-semibold text-green-600">+{Math.abs(item.pointsWinner)} pts</p>
                    </div>
                    <div className="h-6 w-px bg-border" />
                    <div className="text-center">
                      <p className="text-[11px] text-muted-foreground">Pts perdidos</p>
                      <p className="text-sm font-semibold text-red-500">-{Math.abs(item.pointsLoser)} pts</p>
                    </div>
                  </div>

                  <NewsReactionBarMock
                    matchId={item.id}
                    userId={user?.id}
                    reactionCounts={item.reactionCounts}
                    reactionsTotal={item.reactionsTotal}
                    myReaction={item.myReaction}
                    openPanel={
                      openReactionOverlay?.matchId === item.id
                        ? openReactionOverlay.panel
                        : null
                    }
                    onOpenPanelChange={(panel) =>
                      setOpenReactionOverlay(
                        panel ? { matchId: item.id, panel } : null
                      )
                    }
                  />
                </article>
              );
            })}

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
