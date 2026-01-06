"use client";

import { AppShell } from "@/components/app-shell";
import { Search } from "lucide-react";
import { useState, useMemo } from "react";
import { useRanking } from "@/lib/queries";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { PlayerListSkeleton } from "@/components/skeletons";
import {
  getPlayerStyle,
  getDivisionStyle,
  getDivisionNumber,
  getDivisionName,
  isFirstOfDivision,
  isTopThree,
} from "@/lib/divisions";

export default function RankingPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useRanking();

  // Flatten pages into single array
  const players = useMemo(() => {
    return data?.pages.flatMap((page) => page.users) ?? [];
  }, [data]);

  // Primeiro, atribuir posição real no ranking (antes de qualquer filtro)
  const playersWithPosition = useMemo(() => {
    return players.map((player, index) => ({
      ...player,
      position: index + 1, // Posição real no ranking geral
      displayName: player.full_name || player.name || player.email?.split("@")[0] || "Jogador",
    }));
  }, [players]);

  // Filtrar jogadores por busca (mantendo a posição real)
  const filteredPlayers = useMemo(() => {
    return playersWithPosition.filter((player) => {
      const name = player.displayName;
      return name.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [playersWithPosition, searchQuery]);

  if (isLoading) {
    return (
      <AppShell title="Ranking" subtitle="Classificação dos jogadores" showBack>
        <div className="space-y-4">
          {/* Search field visible during loading */}
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              className="h-10 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              placeholder="Buscar jogador..."
              disabled
            />
          </div>
          <PlayerListSkeleton count={8} />
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell title="Ranking" subtitle="Classificação dos jogadores" showBack>
        <p className="py-8 text-center text-sm text-red-500">
          Erro ao carregar ranking. Tente novamente.
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Ranking" subtitle="Classificação dos jogadores" showBack>
      <div className="space-y-4">
        {/* Busca */}
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            className="h-10 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            placeholder="Buscar jogador..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Lista de jogadores */}
        <div className="space-y-3">
          {filteredPlayers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum jogador encontrado
            </p>
          ) : (
            <>
              {filteredPlayers.map((player, index) => {
                const playerStyle = getPlayerStyle(player.position);
                const divisionStyle = getDivisionStyle(player.position);
                const divisionNumber = getDivisionNumber(player.position);
                const divisionName = getDivisionName(player.position);
                const isTop3 = isTopThree(player.position);

                // Mostra separador na primeira posição OU quando muda de divisão
                const isFirstPlayer = index === 0;
                const showDivisionSeparator =
                  !searchQuery && (isFirstPlayer || isFirstOfDivision(player.position));

                // Verifica se a divisão anterior é diferente (para o separador com busca)
                const prevPlayer = index > 0 ? filteredPlayers[index - 1] : null;
                const showSeparatorAfterSearch =
                  searchQuery &&
                  (isFirstPlayer || (prevPlayer && getDivisionNumber(prevPlayer.position) !== divisionNumber));

                return (
                  <div key={player.id}>
                    {/* Separador de divisão */}
                    {(showDivisionSeparator || showSeparatorAfterSearch) && (
                      <div className="flex items-center gap-2 py-2">
                        <div className="h-px flex-1 bg-border" />
                        <span className="text-xs font-semibold text-muted-foreground">
                          {divisionStyle.emoji} {divisionName}
                        </span>
                        <div className="h-px flex-1 bg-border" />
                      </div>
                    )}

                    <article
                      className={`flex items-center justify-between rounded-2xl border p-3 shadow-sm ${playerStyle.border} ${playerStyle.bg}`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Badge com posição */}
                        <div
                          className={`relative flex h-10 w-10 items-center justify-center rounded-full ${playerStyle.badge} ${isTop3 ? 'shadow-lg shadow-orange-500/50' : 'shadow-md'}`}
                        >
                          {isTop3 && (
                            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-400/30 via-orange-500/20 to-red-500/30 blur-sm" />
                          )}
                          <span className={`relative text-sm font-bold ${divisionNumber <= 3 || isTop3 ? 'text-white drop-shadow-md' : 'text-muted-foreground'}`}>
                            {player.position}º
                          </span>
                        </div>

                        {/* Info do jogador */}
                        <div>
                          <div className="flex items-center gap-2">
                            <p className={`text-sm font-semibold ${playerStyle.text}`}>
                              {player.displayName}
                            </p>
                            {isTop3 && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${playerStyle.badge} text-white shadow-sm`}>
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
                      </div>

                      {/* Pontuação */}
                      <div className="text-right">
                        <p className={`text-lg font-bold ${playerStyle.text}`}>
                          {player.rating_atual || 250}
                        </p>
                        <p className="text-[11px] text-muted-foreground">pontos</p>
                      </div>
                    </article>
                  </div>
                );
              })}

              {/* Botao Carregar mais */}
              <LoadMoreButton
                onClick={() => fetchNextPage()}
                isLoading={isFetchingNextPage}
                hasMore={!!hasNextPage}
              />
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
