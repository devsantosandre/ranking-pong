"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { queryKeys } from "./query-keys";

const PAGE_SIZE = 20;

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

type MatchData = {
  id: string;
  player_a_id: string;
  player_b_id: string;
  vencedor_id: string | null;
  resultado_a: number;
  resultado_b: number;
  pontos_variacao_a: number | null;
  pontos_variacao_b: number | null;
  created_at: string;
};

type UserData = {
  id: string;
  name: string | null;
  full_name: string | null;
  email: string | null;
};

// Hook para buscar notícias com paginacao (baseado em partidas validadas)
export function useNews() {
  const supabase = createClient();

  return useInfiniteQuery({
    queryKey: queryKeys.news.all,
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Buscar partidas validadas (são as "notícias" de resultados)
      const { data: matches, error: matchesError } = await supabase
        .from("matches")
        .select("*")
        .eq("status", "validado")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (matchesError) throw matchesError;
      if (!matches || matches.length === 0) {
        return { news: [] as NewsItem[], nextPage: undefined };
      }

      // Coletar IDs únicos de jogadores
      const playerIds = new Set<string>();
      matches.forEach((m: MatchData) => {
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
      users?.forEach((u: UserData) =>
        usersMap.set(u.id, {
          id: u.id,
          name: u.full_name || u.name || u.email?.split("@")[0] || "Jogador",
        })
      );

      // Transformar partidas em notícias
      const news: NewsItem[] = matches.map((match: MatchData) => {
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
          pointsWinner: pointsWinner ?? 0,
          pointsLoser: pointsLoser ?? 0,
          createdAt: match.created_at,
        };
      });

      return {
        news,
        nextPage: matches.length === PAGE_SIZE ? pageParam + 1 : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
  });
}










