"use client";

import { ArenaShell } from "@/components/arena/arena-shell";
import { GlassCard } from "@/components/arena/glass-card";
import { useAuth } from "@/lib/auth-store";
import { useNews, useSeasonNewsPosts, type NewsItem, type SeasonNewsPost } from "@/lib/queries";
import { queryKeys } from "@/lib/queries/query-keys";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { NewsListSkeleton } from "@/components/skeletons";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import {
  NewsReactionBarMock,
  type NewsReactionOverlayPanel,
} from "@/components/news/news-reaction-bar-mock";
import { useMemo, useState } from "react";
import { Trash2, Trophy } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { adminDeleteSeasonNewsPost } from "@/app/actions/seasons";

type MergedNewsItem =
  | (NewsItem & { _sortDate: string; _kind: "resultado" })
  | (SeasonNewsPost & { _sortDate: string; _kind: "temporada" });

export default function NoticiasPage() {
  const { user, loading: authLoading, canAccessAdmin } = useAuth();
  const queryClient = useQueryClient();
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNews(user?.id, !authLoading);
  const { data: seasonPosts, isLoading: seasonLoading } = useSeasonNewsPosts(!authLoading && !!user);

  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    postId: string | null;
    title: string;
  }>({ isOpen: false, postId: null, title: "" });
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.postId) return;
    setDeleteLoading(true);
    setDeleteError(null);
    const result = await adminDeleteSeasonNewsPost(deleteConfirm.postId);
    setDeleteLoading(false);
    if (!result.success) {
      setDeleteError(result.error);
      return false;
    }
    void queryClient.invalidateQueries({ queryKey: queryKeys.seasonNews });
    setDeleteConfirm({ isOpen: false, postId: null, title: "" });
  };

  const isPageLoading = authLoading || isLoading || seasonLoading;

  if (isPageLoading) {
    return (
      <ArenaShell title="Notícias" subtitle="Feed de resultados e destaques" showBack>
        <NewsListSkeleton count={4} />
      </ArenaShell>
    );
  }

  if (error) {
    return (
      <ArenaShell title="Notícias" subtitle="Feed de resultados e destaques" showBack>
        <p className="py-8 text-center text-sm text-(--state-noshow)">
          Erro ao carregar notícias. Tente novamente.
        </p>
      </ArenaShell>
    );
  }

  return (
    <ArenaShell title="Notícias" subtitle="Feed de resultados e destaques" showBack>
      <div className="space-y-4">
        {merged.length === 0 ? (
          <p className="py-8 text-center text-sm text-(--arena-muted)">
            Nenhum resultado registrado ainda. Jogue partidas para ver o feed!
          </p>
        ) : (
          <>
            {merged.map((item) => {
              if (item._kind === "temporada") {
                return (
                  <GlassCard
                    key={`season-${item.id}`}
                    glow="scheduled"
                    style={{
                      background: "color-mix(in srgb, var(--state-scheduled) 10%, var(--glass-bg))",
                      borderColor: "color-mix(in srgb, var(--state-scheduled) 30%, transparent)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold"
                        style={{ background: "color-mix(in srgb, var(--state-scheduled) 18%, transparent)", color: "var(--state-scheduled)" }}
                      >
                        <Trophy className="h-3 w-3" />
                        Temporada
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-(--arena-muted)">
                          {formatTimeAgo(item.createdAt)}
                        </span>
                        {canAccessAdmin && (
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteConfirm({
                                isOpen: true,
                                postId: item.id,
                                title: item.title,
                              })
                            }
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-(--arena-muted) transition hover:bg-(--state-noshow)/15 hover:text-(--state-noshow)"
                            aria-label="Remover notícia"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="font-semibold text-(--arena-foreground)">{item.title}</p>
                    {item.resumo && (
                      <p className="mt-1 text-sm text-(--arena-muted)">{item.resumo}</p>
                    )}
                  </GlassCard>
                );
              }

              // item._kind === "resultado"
              return (
                <GlassCard key={item.id} className="space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-(--arena-primary)/15 px-3 py-1 text-[11px] font-semibold text-(--arena-primary)">
                      Resultado
                    </span>
                    <span className="text-xs text-(--arena-muted)">
                      {formatTimeAgo(item.createdAt)}
                    </span>
                  </div>

                  {/* Confronto */}
                  <div className="flex items-center justify-between">
                    <div className="flex-1 text-center">
                      <p className="text-sm font-semibold text-(--state-played)">{item.winner.name}</p>
                      <p className="text-[11px] text-(--arena-muted)">Vencedor</p>
                    </div>
                    <div className="px-4">
                      <p className="text-2xl font-bold text-(--arena-primary)">{item.score}</p>
                    </div>
                    <div className="flex-1 text-center">
                      <p className="text-sm font-semibold text-(--state-noshow)">{item.loser.name}</p>
                      <p className="text-[11px] text-(--arena-muted)">Perdedor</p>
                    </div>
                  </div>

                  {/* Pontuação */}
                  <div className="flex items-center justify-center gap-6 rounded-xl bg-(--glass-bg) p-2">
                    <div className="text-center">
                      <p className="text-[11px] text-(--arena-muted)">Pts ganhos</p>
                      <p className="text-sm font-semibold text-(--state-played)">+{Math.abs(item.pointsWinner)} pts</p>
                    </div>
                    <div className="h-6 w-px bg-(--glass-border)" />
                    <div className="text-center">
                      <p className="text-[11px] text-(--arena-muted)">Pts perdidos</p>
                      <p className="text-sm font-semibold text-(--state-noshow)">-{Math.abs(item.pointsLoser)} pts</p>
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
                </GlassCard>
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

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => {
          setDeleteConfirm({ isOpen: false, postId: null, title: "" });
          setDeleteError(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Remover notícia"
        description={`Tem certeza que deseja remover "${deleteConfirm.title}"? Esta ação não pode ser desfeita.`}
        confirmText="Remover"
        variant="danger"
        loading={deleteLoading}
        errorMessage={deleteError ?? undefined}
      />
    </ArenaShell>
  );
}
