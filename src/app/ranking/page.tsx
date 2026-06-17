"use client";

import { AppShell } from "@/components/app-shell";
import { ChevronRight, Search, X, Clock, Trophy } from "lucide-react";
import { memo, useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  useHeadToHeadStats,
  usePlayerValidatedMatches,
  usePlayerSeasonMatches,
  useRankingAll,
  useTotalValidatedMatches,
  useActiveSeason,
  useSeasonStandings,
  type PlayerValidatedMatch,
  type PlayerSeasonMatch,
} from "@/lib/queries";
import { PlayerListSkeleton } from "@/components/skeletons";
import { useAuth } from "@/lib/auth-store";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  getPlayerStyle,
  getDivisionStyle,
  getDivisionNumber,
  getDivisionName,
  isTopThree,
} from "@/lib/divisions";

// ─── helpers ────────────────────────────────────────────────────────────────

function getDisplayName(user: {
  full_name: string | null;
  name: string | null;
  email: string | null;
}) {
  return user.full_name || user.name || user.email?.split("@")[0] || "Jogador";
}

function formatSheetDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCountdown(endsAt: string): string {
  const diffMs = new Date(endsAt).getTime() - Date.now();
  if (diffMs <= 0) return "encerrando…";
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 1) return `${days} dias`;
  if (days === 1) return "1 dia";
  if (hours > 1) return `${hours} horas`;
  return "menos de 1 hora";
}

function getSeasonProgress(startsAt: string, endsAt: string): number {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  const now = Date.now();
  if (end <= start) return 100;
  return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
}

// ─── componente de card de jogador (reutilizado nas duas abas) ───────────────

type RankingPlayerCardProps = {
  position: number;
  displayName: string;
  wins: number;
  losses: number;
  metric: number;
  metricLabel: string;
  canOpenH2H: boolean;
  onClick: () => void;
  showDivisionSeparator: boolean;
};

const RankingPlayerCard = memo(function RankingPlayerCard({
  position,
  displayName,
  wins,
  losses,
  metric,
  metricLabel,
  canOpenH2H,
  onClick,
  showDivisionSeparator,
}: RankingPlayerCardProps) {
  const playerStyle = getPlayerStyle(position);
  const divisionStyle = getDivisionStyle(position);
  const divisionNumber = getDivisionNumber(position);
  const divisionName = getDivisionName(position);
  const isTop3 = isTopThree(position);

  return (
    <div>
      {showDivisionSeparator && (
        <div className="flex items-center gap-2 py-2">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-semibold text-muted-foreground">
            {divisionStyle.emoji} {divisionName}
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
      )}

      <button
        type="button"
        onClick={() => canOpenH2H && onClick()}
        disabled={!canOpenH2H}
        className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border p-3 text-left shadow-sm transition ${
          canOpenH2H ? "cursor-pointer active:scale-[0.995]" : "cursor-default"
        } ${playerStyle.border} ${playerStyle.bg}`}
      >
        {/* Badge com posição */}
        <div
          className={`relative flex h-10 w-10 items-center justify-center rounded-full ${playerStyle.badge} ${isTop3 ? "shadow-lg shadow-orange-500/50" : "shadow-md"}`}
        >
          {isTop3 && (
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-400/30 via-orange-500/20 to-red-500/30 blur-sm" />
          )}
          <span
            className={`relative text-sm font-bold ${divisionNumber <= 3 || isTop3 ? "text-white drop-shadow-md" : "text-muted-foreground"}`}
          >
            {position}º
          </span>
        </div>

        {/* Info do jogador */}
        <div className="min-w-0">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <p className={`min-w-0 break-words text-sm font-semibold leading-tight ${playerStyle.text}`}>
              {displayName}
            </p>
            {isTop3 && (
              <span
                className={`inline-flex w-fit shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm ${playerStyle.badge}`}
              >
                🔥 TOP {position}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">{position}º</span>
            {" · "}
            <span className="text-green-600 font-semibold">{wins}V</span>
            {" / "}
            <span className="text-red-500 font-semibold">{losses}D</span>
          </p>
        </div>

        {/* Pontuação */}
        <div className="min-w-[4.5rem] shrink-0 text-right">
          <p className={`text-lg font-bold tabular-nums ${playerStyle.text}`}>
            {metric}
          </p>
          <p className="text-[11px] text-muted-foreground">{metricLabel}</p>
          {canOpenH2H && (
            <span className="mt-1 inline-flex items-center gap-0.5 rounded-full border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              H2H
              <ChevronRight className="h-3 w-3" />
            </span>
          )}
        </div>
      </button>
    </div>
  );
});

// ─── mini-card de posição na temporada (usado no H2H) ────────────────────────

const SeasonStandingMini = memo(function SeasonStandingMini({
  label,
  loading,
  standing,
}: {
  label: string;
  loading: boolean;
  standing: { position: number; points: number; wins: number; losses: number } | null;
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-white/70 p-3 text-center">
      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-amber-700/80">
        {label}
      </p>
      {loading ? (
        <p className="mt-2 text-xs text-muted-foreground">Carregando…</p>
      ) : standing ? (
        <>
          <p className="mt-1 text-2xl font-bold text-amber-900">{standing.position}º</p>
          <p className="text-xs text-amber-800">
            {standing.points} pts · {standing.wins}V {standing.losses}D
          </p>
        </>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">Ainda não pontuou</p>
      )}
    </div>
  );
});

// ─── página principal ────────────────────────────────────────────────────────

export default function RankingPage() {
  const { user } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const [activeTab, setActiveTab] = useState<"temporada" | "geral">("temporada");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [h2hTab, setH2hTab] = useState<"temporada" | "geral">("temporada");
  const sheetScrollRef = useRef<HTMLDivElement | null>(null);
  const historyGeneralSentinelRef = useRef<HTMLDivElement | null>(null);
  const historySeasonSentinelRef = useRef<HTMLDivElement | null>(null);
  const normalizedSearch = searchInput.trim().toLowerCase();
  const isSearching = normalizedSearch.length >= 2;

  // ── dados geral ──────────────────────────────────────────────────────────
  const { data: rankingData, isLoading: geralLoading, error: geralError } = useRankingAll(user?.id);
  const {
    data: totalValidatedMatches,
    isLoading: totalMatchesLoading,
    isFetching: totalMatchesFetching,
    isError: totalMatchesError,
  } = useTotalValidatedMatches();

  // ── dados temporada ──────────────────────────────────────────────────────
  const { data: activeSeason, isLoading: seasonLoading } = useActiveSeason();
  const { data: seasonStandings, isLoading: standingsLoading } = useSeasonStandings(activeSeason?.id);

  // ── lista geral ───────────────────────────────────────────────────────────
  const allPlayers = useMemo(
    () =>
      (rankingData ?? []).map((player, index) => ({
        ...player,
        position: index + 1,
        displayName: getDisplayName(player),
      })),
    [rankingData]
  );

  const players = useMemo(
    () =>
      isSearching
        ? allPlayers.filter((p) => p.displayName.toLowerCase().includes(normalizedSearch))
        : allPlayers,
    [allPlayers, isSearching, normalizedSearch]
  );

  // ── lista temporada ───────────────────────────────────────────────────────
  const allSeasonPlayers = useMemo(
    () =>
      (seasonStandings ?? []).map((entry) => ({
        ...entry,
        displayName: getDisplayName(entry),
      })),
    [seasonStandings]
  );

  const seasonPlayers = useMemo(
    () =>
      isSearching
        ? allSeasonPlayers.filter((p) => p.displayName.toLowerCase().includes(normalizedSearch))
        : allSeasonPlayers,
    [allSeasonPlayers, isSearching, normalizedSearch]
  );

  // ── jogador selecionado (H2H) ────────────────────────────────────────────
  const selectedPlayer = useMemo(
    () => allPlayers.find((p) => p.id === selectedPlayerId) ?? null,
    [allPlayers, selectedPlayerId]
  );

  // H2H stats — geral (sem filtro de temporada)
  const {
    data: h2hStats,
    isLoading: h2hLoading,
    error: h2hError,
  } = useHeadToHeadStats(
    user?.id,
    selectedPlayer && selectedPlayer.id !== user?.id ? selectedPlayer.id : undefined
  );

  // ── temporada no H2H ───────────────────────────────────────────────────────
  const mySeasonStanding = useMemo(
    () => (seasonStandings ?? []).find((s) => s.id === user?.id) ?? null,
    [seasonStandings, user?.id]
  );
  const opponentSeasonStanding = useMemo(
    () => (seasonStandings ?? []).find((s) => s.id === selectedPlayer?.id) ?? null,
    [seasonStandings, selectedPlayer?.id]
  );

  // H2H stats — recortado pela temporada ativa
  const { data: h2hSeasonStats, isLoading: h2hSeasonLoading } = useHeadToHeadStats(
    user?.id,
    activeSeason && selectedPlayer && selectedPlayer.id !== user?.id
      ? selectedPlayer.id
      : undefined,
    activeSeason?.id
  );

  // ── histórico geral do adversário ────────────────────────────────────────
  const {
    data: selectedPlayerMatchesData,
    isLoading: selectedPlayerMatchesLoading,
    error: selectedPlayerMatchesError,
    fetchNextPage: fetchNextPlayerMatchesPage,
    hasNextPage: hasNextPlayerMatchesPage,
    isFetchingNextPage: isFetchingNextPlayerMatchesPage,
  } = usePlayerValidatedMatches(selectedPlayer?.id);

  const selectedPlayerMatches = useMemo(
    () => selectedPlayerMatchesData?.pages.flatMap((p) => p.matches) ?? [],
    [selectedPlayerMatchesData]
  );
  const selectedPlayerMatchesTotal = useMemo(
    () => selectedPlayerMatchesData?.pages[0]?.totalCount ?? selectedPlayerMatches.length,
    [selectedPlayerMatchesData, selectedPlayerMatches.length]
  );

  // ── histórico da temporada do adversário ─────────────────────────────────
  const {
    data: selectedPlayerSeasonMatchesData,
    isLoading: selectedPlayerSeasonMatchesLoading,
    fetchNextPage: fetchNextSeasonMatchesPage,
    hasNextPage: hasNextSeasonMatchesPage,
    isFetchingNextPage: isFetchingNextSeasonMatchesPage,
  } = usePlayerSeasonMatches(selectedPlayer?.id, activeSeason?.id);

  const selectedPlayerSeasonMatches = useMemo(
    () => selectedPlayerSeasonMatchesData?.pages.flatMap((p) => p.matches) ?? [],
    [selectedPlayerSeasonMatchesData]
  );
  const selectedPlayerSeasonMatchesTotal = useMemo(
    () => selectedPlayerSeasonMatchesData?.pages[0]?.totalCount ?? selectedPlayerSeasonMatches.length,
    [selectedPlayerSeasonMatchesData, selectedPlayerSeasonMatches.length]
  );

  // ── IntersectionObserver — histórico geral ────────────────────────────────
  useEffect(() => {
    if (!selectedPlayerId || !hasNextPlayerMatchesPage || isFetchingNextPlayerMatchesPage) return;
    const root = sheetScrollRef.current;
    const sentinel = historyGeneralSentinelRef.current;
    if (!root || !sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting || isFetchingNextPlayerMatchesPage || !hasNextPlayerMatchesPage) return;
        void fetchNextPlayerMatchesPage();
      },
      { root, rootMargin: "180px 0px", threshold: 0.01 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchNextPlayerMatchesPage, hasNextPlayerMatchesPage, isFetchingNextPlayerMatchesPage, selectedPlayerId, selectedPlayerMatches.length]);

  // ── IntersectionObserver — histórico da temporada ─────────────────────────
  useEffect(() => {
    if (!selectedPlayerId || !hasNextSeasonMatchesPage || isFetchingNextSeasonMatchesPage) return;
    const root = sheetScrollRef.current;
    const sentinel = historySeasonSentinelRef.current;
    if (!root || !sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting || isFetchingNextSeasonMatchesPage || !hasNextSeasonMatchesPage) return;
        void fetchNextSeasonMatchesPage();
      },
      { root, rootMargin: "180px 0px", threshold: 0.01 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchNextSeasonMatchesPage, hasNextSeasonMatchesPage, isFetchingNextSeasonMatchesPage, selectedPlayerId, selectedPlayerSeasonMatches.length]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchInput("");
  }, []);

  const handleOpenH2H = useCallback((playerId: string) => {
    setSelectedPlayerId(playerId);
    setH2hTab("temporada");
  }, []);

  const handleSheetOpenChange = useCallback((open: boolean) => {
    if (!open) setSelectedPlayerId(null);
  }, []);

  // ── conteúdo Geral: confronto direto + posição/rating + histórico ─────────
  const generalHistorySection = selectedPlayer && user && selectedPlayer.id !== user.id ? (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">
          Todas as partidas de {selectedPlayer.displayName}
        </h3>
        {!selectedPlayerMatchesLoading && !selectedPlayerMatchesError && (
          <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {selectedPlayerMatchesTotal.toLocaleString("pt-BR")} jogos
          </span>
        )}
      </div>

      {selectedPlayerMatchesLoading ? (
        <p className="rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          Carregando partidas…
        </p>
      ) : selectedPlayerMatchesError ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          Erro ao carregar partidas do jogador.
        </p>
      ) : selectedPlayerMatches.length > 0 ? (
        <>
          <div className="space-y-2">
            {selectedPlayerMatches.map((match) => (
              <PlayerMatchHistoryCard
                key={match.id}
                match={match}
                playerId={selectedPlayer.id}
                loggedUserId={user?.id}
              />
            ))}
          </div>

          <div ref={historyGeneralSentinelRef} className="h-1 w-full" />

          {isFetchingNextPlayerMatchesPage && (
            <p className="rounded-xl border border-border bg-muted/40 p-3 text-center text-xs font-medium text-muted-foreground">
              Carregando mais partidas…
            </p>
          )}

          <LoadMoreButton
            onClick={() => fetchNextPlayerMatchesPage()}
            isLoading={isFetchingNextPlayerMatchesPage}
            hasMore={Boolean(hasNextPlayerMatchesPage)}
            className="py-1"
          />
        </>
      ) : (
        <p className="rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          Nenhuma partida validada encontrada para este jogador.
        </p>
      )}
    </section>
  ) : null;

  const generalH2HContent = h2hLoading ? (
    <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
      Carregando confronto…
    </p>
  ) : h2hError ? (
    <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
      Erro ao carregar confronto. Tente novamente.
    </p>
  ) : h2hStats && h2hStats.total > 0 ? (
    <div className="space-y-3 sm:space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-700 sm:text-3xl">{h2hStats.wins}</p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700/80">Você ganhou</p>
        </article>
        <article className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-2xl font-bold text-red-600 sm:text-3xl">{h2hStats.losses}</p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-red-600/80">Você perdeu</p>
        </article>
        <article className="col-span-2 rounded-xl border border-border bg-card p-4 text-center sm:col-span-1">
          <p className="text-2xl font-bold text-primary sm:text-3xl">{h2hStats.total}</p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-primary/80">Total</p>
        </article>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <p className="text-sm font-semibold text-muted-foreground">Aproveitamento</p>
          <p className="text-3xl font-bold text-foreground">{h2hStats.winRate}%</p>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${Math.max(0, Math.min(100, h2hStats.winRate))}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {h2hStats.wins} vitória{h2hStats.wins === 1 ? "" : "s"} em{" "}
          {h2hStats.total} confronto{h2hStats.total > 1 ? "s" : ""}
        </p>
        <p className="text-xs font-medium text-muted-foreground">
          {h2hStats.wins > h2hStats.losses
            ? "Você está em vantagem neste confronto."
            : h2hStats.wins < h2hStats.losses
              ? "Adversário em vantagem neste confronto."
              : "Confronto equilibrado entre vocês."}
        </p>
      </div>

      {/* Posição geral do adversário */}
      {selectedPlayer && (
        <div className="rounded-xl border border-border bg-muted/40 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Ranking geral
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {selectedPlayer.position}º no ranking •{" "}
            <span className="text-muted-foreground font-normal">
              {(selectedPlayer.rating_atual ?? 250).toLocaleString("pt-BR")} pts ELO
            </span>
          </p>
        </div>
      )}

      {generalHistorySection}
    </div>
  ) : (
    <div className="space-y-3">
      <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Vocês ainda não têm partidas validadas entre si.
      </p>

      {/* Posição geral do adversário mesmo sem confronto direto */}
      {selectedPlayer && (
        <div className="rounded-xl border border-border bg-muted/40 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Ranking geral
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {selectedPlayer.position}º no ranking •{" "}
            <span className="text-muted-foreground font-normal">
              {(selectedPlayer.rating_atual ?? 250).toLocaleString("pt-BR")} pts ELO
            </span>
          </p>
        </div>
      )}

      {generalHistorySection}
    </div>
  );

  // ── conteúdo Temporada: ranking + confronto + histórico da temporada ──────
  const seasonH2HContent =
    activeSeason && selectedPlayer && user && selectedPlayer.id !== user.id ? (
      <div className="space-y-3">
        <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
          <Trophy className="h-3.5 w-3.5 shrink-0" />
          {activeSeason.name}
        </p>

        {/* A — ranking da temporada lado a lado */}
        <div className="grid grid-cols-2 gap-2">
          <SeasonStandingMini
            label="Você"
            loading={standingsLoading}
            standing={mySeasonStanding}
          />
          <SeasonStandingMini
            label={selectedPlayer.displayName}
            loading={standingsLoading}
            standing={opponentSeasonStanding}
          />
        </div>

        {/* B — confronto direto recortado pela temporada */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700/80">
            Confronto direto nesta temporada
          </p>
          {h2hSeasonLoading ? (
            <p className="mt-1 text-xs text-muted-foreground">Carregando…</p>
          ) : h2hSeasonStats && h2hSeasonStats.total > 0 ? (
            <p className="mt-1 text-sm font-semibold text-amber-900">
              {h2hSeasonStats.wins}V × {h2hSeasonStats.losses}D{" "}
              <span className="font-normal text-amber-700/80">
                ({h2hSeasonStats.total} jogo{h2hSeasonStats.total > 1 ? "s" : ""})
              </span>
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Vocês ainda não se enfrentaram nesta temporada.
            </p>
          )}
        </div>

        {/* C — histórico de partidas da temporada */}
        <section className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/30 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-amber-900">
              Partidas na temporada
            </h3>
            {!selectedPlayerSeasonMatchesLoading && (
              <span className="shrink-0 rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                {selectedPlayerSeasonMatchesTotal.toLocaleString("pt-BR")} jogos
              </span>
            )}
          </div>

          {selectedPlayerSeasonMatchesLoading ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              Carregando partidas da temporada…
            </p>
          ) : selectedPlayerSeasonMatches.length > 0 ? (
            <>
              <div className="space-y-2">
                {selectedPlayerSeasonMatches.map((match) => (
                  <PlayerMatchHistoryCard
                    key={match.id}
                    match={match}
                    playerId={selectedPlayer.id}
                    loggedUserId={user?.id}
                    seasonPoints={match.season_points_player}
                  />
                ))}
              </div>

              <div ref={historySeasonSentinelRef} className="h-1 w-full" />

              {isFetchingNextSeasonMatchesPage && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-xs font-medium text-amber-700">
                  Carregando mais partidas…
                </p>
              )}

              <LoadMoreButton
                onClick={() => fetchNextSeasonMatchesPage()}
                isLoading={isFetchingNextSeasonMatchesPage}
                hasMore={Boolean(hasNextSeasonMatchesPage)}
                className="py-1"
              />
            </>
          ) : (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700/80">
              Nenhuma partida nesta temporada ainda.
            </p>
          )}
        </section>
      </div>
    ) : null;

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <AppShell title="Ranking" subtitle="Classificação dos jogadores" showBack>
      <div className="space-y-4">
        <SearchInput
          value={searchInput}
          onChange={handleSearchChange}
          onClear={handleClearSearch}
        />

        {isSearching && (
          <p className="text-xs text-muted-foreground text-center">
            {activeTab === "temporada"
              ? `${seasonPlayers.length} resultado(s) para "${searchInput.trim()}"`
              : `${players.length} resultado(s) para "${searchInput.trim()}"`}
          </p>
        )}

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "temporada" | "geral")}
          className="w-full"
        >
          <TabsList className="w-full">
            <TabsTrigger value="temporada" className="flex-1">
              Temporada
            </TabsTrigger>
            <TabsTrigger value="geral" className="flex-1">
              Geral
            </TabsTrigger>
          </TabsList>

          {/* ── ABA TEMPORADA ─────────────────────────────────────────────── */}
          <TabsContent value="temporada" className="space-y-3 mt-3">
            {seasonLoading ? (
              <PlayerListSkeleton count={5} />
            ) : !activeSeason ? (
              <div className="rounded-xl border border-border bg-muted/40 px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">Nenhuma temporada ativa no momento.</p>
              </div>
            ) : (
              <>
                {/* Banner da temporada */}
                <SeasonBanner season={activeSeason} />

                {/* Lista de classificação */}
                {standingsLoading ? (
                  <PlayerListSkeleton count={5} />
                ) : seasonPlayers.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {isSearching
                      ? "Nenhum jogador encontrado"
                      : "Nenhum jogo nesta temporada ainda."}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {seasonPlayers.map((player, index) => {
                      const prevPlayer = index > 0 ? seasonPlayers[index - 1] : null;
                      const divNum = getDivisionNumber(player.position);
                      const prevDivNum = prevPlayer ? getDivisionNumber(prevPlayer.position) : null;
                      const showSep = index === 0 || prevDivNum !== divNum;

                      return (
                        <RankingPlayerCard
                          key={player.id}
                          position={player.position}
                          displayName={player.displayName}
                          wins={player.wins}
                          losses={player.losses}
                          metric={player.points}
                          metricLabel="pts temp."
                          canOpenH2H={Boolean(user && player.id !== user.id)}
                          onClick={() => handleOpenH2H(player.id)}
                          showDivisionSeparator={showSep}
                        />
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* ── ABA GERAL ─────────────────────────────────────────────────── */}
          <TabsContent value="geral" className="space-y-3 mt-3">
            <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-center">
              <p className="text-xs font-semibold text-muted-foreground">
                {totalMatchesLoading || totalMatchesFetching || totalValidatedMatches === undefined
                  ? "Carregando total de jogos…"
                  : totalMatchesError
                    ? "Atualizando total de jogos…"
                    : `${totalValidatedMatches.toLocaleString("pt-BR")} jogos validados`}
              </p>
            </div>

            {geralLoading ? (
              <PlayerListSkeleton count={8} />
            ) : geralError ? (
              <p className="py-8 text-center text-sm text-red-500">
                Erro ao carregar ranking. Tente novamente.
              </p>
            ) : players.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {isSearching ? "Nenhum jogador encontrado" : "Nenhum jogador no ranking"}
              </p>
            ) : (
              <div className="space-y-3">
                {players.map((player, index) => {
                  const prevPlayer = index > 0 ? players[index - 1] : null;
                  const divNum = getDivisionNumber(player.position);
                  const prevDivNum = prevPlayer ? getDivisionNumber(prevPlayer.position) : null;
                  const showSep = index === 0 || prevDivNum !== divNum;

                  return (
                    <RankingPlayerCard
                      key={player.id}
                      position={player.position}
                      displayName={player.displayName}
                      wins={player.vitorias ?? 0}
                      losses={player.derrotas ?? 0}
                      metric={player.rating_atual ?? 250}
                      metricLabel="pontos"
                      canOpenH2H={Boolean(user && player.id !== user.id)}
                      onClick={() => handleOpenH2H(player.id)}
                      showDivisionSeparator={showSep}
                    />
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Sheet H2H ──────────────────────────────────────────────────────── */}
      <Sheet open={Boolean(selectedPlayerId)} onOpenChange={handleSheetOpenChange}>
        <SheetContent
          side="bottom"
          className="right-auto bottom-2 left-1/2 flex max-h-[85vh] w-[calc(100%-0.75rem)] max-w-2xl -translate-x-1/2 flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-card p-0 shadow-2xl"
        >
          <SheetHeader className="space-y-2 border-b border-border px-4 pb-4 pt-4 pr-14 sm:px-5">
            <SheetTitle>H2H</SheetTitle>
            <SheetDescription>Seu H2H e histórico do jogador selecionado</SheetDescription>
          </SheetHeader>

          <div
            ref={sheetScrollRef}
            className="flex-1 space-y-3 overflow-y-auto px-4 pb-6 pt-4 sm:space-y-4 sm:px-5"
          >
            {/* Card do adversário — só nome, sem ELO/posição (estão nas abas) */}
            {selectedPlayer && user && selectedPlayer.id !== user.id && (
              <article className="rounded-xl border border-primary/25 bg-primary/5 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-primary/80">
                  Adversário
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-primary sm:text-base">
                  {selectedPlayer.displayName}
                </p>
              </article>
            )}

            {!user ? (
              <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
                Faça login para ver seu H2H contra outros jogadores.
              </p>
            ) : !selectedPlayer ? (
              <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
                Selecione um jogador para ver o H2H.
              </p>
            ) : selectedPlayer.id === user.id ? (
              <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
                Selecione outro jogador para comparar seu histórico de confrontos.
              </p>
            ) : activeSeason ? (
              <Tabs
                value={h2hTab}
                onValueChange={(v) => setH2hTab(v as "temporada" | "geral")}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="temporada">Temporada</TabsTrigger>
                  <TabsTrigger value="geral">Geral</TabsTrigger>
                </TabsList>
                <TabsContent value="temporada" className="mt-3">
                  {seasonH2HContent}
                </TabsContent>
                <TabsContent value="geral" className="mt-3 space-y-3">
                  {generalH2HContent}
                </TabsContent>
              </Tabs>
            ) : (
              <div className="space-y-3">
                {generalH2HContent}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}

// ─── banner da temporada ────────────────────────────────────────────────────

function SeasonBanner({ season }: { season: { name: string; starts_at: string; ends_at: string } }) {
  const countdown = formatCountdown(season.ends_at);
  const progress = getSeasonProgress(season.starts_at, season.ends_at);
  const isEnding = countdown === "encerrando…";

  return (
    <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Temporada ativa
          </p>
          <p className="text-sm font-bold text-foreground truncate">{season.name}</p>
        </div>
        <div
          className={`flex items-center gap-1 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            isEnding
              ? "bg-orange-100 text-orange-700"
              : "bg-primary/10 text-primary"
          }`}
        >
          <Clock className="h-3 w-3" />
          {countdown}
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary/60 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ─── histórico de partidas (Sheet) ──────────────────────────────────────────

const PlayerMatchHistoryCard = memo(function PlayerMatchHistoryCard({
  match,
  playerId,
  loggedUserId,
  seasonPoints,
}: {
  match: PlayerValidatedMatch | PlayerSeasonMatch;
  playerId: string;
  loggedUserId?: string;
  seasonPoints?: number;
}) {
  const playerIsA = match.player_a_id === playerId;
  const opponent = playerIsA ? match.player_b : match.player_a;
  const opponentName = getDisplayName(opponent);
  const isAgainstLoggedUser = Boolean(loggedUserId && opponent.id === loggedUserId);
  const playerScore = playerIsA ? match.resultado_a : match.resultado_b;
  const opponentScore = playerIsA ? match.resultado_b : match.resultado_a;
  const playerWon = match.vencedor_id === playerId;
  const playerLost = Boolean(match.vencedor_id && match.vencedor_id !== playerId);
  const resultLabel = playerWon ? "Vitória" : playerLost ? "Derrota" : "Sem vencedor";
  const resultClassName = playerWon
    ? "bg-emerald-100 text-emerald-700"
    : playerLost
      ? "bg-red-100 text-red-600"
      : "bg-muted text-muted-foreground";

  // Pontos: modo temporada (âmbar) ou modo ELO (verde/vermelho)
  let pointsLabel: string | null = null;
  let pointsClassName = "text-muted-foreground";
  let pointsSuffix: string | null = null;

  if (seasonPoints !== undefined) {
    pointsLabel = `+${seasonPoints} pts`;
    pointsClassName = "text-amber-700";
    pointsSuffix = "na temporada";
  } else {
    const playerPoints = playerIsA ? match.pontos_variacao_a : match.pontos_variacao_b;
    if (typeof playerPoints === "number") {
      pointsLabel = `${playerPoints > 0 ? "+" : ""}${playerPoints} pts`;
      pointsClassName = playerPoints >= 0 ? "text-emerald-600" : "text-red-600";
    }
  }

  return (
    <article
      className={`space-y-2 rounded-xl border p-3 ${
        isAgainstLoggedUser
          ? "border-primary/40 bg-primary/10 shadow-sm shadow-primary/10"
          : "border-border bg-muted/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">vs {opponentName}</p>
          <p className="text-xs text-muted-foreground">{formatSheetDate(match.created_at)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {isAgainstLoggedUser && (
            <span className="whitespace-nowrap rounded-full border border-primary/20 bg-primary/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
              Você
            </span>
          )}
          <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${resultClassName}`}>
            {resultLabel}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-lg border border-border/70 bg-card/80 p-2.5">
        <div
          className={`rounded-md border px-2 py-2 ${
            playerWon
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-border bg-background text-foreground"
          }`}
        >
          <p className="text-[11px] font-semibold text-muted-foreground">Jogador</p>
          <p className="text-xl font-bold leading-none tabular-nums">{playerScore}</p>
        </div>

        <span className="text-lg font-semibold text-muted-foreground">x</span>

        <div
          className={`rounded-md border px-2 py-2 text-right ${
            playerLost
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-border bg-background text-foreground"
          }`}
        >
          <p className="text-[11px] font-semibold text-muted-foreground">Adversário</p>
          <p className="text-xl font-bold leading-none tabular-nums">{opponentScore}</p>
        </div>
      </div>

      {pointsLabel && (
        <p className={`text-xs font-semibold ${pointsClassName}`}>
          {pointsLabel}
          {pointsSuffix && (
            <span className="ml-1 font-normal text-muted-foreground">{pointsSuffix}</span>
          )}
        </p>
      )}
    </article>
  );
});

// ─── input de busca ──────────────────────────────────────────────────────────

function SearchInput({
  value,
  onChange,
  onClear,
  disabled = false,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-sm">
      <Search className="h-4 w-4 text-muted-foreground" />
      <input
        className="h-10 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        placeholder="Buscar jogador…"
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
      {value && (
        <button onClick={onClear} className="p-1 hover:bg-muted rounded-full" type="button">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
