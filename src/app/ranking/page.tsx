"use client";

import { AppShell } from "@/components/app-shell";
import { Search, X } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { useRankingAll } from "@/lib/queries";
import { PlayerListSkeleton } from "@/components/skeletons";
import {
  getPlayerStyle,
  getDivisionStyle,
  getDivisionNumber,
  getDivisionName,
  isTopThree,
} from "@/lib/divisions";

export default function RankingPage() {
  const [searchInput, setSearchInput] = useState("");
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

  // Handler para input
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  }, []);

  // Limpar busca
  const handleClearSearch = useCallback(() => {
    setSearchInput("");
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
                      className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border p-3 shadow-sm ${playerStyle.border} ${playerStyle.bg}`}
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
                      </div>
                    </article>
                  </div>
                );
              })}
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
