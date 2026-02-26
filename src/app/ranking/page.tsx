"use client";

import { AppShell } from "@/components/app-shell";
import { ChevronRight, Search, X } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { useHeadToHeadStats, useRankingAll } from "@/lib/queries";
import { PlayerListSkeleton } from "@/components/skeletons";
import { useAuth } from "@/lib/auth-store";
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

export default function RankingPage() {
  const { user } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const normalizedSearch = searchInput.trim().toLowerCase();
  const isSearching = normalizedSearch.length >= 2;

  // Query para listagem completa (sem paginação)
  const {
    data: rankingData,
    isLoading,
    error,
  } = useRankingAll();

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
                          {player.rating_atual || 1000}
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
          className="right-auto bottom-2 left-1/2 max-h-[80vh] w-[calc(100%-1rem)] max-w-2xl -translate-x-1/2 gap-0 rounded-2xl border p-0"
        >
          <SheetHeader className="pr-12">
            <SheetTitle>
              {selectedPlayer ? `H2H vs ${selectedPlayer.displayName}` : "H2H"}
            </SheetTitle>
            <SheetDescription>
              Confrontos validados entre você e este adversário
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 px-4 pb-6">
            {!user ? (
              <p className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
                Faça login para ver seu H2H contra outros jogadores.
              </p>
            ) : !selectedPlayer ? (
              <p className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
                Selecione um jogador para ver o H2H.
              </p>
            ) : selectedPlayer.id === user.id ? (
              <p className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
                Selecione outro jogador para comparar seu histórico de confrontos.
              </p>
            ) : h2hLoading ? (
              <p className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
                Carregando H2H...
              </p>
            ) : h2hError ? (
              <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                Erro ao carregar H2H. Tente novamente.
              </p>
            ) : h2hStats && h2hStats.total > 0 ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
                    <p className="text-xl font-bold text-emerald-700">{h2hStats.wins}</p>
                    <p className="text-[11px] text-emerald-700/80">Você ganhou</p>
                  </article>
                  <article className="rounded-xl border border-red-200 bg-red-50 p-3 text-center">
                    <p className="text-xl font-bold text-red-600">{h2hStats.losses}</p>
                    <p className="text-[11px] text-red-600/80">Você perdeu</p>
                  </article>
                  <article className="rounded-xl border border-border bg-card p-3 text-center">
                    <p className="text-xl font-bold text-foreground">{h2hStats.total}</p>
                    <p className="text-[11px] text-muted-foreground">Total</p>
                  </article>
                </div>

                <div className="rounded-xl border border-border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Aproveitamento</p>
                  <p className="text-lg font-semibold text-foreground">
                    {h2hStats.winRate}% de vitórias
                  </p>
                </div>
              </>
            ) : (
              <p className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
                Vocês ainda não têm partidas validadas entre si.
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}

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
