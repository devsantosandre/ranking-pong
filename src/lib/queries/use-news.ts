"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { queryKeys } from "./query-keys";

export type NewsItem = {
  id: string;
  type: "resultado";
  title: string;
  winner: {
    id: string;
    name: string;
  };
  loser: {
    id: string;
    name: string;
  };
  score: string;
  pointsWinner: number;
  pointsLoser: number;
  createdAt: string;
};

// Hook para buscar notícias (baseado em partidas validadas)
export function useNews() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["news"],
    queryFn: async () => {
      // Buscar partidas validadas (são as "notícias" de resultados)
      const { data: matches, error: matchesError } = await supabase
        .from("matches")
        .select("*")
        .eq("status", "validado")
        .order("created_at", { ascending: false })
        .limit(20);

      if (matchesError) throw matchesError;
      if (!matches || matches.length === 0) return [];

      // Coletar IDs únicos de jogadores
      const playerIds = new Set<string>();
      matches.forEach((m) => {
        playerIds.add(m.player_a_id);
        playerIds.add(m.player_b_id);
        if (m.vencedor_id) playerIds.add(m.vencedor_id);
      });

      // Buscar dados dos jogadores
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, name, full_name, email")
        .in("id", Array.from(playerIds));

      if (usersError) throw usersError;

      // Criar mapa de usuários
      const usersMap = new Map<string, { id: string; name: string }>();
      users?.forEach((u) =>
        usersMap.set(u.id, {
          id: u.id,
          name: u.full_name || u.name || u.email?.split("@")[0] || "Jogador",
        })
      );

      // Transformar partidas em notícias
      const news: NewsItem[] = matches.map((match) => {
        const playerA = usersMap.get(match.player_a_id) || { id: match.player_a_id, name: "Jogador A" };
        const playerB = usersMap.get(match.player_b_id) || { id: match.player_b_id, name: "Jogador B" };

        const isPlayerAWinner = match.vencedor_id === match.player_a_id;
        const winner = isPlayerAWinner ? playerA : playerB;
        const loser = isPlayerAWinner ? playerB : playerA;
        const pointsWinner = isPlayerAWinner ? match.pontos_variacao_a : match.pontos_variacao_b;
        const pointsLoser = isPlayerAWinner ? match.pontos_variacao_b : match.pontos_variacao_a;

        return {
          id: match.id,
          type: "resultado" as const,
          title: `${winner.name} vence ${loser.name}`,
          winner,
          loser,
          score: `${match.resultado_a} x ${match.resultado_b}`,
          pointsWinner: pointsWinner || 20,
          pointsLoser: pointsLoser || 8,
          createdAt: match.created_at,
        };
      });

      return news;
    },
  });
}





