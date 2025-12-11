"use client";

import { AppShell } from "@/components/app-shell";
import { Search, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
import { useRanking } from "@/lib/queries";

type FilterType = "Todos" | "Ativos" | "Inativos";

export default function RankingPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("Todos");

  const { data: players = [], isLoading, error } = useRanking();

  // Primeiro, atribuir posição real no ranking (antes de qualquer filtro)
  const playersWithPosition = useMemo(() => {
    return players.map((player, index) => ({
      ...player,
      position: index + 1, // Posição real no ranking geral
      displayName: player.full_name || player.name || player.email?.split("@")[0] || "Jogador",
    }));
  }, [players]);

  // Filtrar jogadores por busca e status (mantendo a posição real)
  const filteredPlayers = useMemo(() => {
    return playersWithPosition.filter((player) => {
      const name = player.displayName;
      const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase());

      if (filter === "Todos") return matchesSearch;
      if (filter === "Ativos") return matchesSearch;
      if (filter === "Inativos") return false;

      return matchesSearch;
    });
  }, [playersWithPosition, searchQuery, filter]);

  if (isLoading) {
    return (
      <AppShell title="Ranking" subtitle="Classificação dos jogadores" showBack>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
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

        {/* Filtros */}
        <div className="flex gap-2 text-xs font-semibold">
          {(["Todos", "Ativos", "Inativos"] as FilterType[]).map((filtro) => (
            <button
              key={filtro}
              onClick={() => setFilter(filtro)}
              className={`rounded-full border px-3 py-2 transition ${
                filter === filtro
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-card text-foreground"
              }`}
            >
              {filtro}
            </button>
          ))}
        </div>

        {/* Lista de jogadores */}
        <div className="space-y-3">
          {filteredPlayers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum jogador encontrado
            </p>
          ) : (
            filteredPlayers.map((player) => {
              // Estilos para medalhas (top 3)
              const medalStyles = {
                1: {
                  badge: "bg-gradient-to-br from-yellow-400 to-amber-500",
                  border: "border-amber-300",
                  bg: "bg-amber-50",
                  text: "text-amber-700",
                  emoji: "🥇",
                },
                2: {
                  badge: "bg-gradient-to-br from-gray-300 to-gray-400",
                  border: "border-gray-300",
                  bg: "bg-gray-50",
                  text: "text-gray-600",
                  emoji: "🥈",
                },
                3: {
                  badge: "bg-gradient-to-br from-orange-400 to-orange-600",
                  border: "border-orange-300",
                  bg: "bg-orange-50",
                  text: "text-orange-700",
                  emoji: "🥉",
                },
              };

              const medal = medalStyles[player.position as 1 | 2 | 3];
              const isTopThree = player.position <= 3;

              return (
                <article
                  key={player.id}
                  className={`flex items-center justify-between rounded-2xl border p-3 shadow-sm ${
                    isTopThree && medal
                      ? `${medal.border} ${medal.bg}`
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Posição / Medalha */}
                    {isTopThree && medal ? (
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${medal.badge} shadow-md`}>
                        <span className="text-lg">{medal.emoji}</span>
                      </div>
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        <span className="text-sm font-bold text-muted-foreground">#{player.position}</span>
                      </div>
                    )}

                    {/* Info do jogador */}
                    <div>
                      <p className={`text-sm font-semibold ${isTopThree && medal ? medal.text : "text-foreground"}`}>
                        {player.displayName}
                      </p>
                      <p className="text-xs text-muted-foreground">
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
                    <p className={`text-lg font-bold ${isTopThree && medal ? medal.text : "text-primary"}`}>
                      {player.rating_atual || 250}
                    </p>
                    <p className="text-[11px] text-muted-foreground">pontos</p>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}
