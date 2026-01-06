"use client";

import { AppShell } from "@/components/app-shell";
import { Search, X } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { useRanking } from "@/lib/queries";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { PlayerListSkeleton } from "@/components/skeletons";
import {
  getPlayerStyle,
  getDivisionStyle,
  getDivisionNumber,
  getDivisionName,
  isTopThree,
} from "@/lib/divisions";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";

type RankingUser = {
  id: string;
  name: string | null;
  full_name: string | null;
  email: string | null;
  rating_atual: number | null;
  vitorias: number | null;
  derrotas: number | null;
};

type RankingUserWithPosition = RankingUser & {
  position: number;
  displayName: string;
};

// Hook para buscar ranking completo com posições reais
function useRankingSearch(search: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["ranking-search", search],
    queryFn: async (): Promise<RankingUserWithPosition[]> => {
      // Busca todos os usuários ordenados por rating para calcular posição real
      const { data: allUsers, error } = await supabase
        .from("users")
        .select("id, name, full_name, email, rating_atual, vitorias, derrotas")
        .eq("is_active", true)
        .eq("hide_from_ranking", false)
        .order("rating_atual", { ascending: false });

      if (error) throw error;

      // Atribui posição real a cada usuário
      const usersWithPosition: RankingUserWithPosition[] = (allUsers || []).map((user: RankingUser, index: number) => ({
        ...user,
        position: index + 1,
        displayName: user.full_name || user.name || user.email?.split("@")[0] || "Jogador",
      }));

      // Filtra por busca
      const searchLower = search.toLowerCase();
      return usersWithPosition.filter((user) =>
        user.displayName.toLowerCase().includes(searchLower)
      );
    },
    enabled: search.length >= 2, // Só busca com 2+ caracteres
    staleTime: 1000 * 30, // 30 segundos
  });
}

export default function RankingPage() {
  const [searchInput, setSearchInput] = useState("");
  const isSearching = searchInput.length >= 2;

  // Query para listagem normal (paginada)
  const {
    data: paginatedData,
    isLoading: isPaginatedLoading,
    error: paginatedError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useRanking();

  // Query para busca (com posições reais)
  const {
    data: searchResults,
    isLoading: isSearchLoading,
    error: searchError,
  } = useRankingSearch(searchInput);

  // Dados da listagem paginada
  const paginatedPlayers = useMemo(() => {
    const players = paginatedData?.pages.flatMap((page) => page.users) ?? [];
    return players.map((player, index) => ({
      ...player,
      position: index + 1,
      displayName: player.full_name || player.name || player.email?.split("@")[0] || "Jogador",
    }));
  }, [paginatedData]);

  // Escolhe qual lista mostrar
  const players = isSearching ? (searchResults || []) : paginatedPlayers;
  const error = isSearching ? searchError : paginatedError;

  // Handler para input
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  }, []);

  // Limpar busca
  const handleClearSearch = useCallback(() => {
    setSearchInput("");
  }, []);

  if (isPaginatedLoading && !isSearching) {
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
            {isSearchLoading ? "Buscando..." : `${players.length} resultado(s) para "${searchInput}"`}
          </p>
        )}

        {/* Lista de jogadores */}
        <div className="space-y-3">
          {players.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {isSearching
                ? (isSearchLoading ? "Buscando..." : "Nenhum jogador encontrado")
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
                          {player.rating_atual || 1000}
                        </p>
                        <p className="text-[11px] text-muted-foreground">pontos</p>
                      </div>
                    </article>
                  </div>
                );
              })}

              {/* Botao Carregar mais (só quando não está buscando) */}
              {!isSearching && (
                <LoadMoreButton
                  onClick={() => fetchNextPage()}
                  isLoading={isFetchingNextPage}
                  hasMore={!!hasNextPage}
                />
              )}
            </>
          )}
        </div>
      </div>
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
