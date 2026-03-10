"use client";

import { AppShell } from "@/components/app-shell";
import { ChevronRight, Search, X } from "lucide-react";
import { memo, useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  useHeadToHeadStats,
  usePlayerValidatedMatches,
  useRankingAll,
  useTotalValidatedMatches,
  type PlayerValidatedMatch,
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
import {
  getPlayerStyle,
  getDivisionStyle,
  getDivisionNumber,
  getDivisionName,
  isTopThree,
} from "@/lib/divisions";

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

export default function RankingPage() {
  const { user } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const sheetScrollRef = useRef<HTMLDivElement | null>(null);
  const historySentinelRef = useRef<HTMLDivElement | null>(null);
  const normalizedSearch = searchInput.trim().toLowerCase();
  const isSearching = normalizedSearch.length >= 2;

  // Query para listagem completa (sem paginação)
  const {
    data: rankingData,
    isLoading,
    error,
  } = useRankingAll(user?.id);
  const {
    data: totalValidatedMatches,
    isLoading: totalMatchesLoading,
    isFetching: totalMatchesFetching,
    isError: totalMatchesError,
  } = useTotalValidatedMatches();

  const allPlayers = useMemo(() => {
    return (rankingData ?? []).map((player, index) => ({
      ...player,
      position: index + 1,
      displayName: player.full_name || player.name || player.email?.split("@")[0] || "Jogador",
    }));
  }, [rankingData]);

  const players = useMemo(() => {
    if (normalizedSearch.length < 2) {
      return allPlayers;
    }
    return allPlayers.filter((user) => user.displayName.toLowerCase().includes(normalizedSearch));
  }, [allPlayers, normalizedSearch]);

  const selectedPlayer = useMemo(
    () => allPlayers.find((player) => player.id === selectedPlayerId) ?? null,
    [allPlayers, selectedPlayerId]
  );

  const {
    data: h2hStats,
    isLoading: h2hLoading,
    error: h2hError,
  } = useHeadToHeadStats(
    user?.id,
    selectedPlayer && selectedPlayer.id !== user?.id ? selectedPlayer.id : undefined
  );
  const {
    data: selectedPlayerMatchesData,
    isLoading: selectedPlayerMatchesLoading,
    error: selectedPlayerMatchesError,
    fetchNextPage: fetchNextPlayerMatchesPage,
    hasNextPage: hasNextPlayerMatchesPage,
    isFetchingNextPage: isFetchingNextPlayerMatchesPage,
  } = usePlayerValidatedMatches(selectedPlayer?.id);
  const selectedPlayerMatches = useMemo(() => {
    return selectedPlayerMatchesData?.pages.flatMap((page) => page.matches) ?? [];
  }, [selectedPlayerMatchesData]);
  const selectedPlayerMatchesTotal = useMemo(() => {
    return selectedPlayerMatchesData?.pages[0]?.totalCount ?? selectedPlayerMatches.length;
  }, [selectedPlayerMatches.length, selectedPlayerMatchesData]);

  useEffect(() => {
    if (!selectedPlayerId || !hasNextPlayerMatchesPage || isFetchingNextPlayerMatchesPage) {
      return;
    }

    const root = sheetScrollRef.current;
    const sentinel = historySentinelRef.current;
    if (!root || !sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (!firstEntry?.isIntersecting) return;
        if (isFetchingNextPlayerMatchesPage || !hasNextPlayerMatchesPage) return;
        void fetchNextPlayerMatchesPage();
      },
      {
        root,
        rootMargin: "180px 0px",
        threshold: 0.01,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    fetchNextPlayerMatchesPage,
    hasNextPlayerMatchesPage,
    isFetchingNextPlayerMatchesPage,
    selectedPlayerId,
    selectedPlayerMatches.length,
  ]);

  // Handler para input
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  }, []);

  // Limpar busca
  const handleClearSearch = useCallback(() => {
    setSearchInput("");
  }, []);

  const handleOpenH2H = useCallback((playerId: string) => {
    setSelectedPlayerId(playerId);
  }, []);

  const handleSheetOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setSelectedPlayerId(null);
    }
  }, []);

  if (isLoading) {
    return (
      <AppShell title="Ranking" subtitle="Classificação dos jogadores" showBack>
        <div className="space-y-4">
          <SearchInput
            value={searchInput}
            onChange={handleSearchChange}
            onClear={handleClearSearch}
            disabled
          />
          <PlayerListSkeleton count={8} />
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell title="Ranking" subtitle="Classificação dos jogadores" showBack>
        <div className="space-y-4">
          <SearchInput
            value={searchInput}
            onChange={handleSearchChange}
            onClear={handleClearSearch}
          />
          <p className="py-8 text-center text-sm text-red-500">
            Erro ao carregar ranking. Tente novamente.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Ranking" subtitle="Classificação dos jogadores" showBack>
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-center">
          <p className="text-xs font-semibold text-muted-foreground">
            {totalMatchesLoading || totalMatchesFetching || totalValidatedMatches === undefined
              ? "Carregando total de jogos..."
              : totalMatchesError
                ? "Atualizando total de jogos..."
                : `${totalValidatedMatches.toLocaleString("pt-BR")} jogos validados`}
          </p>
        </div>

        <SearchInput
          value={searchInput}
          onChange={handleSearchChange}
          onClear={handleClearSearch}
        />

        {/* Indicador de busca */}
        {isSearching && (
          <p className="text-xs text-muted-foreground text-center">
            {`${players.length} resultado(s) para "${searchInput.trim()}"`}
          </p>
        )}

        {/* Lista de jogadores */}
        <div className="space-y-3">
          {players.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {isSearching
                ? "Nenhum jogador encontrado"
                : "Nenhum jogador no ranking"
              }
            </p>
          ) : (
            <>
              {players.map((player, index) => {
                const playerStyle = getPlayerStyle(player.position);
                const divisionStyle = getDivisionStyle(player.position);
                const divisionNumber = getDivisionNumber(player.position);
                const divisionName = getDivisionName(player.position);
                const isTop3 = isTopThree(player.position);
                const canOpenH2H = Boolean(user && player.id !== user.id);

                // Mostra separador de divisão
                const isFirstPlayer = index === 0;
                const prevPlayer = index > 0 ? players[index - 1] : null;
                const prevDivision = prevPlayer ? getDivisionNumber(prevPlayer.position) : null;
                const showDivisionSeparator = isFirstPlayer || prevDivision !== divisionNumber;

                return (
                  <div key={player.id}>
                    {/* Separador de divisão */}
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
                      onClick={() => canOpenH2H && handleOpenH2H(player.id)}
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
                          {player.position}º
                        </span>
                      </div>

                      {/* Info do jogador */}
                      <div className="min-w-0">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                          <p
                            className={`min-w-0 break-words text-sm font-semibold leading-tight ${playerStyle.text}`}
                          >
                            {player.displayName}
                          </p>
                          {isTop3 && (
                            <span
                              className={`inline-flex w-fit shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm ${playerStyle.badge}`}
                            >
                              🔥 TOP {player.position}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">{player.position}º</span>
                          {" · "}
                          <span className="text-green-600 font-semibold">
                            {player.vitorias || 0}V
                          </span>
                          {" / "}
                          <span className="text-red-500 font-semibold">
                            {player.derrotas || 0}D
                          </span>
                        </p>
                      </div>

                      {/* Pontuação */}
                      <div className="min-w-[4.5rem] shrink-0 text-right">
                        <p className={`text-lg font-bold tabular-nums ${playerStyle.text}`}>
                          {player.rating_atual ?? 250}
                        </p>
                        <p className="text-[11px] text-muted-foreground">pontos</p>
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
              })}
            </>
          )}
        </div>
      </div>

      <Sheet
        open={Boolean(selectedPlayerId)}
        onOpenChange={handleSheetOpenChange}
      >
        <SheetContent
          side="bottom"
          className="right-auto bottom-2 left-1/2 flex max-h-[85vh] w-[calc(100%-0.75rem)] max-w-2xl -translate-x-1/2 flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-card p-0 shadow-2xl"
        >
          <SheetHeader className="space-y-2 border-b border-border px-4 pb-4 pt-4 pr-14 sm:px-5">
            <SheetTitle>H2H</SheetTitle>
            <SheetDescription>
              Seu H2H e histórico do jogador selecionado
            </SheetDescription>
          </SheetHeader>

          <div
            ref={sheetScrollRef}
            className="flex-1 space-y-3 overflow-y-auto px-4 pb-6 pt-4 sm:space-y-4 sm:px-5"
          >
            {selectedPlayer && user && selectedPlayer.id !== user.id && (
              <article className="rounded-xl border border-primary/25 bg-primary/5 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-primary/80">
                  Adversário
                </p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-primary sm:text-base">
                      {selectedPlayer.displayName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedPlayer.position}º no ranking • {(selectedPlayer.rating_atual ?? 250).toLocaleString("pt-BR")} pts
                    </p>
                  </div>
                </div>
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
            ) : h2hLoading ? (
              <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
                Carregando H2H...
              </p>
            ) : h2hError ? (
              <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                Erro ao carregar H2H. Tente novamente.
              </p>
            ) : h2hStats && h2hStats.total > 0 ? (
              <>
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
                    <p className="text-3xl font-bold text-foreground">
                      {h2hStats.winRate}%
                    </p>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${Math.max(0, Math.min(100, h2hStats.winRate))}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {h2hStats.wins} vitória{h2hStats.wins === 1 ? "" : "s"} em {h2hStats.total} confronto{h2hStats.total > 1 ? "s" : ""}
                  </p>
                  <p className="text-xs font-medium text-muted-foreground">
                    {h2hStats.wins > h2hStats.losses
                      ? "Você está em vantagem neste confronto."
                      : h2hStats.wins < h2hStats.losses
                        ? "Adversário em vantagem neste confronto."
                        : "Confronto equilibrado entre vocês."}
                  </p>
                </div>
              </>
            ) : (
              <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
                Vocês ainda não têm partidas validadas entre si.
              </p>
            )}

            {selectedPlayer && (
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
                    Carregando partidas...
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

                    <div ref={historySentinelRef} className="h-1 w-full" />

                    {isFetchingNextPlayerMatchesPage && (
                      <p className="rounded-xl border border-border bg-muted/40 p-3 text-center text-xs font-medium text-muted-foreground">
                        Carregando mais partidas...
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
            )}
          </div>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}

const PlayerMatchHistoryCard = memo(function PlayerMatchHistoryCard({
  match,
  playerId,
  loggedUserId,
}: {
  match: PlayerValidatedMatch;
  playerId: string;
  loggedUserId?: string;
}) {
  const playerIsA = match.player_a_id === playerId;
  const opponent = playerIsA ? match.player_b : match.player_a;
  const opponentName = getDisplayName(opponent);
  const isAgainstLoggedUser = Boolean(loggedUserId && opponent.id === loggedUserId);
  const playerScore = playerIsA ? match.resultado_a : match.resultado_b;
  const opponentScore = playerIsA ? match.resultado_b : match.resultado_a;
  const playerPoints = playerIsA ? match.pontos_variacao_a : match.pontos_variacao_b;
  const playerWon = match.vencedor_id === playerId;
  const playerLost = Boolean(match.vencedor_id && match.vencedor_id !== playerId);
  const resultLabel = playerWon ? "Vitória" : playerLost ? "Derrota" : "Sem vencedor";
  const resultClassName = playerWon
    ? "bg-emerald-100 text-emerald-700"
    : playerLost
      ? "bg-red-100 text-red-600"
      : "bg-muted text-muted-foreground";
  const pointsLabel =
    typeof playerPoints === "number" ? `${playerPoints > 0 ? "+" : ""}${playerPoints} pts` : null;
  const pointsClassName =
    typeof playerPoints === "number"
      ? playerPoints >= 0
        ? "text-emerald-600"
        : "text-red-600"
      : "text-muted-foreground";

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
          <span
            className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${resultClassName}`}
          >
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

      {pointsLabel ? (
        <p className={`text-xs font-semibold ${pointsClassName}`}>{pointsLabel}</p>
      ) : null}
    </article>
  );
});

// Componente do input de busca
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
        placeholder="Buscar jogador..."
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
      {value && (
        <button
          onClick={onClear}
          className="p-1 hover:bg-muted rounded-full"
          type="button"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
