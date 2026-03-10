"use client";

import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-store";
import { useHomeHighlights, useRanking, useMatches } from "@/lib/queries";
import { HomePageSkeleton, PendingMatchListSkeleton } from "@/components/skeletons";
import Link from "next/link";
import { useMemo } from "react";
import { getPlayerStyle } from "@/lib/divisions";

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const { data: rankingData, isLoading: rankingLoading } = useRanking(user?.id);
  const { data: matchesData, isLoading: matchesLoading } = useMatches(user?.id);
  const { data: highlightsData, isLoading: highlightsLoading } = useHomeHighlights();

  // Flatten paginated data
  const ranking = useMemo(() => {
    return rankingData?.pages.flatMap((page) => page.users) ?? [];
  }, [rankingData]);

  const matches = useMemo(() => {
    return matchesData?.pages.flatMap((page) => page.matches) ?? [];
  }, [matchesData]);

  const streakHighlight = highlightsData?.streakLeader ?? null;
  const weeklyActivityHighlight = highlightsData?.weeklyActivityLeader ?? null;

  const isLoading = authLoading || rankingLoading;

  // Top 3 do ranking
  const topRanking = ranking.slice(0, 3).map((player, index) => ({
    pos: index + 1,
    nome: player.full_name || player.name || player.email?.split("@")[0] || "Jogador",
    pts: player.rating_atual ?? 250,
    vitorias: player.vitorias || 0,
    derrotas: player.derrotas || 0,
  }));

  // Dados do usuário atual
  const userRankPosition = ranking.findIndex((p) => p.id === user?.id) + 1;
  const userStats = ranking.find((p) => p.id === user?.id);

  // Partidas pendentes do usuário
  const pendingMatches = matches
    .filter((m) => m.status === "pendente" || m.status === "edited")
    .slice(0, 3);

  // Partidas recentes (validadas)
  const recentMatches = matches
    .filter((m) => m.status === "validado")
    .slice(0, 3);

  const getPlayerName = (player: { full_name: string | null; name: string | null; email: string | null }) => {
    return player.full_name || player.name || player.email?.split("@")[0] || "Jogador";
  };

  if (isLoading) {
    return (
      <AppShell title="Visão geral" subtitle="Carregando..." showBack={false}>
        <HomePageSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Visão geral"
      subtitle="Atalhos rápidos para Ranking, Partidas e Estatísticas"
      showBack={false}
    >
      <div className="flex flex-col gap-4">
        {/* Card principal - Seus pontos */}
        <article className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Seus pontos</p>
              <p className="text-3xl font-bold text-foreground">
                {userStats?.rating_atual ?? user?.rating ?? 250}
              </p>
            </div>
            <div className="text-right">
              <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                #{userRankPosition > 0 ? userRankPosition : "-"} no ranking
              </span>
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="text-green-600 font-semibold">{userStats?.vitorias || 0}V</span>
                {" / "}
                <span className="text-red-500 font-semibold">{userStats?.derrotas || 0}D</span>
              </p>
            </div>
          </div>
        </article>

        {/* Destaques */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-sm font-semibold text-foreground">Destaques da Semana</p>
            <p className="text-[11px] text-muted-foreground">Últimos 7 dias</p>
          </div>
          {highlightsLoading ? (
            <div className="grid grid-cols-2 gap-2">
              <article className="h-[104px] animate-pulse rounded-xl border border-orange-100 bg-orange-50/60 p-3" />
              <article className="h-[104px] animate-pulse rounded-xl border border-sky-100 bg-sky-50/60 p-3" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <HighlightCard
                title="Em Chamas"
                emoji="🔥"
                tone="fire"
                playerName={streakHighlight?.userName ?? null}
                metricPrimary={
                  streakHighlight
                    ? `${streakHighlight.streak} vitórias seguidas`
                    : "Sem sequência ativa"
                }
              />
              <HighlightCard
                title="Mais ativo"
                emoji="📅"
                tone="sky"
                playerName={weeklyActivityHighlight?.userName ?? null}
                metricPrimary={
                  weeklyActivityHighlight
                    ? `${weeklyActivityHighlight.matches} partidas`
                    : "Sem partidas na semana"
                }
              />
            </div>
          )}
        </div>

        {/* Top 3 Ranking (Divisão Ouro) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <p className="text-sm font-semibold text-foreground">Top Ranking</p>
            <Link href="/ranking" className="text-xs font-semibold text-primary hover:underline">
              Ver todos
            </Link>
          </div>
          {topRanking.length > 0 ? (
            topRanking.map((player) => {
              const playerStyle = getPlayerStyle(player.pos);

              return (
                <article
                  key={player.pos}
                  className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border p-3 shadow-sm ${playerStyle.border} ${playerStyle.bg}`}
                >
                  <div
                    className={`relative flex h-10 w-10 items-center justify-center rounded-full ${playerStyle.badge} shadow-lg shadow-orange-500/50`}
                  >
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-400/30 via-orange-500/20 to-red-500/30 blur-sm" />
                    <span className="relative text-sm font-bold text-white drop-shadow-md">
                      {player.pos}º
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                      <p
                        className={`min-w-0 break-words text-sm font-semibold leading-tight ${playerStyle.text}`}
                      >
                        {player.nome}
                      </p>
                      <span
                        className={`inline-flex w-fit shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm ${playerStyle.badge}`}
                      >
                        🔥 TOP {player.pos}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <span className="text-green-600">{player.vitorias}V</span>
                      {" / "}
                      <span className="text-red-500">{player.derrotas}D</span>
                    </p>
                  </div>
                  <p className={`min-w-[3.5rem] shrink-0 text-right text-lg font-bold tabular-nums ${playerStyle.text}`}>
                    {player.pts}
                  </p>
                </article>
              );
            })
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhum jogador no ranking ainda
            </p>
          )}
        </div>

        {/* Partidas pendentes */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <p className="text-sm font-semibold text-foreground">Partidas pendentes</p>
            <Link href="/partidas" className="text-xs font-semibold text-primary hover:underline">
              Ver todas
            </Link>
          </div>
          {!user ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Faça login para ver suas partidas
            </p>
          ) : matchesLoading ? (
            <PendingMatchListSkeleton count={2} />
          ) : pendingMatches.length > 0 ? (
            pendingMatches.map((match) => {
              const opponent = match.player_a_id === user.id ? match.player_b : match.player_a;
              const euCriei = match.criado_por === user.id;
              return (
                <article
                  key={match.id}
                  className="space-y-2 rounded-2xl border border-border bg-muted/60 p-3 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">
                      vs {getPlayerName(opponent)}
                    </p>
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                        euCriei
                          ? "bg-amber-100 text-amber-700"
                          : "bg-primary/15 text-primary"
                      }`}
                    >
                      {euCriei ? "Aguardando" : "Ação necessária"}
                    </span>
                  </div>
                  <p className="text-center text-lg font-bold">
                    {match.resultado_a} x {match.resultado_b}
                  </p>
                </article>
              );
            })
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhuma partida pendente
            </p>
          )}
        </div>

        {/* Resultados recentes */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <p className="text-sm font-semibold text-foreground">Resultados recentes</p>
            <Link href="/partidas" className="text-xs font-semibold text-primary hover:underline">
              Ver histórico
            </Link>
          </div>
          {!user ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Faça login para ver seu histórico
            </p>
          ) : recentMatches.length > 0 ? (
            recentMatches.map((match) => {
              const euSouA = match.player_a_id === user.id;
              const euVenci = match.vencedor_id === user.id;
              const meusPoints = euSouA ? match.pontos_variacao_a : match.pontos_variacao_b;

              return (
                <article
                  key={match.id}
                  className="space-y-2 rounded-2xl border border-border bg-card p-3 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {new Date(match.created_at).toLocaleDateString("pt-BR")}
                    </p>
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                        euVenci
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {euVenci ? "Vitória" : "Derrota"}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {getPlayerName(match.player_a)}{" "}
                    <span className="text-primary">
                      {match.resultado_a} x {match.resultado_b}
                    </span>{" "}
                    {getPlayerName(match.player_b)}
                  </p>
                  {meusPoints !== undefined && meusPoints !== null && (
                    <p className={`text-xs font-semibold ${euVenci ? "text-green-600" : "text-red-500"}`}>
                      {meusPoints >= 0 ? `+${meusPoints}` : meusPoints} pts
                    </p>
                  )}
                </article>
              );
            })
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhum resultado registrado ainda
            </p>
          )}
        </div>

        {/* Ações rápidas */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Link
            href="/registrar-jogo"
            className="block rounded-2xl border border-border bg-primary p-4 text-center shadow-sm transition hover:scale-[1.01]"
          >
            <p className="text-sm font-semibold text-primary-foreground">Registrar Jogo</p>
            <p className="text-xs text-primary-foreground/70">Nova partida</p>
          </Link>
          <Link
            href="/ranking"
            className="block rounded-2xl border border-border bg-card p-4 text-center shadow-sm transition hover:border-primary"
          >
            <p className="text-sm font-semibold text-foreground">Ver Ranking</p>
            <p className="text-xs text-muted-foreground">Classificação</p>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

type HighlightCardTone = "fire" | "sky";

type HighlightCardProps = {
  title: string;
  emoji: string;
  tone: HighlightCardTone;
  playerName: string | null;
  metricPrimary: string;
};

function HighlightCard({
  title,
  emoji,
  tone,
  playerName,
  metricPrimary,
}: HighlightCardProps) {
  const metricMatch = metricPrimary.match(/^(\d+)\s+(.+)$/);
  const metricValue = metricMatch ? metricMatch[1] : null;
  const metricLabel = metricMatch ? metricMatch[2] : metricPrimary;

  const toneClasses =
    tone === "fire"
      ? {
          container: "border-orange-200 bg-white",
          accentBar: "bg-orange-400",
          chip: "bg-orange-100 text-orange-700",
          metricCard: "border-orange-200/80 bg-orange-50/60",
          metricValue: "text-orange-700",
          metricLabel: "text-zinc-700",
          player: "text-zinc-800",
        }
      : {
          container: "border-sky-200 bg-white",
          accentBar: "bg-sky-400",
          chip: "bg-sky-100 text-sky-700",
          metricCard: "border-sky-200/80 bg-sky-50/60",
          metricValue: "text-sky-700",
          metricLabel: "text-slate-700",
          player: "text-slate-800",
        };

  return (
    <article className={`overflow-hidden rounded-xl border shadow-sm ${toneClasses.container}`}>
      <div className="grid grid-cols-[3px_minmax(0,1fr)]">
        <div className={toneClasses.accentBar} />
        <div className="space-y-1.5 p-2.5">
          <div className="min-w-0">
            <span
              className={`flex w-full items-center gap-1 overflow-hidden whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${toneClasses.chip}`}
            >
              <span className="shrink-0">{emoji}</span>
              <span className="truncate">{title}</span>
            </span>
          </div>

          <p className={`truncate text-[11px] font-medium ${toneClasses.player}`}>
            {playerName || "Ainda sem líder"}
          </p>

          <div className={`rounded-lg border px-2 py-1.5 text-center ${toneClasses.metricCard}`}>
            {metricValue ? (
              <>
                <p className={`text-3xl font-black leading-none tabular-nums ${toneClasses.metricValue}`}>
                  {metricValue}
                </p>
                <p className={`mt-0.5 text-[10px] font-medium ${toneClasses.metricLabel}`}>
                  {metricLabel}
                </p>
              </>
            ) : (
              <p className={`text-sm font-bold leading-tight ${toneClasses.metricLabel}`}>
                {metricPrimary}
              </p>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
