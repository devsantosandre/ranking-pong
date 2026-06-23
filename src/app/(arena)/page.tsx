"use client";

import { ArenaShell } from "@/components/arena/arena-shell";
import { GlassCard } from "@/components/arena/glass-card";
import { StatusPill } from "@/components/arena/status-pill";
import { useAuth } from "@/lib/auth-store";
import { useHomeHighlights, useRanking, useMatches, useRecentMatches } from "@/lib/queries";
import { useActiveSeason, useUserSeasonStanding } from "@/lib/queries/use-seasons";
import { useTournaments } from "@/lib/queries/use-tournaments";
import { useEvents } from "@/lib/queries/use-events";
import { LiveDot } from "@/components/arena/live-dot";
import { HomePageSkeleton, PendingMatchListSkeleton } from "@/components/skeletons";
import { getPlayerStyle } from "@/lib/divisions";
import Link from "next/link";
import { useMemo } from "react";
import { Flame, Trophy, ChevronRight, Swords, TrendingUp } from "lucide-react";

function formatSeasonCountdown(endsAt: string): string {
  const diffMs = new Date(endsAt).getTime() - Date.now();
  if (diffMs <= 0) return "encerrando…";
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days > 1) return `${days} dias`;
  if (days === 1) return "1 dia";
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  return hours > 1 ? `${hours} horas` : "menos de 1 hora";
}

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const { data: rankingData, isLoading: rankingLoading } = useRanking(user?.id);
  const { data: matchesData, isLoading: matchesLoading } = useMatches(user?.id);
  const { data: recentMatchesData, isLoading: recentMatchesLoading } = useRecentMatches(user?.id);
  const { data: highlightsData, isLoading: highlightsLoading } = useHomeHighlights();
  const { data: activeSeason } = useActiveSeason();
  const { data: userSeasonStanding } = useUserSeasonStanding(activeSeason?.id, user?.id);
  const { data: tournamentsData } = useTournaments();
  const { data: eventsData } = useEvents();

  const ranking = useMemo(
    () => rankingData?.pages.flatMap((p) => p.users) ?? [],
    [rankingData],
  );
  const matches = useMemo(
    () => matchesData?.pages.flatMap((p) => p.matches) ?? [],
    [matchesData],
  );
  const recentMatches = useMemo(
    () => recentMatchesData?.pages.flatMap((p) => p.matches).slice(0, 3) ?? [],
    [recentMatchesData],
  );

  const streakHighlight = highlightsData?.streakLeader ?? null;
  const weeklyHighlight = highlightsData?.weeklyActivityLeader ?? null;
  const isLoading = authLoading || rankingLoading;

  // Destaque "em andamento": considera eventos (com categorias) E torneios avulsos,
  // igual à listagem. Prioriza quem tem jogo AO VIVO agora (hasLiveMatch — só os
  // eventos expõem esse sinal); desempate determinístico pelo mais recente.
  const liveHighlight = useMemo(() => {
    const candidates = [
      ...(eventsData ?? [])
        .filter((e) => e.status === "active")
        .map((e) => ({
          name: e.name,
          live: e.hasLiveMatch,
          ts: new Date(e.eventDate ?? e.createdAt).getTime(),
        })),
      ...(tournamentsData ?? [])
        .filter((t) => t.status === "active")
        .map((t) => ({
          name: t.name,
          live: false,
          ts: new Date(t.createdAt).getTime(),
        })),
    ];
    candidates.sort((a, b) => Number(b.live) - Number(a.live) || b.ts - a.ts);
    const liveCount = candidates.filter((c) => c.live).length;
    return candidates[0] ? { ...candidates[0], liveCount } : null;
  }, [eventsData, tournamentsData]);
  const lastChampionTournament = useMemo(() => {
    if (!tournamentsData) return null;
    return (
      [...tournamentsData]
        .filter((t) => t.status === "finished" && t.championName)
        .sort(
          (a, b) =>
            new Date(b.finishedAt ?? b.createdAt).getTime() -
            new Date(a.finishedAt ?? a.createdAt).getTime(),
        )[0] ?? null
    );
  }, [tournamentsData]);

  const topRanking = ranking.slice(0, 3).map((player, i) => ({
    pos: i + 1,
    nome: player.full_name || player.name || player.email?.split("@")[0] || "Jogador",
    pts: player.rating_atual ?? 250,
    vitorias: player.vitorias || 0,
    derrotas: player.derrotas || 0,
  }));

  const userRankPosition = ranking.findIndex((p) => p.id === user?.id) + 1;
  const userStats = ranking.find((p) => p.id === user?.id);
  const pendingMatches = matches
    .filter((m) => m.status === "pendente" || m.status === "edited")
    .slice(0, 3);

  const getName = (p: { full_name: string | null; name: string | null; email: string | null }) =>
    p.full_name || p.name || p.email?.split("@")[0] || "Jogador";

  if (isLoading) {
    return (
      <ArenaShell title="Arena" showBack={false}>
        <HomePageSkeleton />
      </ArenaShell>
    );
  }

  return (
    <ArenaShell title="Arena" showBack={false}>
      <div className="flex flex-col gap-4">

        {/* Hero — pontos do usuário */}
        <GlassCard variant="elevated" className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 rounded-[inherit]"
            style={{
              background:
                "radial-gradient(ellipse 120% 80% at 80% 50%, color-mix(in srgb,var(--arena-primary) 8%,transparent) 0%, transparent 70%)",
            }}
            aria-hidden
          />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)">
                Seus pontos
              </p>
              <p
                className="mt-1 text-4xl font-bold tabular-nums"
                style={{
                  color: "var(--arena-foreground)",
                  fontFamily: "var(--font-display)",
                }}
              >
                {userStats?.rating_atual ?? user?.rating ?? 250}
              </p>
              <p className="mt-1 text-xs text-(--arena-muted)">
                <span className="font-semibold" style={{ color: "var(--state-played)" }}>
                  {userStats?.vitorias || 0}V
                </span>
                {" / "}
                <span className="font-semibold" style={{ color: "var(--state-noshow)" }}>
                  {userStats?.derrotas || 0}D
                </span>
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold tabular-nums"
                style={{
                  background: "color-mix(in srgb,var(--arena-primary) 15%,transparent)",
                  color: "var(--arena-primary)",
                  border: "1px solid color-mix(in srgb,var(--arena-primary) 25%,transparent)",
                }}
              >
                <Trophy className="h-3 w-3" />
                #{userRankPosition > 0 ? userRankPosition : "–"} no ranking
              </span>
            </div>
          </div>
        </GlassCard>

        {/* Cartão de temporada */}
        {activeSeason && (
          <Link href="/ranking">
            <GlassCard
              noPadding
              glow="scheduled"
              className="group flex items-center gap-3 px-3 py-3 transition-all hover:scale-[1.01]"
            >
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: "color-mix(in srgb, var(--state-scheduled) 14%, transparent)",
                }}
              >
                <Trophy className="h-5 w-5" style={{ color: "var(--state-scheduled)" }} />
              </div>
              <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-(--state-scheduled)">
                    Temporada ativa
                  </p>
                  <p className="mt-0.5 truncate text-sm font-bold text-(--arena-foreground)">
                    {activeSeason.name}
                  </p>
                  {userSeasonStanding ? (
                    <p className="text-xs text-(--state-scheduled)/80">
                      {userSeasonStanding.position != null
                        ? `${userSeasonStanding.position}º lugar · `
                        : ""}
                      <span className="font-semibold text-(--state-scheduled)">
                        {userSeasonStanding.points} pts
                      </span>
                    </p>
                  ) : (
                    <p className="text-xs text-(--state-scheduled)/70">
                      Nenhum jogo na temporada ainda
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <StatusPill
                    kind="scheduled"
                    label={formatSeasonCountdown(activeSeason.ends_at)}
                  />
                  <ChevronRight className="h-4 w-4 shrink-0 text-(--state-scheduled)/70 transition group-hover:translate-x-0.5" />
                </div>
            </GlassCard>
          </Link>
        )}

        {/* Torneios — resumo compacto */}
        {liveHighlight ? (
          <Link href="/torneios">
            <GlassCard
              noPadding
              glow="active"
              className="group flex items-center gap-3 px-3 py-3 transition-all hover:scale-[1.01]"
            >
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "color-mix(in srgb,var(--state-active) 14%,transparent)" }}
              >
                <Trophy className="h-5 w-5" style={{ color: "var(--state-active)" }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-(--state-active)">
                  Torneio em andamento
                </p>
                <p className="truncate text-sm font-bold text-(--arena-foreground)">
                  {liveHighlight.name}
                </p>
                {liveHighlight.liveCount > 1 && (
                  <p className="truncate text-[11px] text-(--arena-muted)">
                    +{liveHighlight.liveCount - 1} ao vivo agora
                  </p>
                )}
              </div>
              {liveHighlight.live && <LiveDot />}
              <StatusPill kind="active" label={liveHighlight.live ? "Ao vivo" : "Ativo"} pulse={liveHighlight.live} />
              <ChevronRight className="h-4 w-4 shrink-0 text-(--arena-muted) transition group-hover:translate-x-0.5" />
            </GlassCard>
          </Link>
        ) : lastChampionTournament ? (
          <Link href="/torneios/historico">
            <GlassCard
              noPadding
              className="group flex items-center gap-3 px-3 py-3 transition-all hover:scale-[1.01]"
            >
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "color-mix(in srgb,var(--state-scheduled) 14%,transparent)" }}
              >
                <Trophy className="h-5 w-5" style={{ color: "var(--state-scheduled)" }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-(--state-scheduled)">
                  Último campeão
                </p>
                <p className="truncate text-sm font-bold text-(--arena-foreground)">
                  {lastChampionTournament.championName}
                </p>
                <p className="truncate text-[11px] text-(--arena-muted)">
                  {lastChampionTournament.name}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-(--arena-muted) transition group-hover:translate-x-0.5" />
            </GlassCard>
          </Link>
        ) : null}

        {/* Destaques da semana */}
        <div className="space-y-2">
          <p
            className="px-1 text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)"
          >
            Destaques da Semana
          </p>
          {highlightsLoading ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="glass h-[88px] animate-pulse rounded-2xl" />
              <div className="glass h-[88px] animate-pulse rounded-2xl" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <ArenaHighlightCard
                icon={<Flame className="h-3.5 w-3.5" style={{ color: "var(--state-scheduled)" }} />}
                title="Em Chamas"
                playerName={streakHighlight?.userName ?? null}
                metric={streakHighlight ? `${streakHighlight.streak}` : "–"}
                metricLabel="vitórias seguidas"
                accentColor="var(--state-scheduled)"
              />
              <ArenaHighlightCard
                icon={<TrendingUp className="h-3.5 w-3.5" style={{ color: "var(--state-active)" }} />}
                title="Mais Ativo"
                playerName={weeklyHighlight?.userName ?? null}
                metric={weeklyHighlight ? `${weeklyHighlight.matches}` : "–"}
                metricLabel="partidas na semana"
                accentColor="var(--state-active)"
              />
            </div>
          )}
        </div>

        {/* Top 3 Ranking */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)">
              Top Ranking
            </p>
            <Link
              href="/ranking"
              className="text-xs font-semibold"
              style={{ color: "var(--arena-primary)" }}
            >
              Ver todos →
            </Link>
          </div>
          {topRanking.map((player) => {
            const style = getPlayerStyle(player.pos);
            const isTop3 = player.pos <= 3;
            return (
              <GlassCard
                key={player.pos}
                noPadding
                className="flex items-center gap-3 px-3 py-2.5"
              >
                <div
                  className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${style.badge} shadow-md`}
                >
                  {isTop3 && (
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-400/30 via-orange-500/20 to-red-500/30 blur-sm" />
                  )}
                  <span className="relative text-sm font-bold text-white drop-shadow">{player.pos}º</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-(--arena-foreground)">
                    {player.nome}
                  </p>
                  <p className="text-[11px] text-(--arena-muted)">
                    <span style={{ color: "var(--state-played)" }}>{player.vitorias}V</span>
                    {" / "}
                    <span style={{ color: "var(--state-noshow)" }}>{player.derrotas}D</span>
                  </p>
                </div>
                <p
                  className="shrink-0 text-lg font-bold tabular-nums text-(--arena-foreground)"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {player.pts}
                </p>
              </GlassCard>
            );
          })}
        </div>

        {/* Partidas pendentes */}
        {user && pendingMatches.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)">
                Pendências
              </p>
              <Link href="/partidas" className="text-xs font-semibold" style={{ color: "var(--arena-primary)" }}>
                Ver todas →
              </Link>
            </div>
            {matchesLoading ? (
              <PendingMatchListSkeleton count={2} />
            ) : (
              pendingMatches.map((match) => {
                const opponent = match.player_a_id === user.id ? match.player_b : match.player_a;
                const euCriei = match.criado_por === user.id;
                return (
                  <GlassCard
                    key={match.id}
                    noPadding
                    className="flex items-center gap-3 px-3 py-2.5"
                    glow={euCriei ? "none" : "active"}
                  >
                    <Swords className="h-4 w-4 shrink-0 text-(--arena-muted)" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-semibold text-(--arena-foreground)">
                        vs {getName(opponent)}
                      </p>
                      <p className="text-xs text-(--arena-muted) tabular-nums">
                        {match.resultado_a} × {match.resultado_b}
                      </p>
                    </div>
                    <StatusPill kind={euCriei ? "scheduled" : "active"} label={euCriei ? "Aguardando" : "Ação necessária"} />
                  </GlassCard>
                );
              })
            )}
          </div>
        )}

        {/* Resultados recentes */}
        {user && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)">
                Últimos Resultados
              </p>
              <Link href="/partidas" className="text-xs font-semibold" style={{ color: "var(--arena-primary)" }}>
                Ver histórico →
              </Link>
            </div>
            {recentMatchesLoading ? (
              <PendingMatchListSkeleton count={2} />
            ) : recentMatches.length > 0 ? (
              recentMatches.map((match) => {
                const euSouA = match.player_a_id === user.id;
                const euVenci = match.vencedor_id === user.id;
                const isCancelled = match.status === "cancelado";
                const meusPoints = euSouA ? match.pontos_variacao_a : match.pontos_variacao_b;

                return (
                  <GlassCard
                    key={match.id}
                    noPadding
                    className="flex items-center gap-3 px-3 py-2.5"
                  >
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg"
                      style={{
                        background: isCancelled
                          ? "color-mix(in srgb,var(--state-tbd) 15%,transparent)"
                          : euVenci
                            ? "color-mix(in srgb,var(--state-played) 15%,transparent)"
                            : "color-mix(in srgb,var(--state-noshow) 15%,transparent)",
                        color: isCancelled
                          ? "var(--state-tbd)"
                          : euVenci
                            ? "var(--state-played)"
                            : "var(--state-noshow)",
                      }}
                    >
                      {isCancelled ? "↩" : euVenci ? "✓" : "✗"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-semibold text-(--arena-foreground)">
                        {getName(match.player_a)}{" "}
                        <span className="tabular-nums" style={{ color: "var(--arena-primary)" }}>
                          {match.resultado_a}–{match.resultado_b}
                        </span>{" "}
                        {getName(match.player_b)}
                      </p>
                      <p className="text-[11px] text-(--arena-muted)">
                        {new Date(match.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    {!isCancelled && meusPoints != null && (
                      <p
                        className="shrink-0 text-xs font-bold tabular-nums"
                        style={{
                          color: meusPoints >= 0 ? "var(--state-played)" : "var(--state-noshow)",
                        }}
                      >
                        {meusPoints >= 0 ? `+${meusPoints}` : meusPoints}
                      </p>
                    )}
                  </GlassCard>
                );
              })
            ) : (
              <p className="py-4 text-center text-sm text-(--arena-muted)">
                Nenhum resultado registrado ainda
              </p>
            )}
          </div>
        )}

        {/* Ações rápidas */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <Link
            href="/registrar-jogo"
            className="glass flex flex-col items-center gap-1 py-4 text-center transition hover:scale-[1.02]"
            style={{
              background: "color-mix(in srgb,var(--arena-primary) 15%,transparent)",
              borderColor: "color-mix(in srgb,var(--arena-primary) 30%,transparent)",
            }}
          >
            <Swords className="h-5 w-5" style={{ color: "var(--arena-primary)" }} />
            <p className="text-sm font-semibold text-(--arena-foreground)">Registrar Jogo</p>
            <p className="text-[11px] text-(--arena-muted)">Nova partida</p>
          </Link>
          <Link
            href="/ranking"
            className="glass flex flex-col items-center gap-1 py-4 text-center transition hover:scale-[1.02]"
          >
            <Trophy className="h-5 w-5" style={{ color: "var(--arena-primary)" }} />
            <p className="text-sm font-semibold text-(--arena-foreground)">Ver Ranking</p>
            <p className="text-[11px] text-(--arena-muted)">Classificação</p>
          </Link>
        </div>
      </div>
    </ArenaShell>
  );
}

function ArenaHighlightCard({
  icon,
  title,
  playerName,
  metric,
  metricLabel,
  accentColor,
}: {
  icon: React.ReactNode;
  title: string;
  playerName: string | null;
  metric: string;
  metricLabel: string;
  accentColor: string;
}) {
  return (
    <GlassCard noPadding className="overflow-hidden">
      <div
        className="h-0.5 w-full"
        style={{ background: accentColor }}
      />
      <div className="space-y-1.5 p-2.5">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-[10px] font-semibold uppercase tracking-wide text-(--arena-muted)">
            {title}
          </span>
        </div>
        <p className="truncate text-[11px] font-medium text-(--arena-foreground)">
          {playerName || "Ainda sem líder"}
        </p>
        <div
          className="rounded-lg px-2 py-1 text-center"
          style={{
            background: `color-mix(in srgb,${accentColor} 10%,transparent)`,
            border: `1px solid color-mix(in srgb,${accentColor} 20%,transparent)`,
          }}
        >
          <p
            className="text-2xl font-black leading-none tabular-nums"
            style={{ color: accentColor, fontFamily: "var(--font-display)" }}
          >
            {metric}
          </p>
          <p className="mt-0.5 text-[10px] text-(--arena-muted)">{metricLabel}</p>
        </div>
      </div>
    </GlassCard>
  );
}
