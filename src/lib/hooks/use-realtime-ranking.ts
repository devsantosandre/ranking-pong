"use client";

import { useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { queryKeys } from "@/lib/queries/query-keys";

export type RankingPlayer = {
  id: string;
  name: string | null;
  full_name: string | null;
  email: string | null;
  rating_atual: number | null;
  vitorias: number | null;
  derrotas: number | null;
};

export type RankingPlayerWithPosition = RankingPlayer & {
  position: number;
  displayName: string;
};

/**
 * Hook que busca o ranking com atualização em tempo real via Supabase Realtime.
 * Qualquer mudança na tabela users força refetch imediato.
 * Também usa polling como fallback para manter o /tv sincronizado.
 */
export function useRealtimeRanking(limit: number = 20) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const tvRankingQueryKey = useMemo(
    () => [...queryKeys.users.ranking(), "tv", limit] as const,
    [limit]
  );

  // Query para buscar o ranking
  const query = useQuery({
    queryKey: tvRankingQueryKey,
    queryFn: async (): Promise<RankingPlayerWithPosition[]> => {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, full_name, email, rating_atual, vitorias, derrotas")
        .eq("is_active", true)
        .eq("hide_from_ranking", false)
        .gt("jogos_disputados", 0)
        .limit(limit);

      if (error) throw error;

      const sortedPlayers = (data || []).sort((a: RankingPlayer, b: RankingPlayer) => {
        const ratingA = a.rating_atual ?? 0;
        const ratingB = b.rating_atual ?? 0;
        if (ratingB !== ratingA) return ratingB - ratingA;

        const vitoriasA = a.vitorias ?? 0;
        const vitoriasB = b.vitorias ?? 0;
        if (vitoriasB !== vitoriasA) return vitoriasB - vitoriasA;

        const derrotasA = a.derrotas ?? 0;
        const derrotasB = b.derrotas ?? 0;
        if (derrotasA !== derrotasB) return derrotasA - derrotasB;

        return a.id.localeCompare(b.id);
      });

      return sortedPlayers.map((player: RankingPlayer, index: number) => ({
        ...player,
        position: index + 1,
        displayName:
          player.full_name ||
          player.name ||
          player.email?.split("@")[0] ||
          "Jogador",
      }));
    },
    staleTime: 1000 * 5, // 5 segundos
    refetchInterval: 1000 * 5,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  // Refetch explícito para refletir mudanças de ranking imediatamente
  const refreshRanking = useCallback(() => {
    void queryClient.refetchQueries({
      queryKey: tvRankingQueryKey,
      exact: true,
      type: "active",
    });
  }, [queryClient, tvRankingQueryKey]);

  // Setup Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("tv-ranking-changes")
      .on(
        "postgres_changes",
        {
          event: "*", // Escutar todos os eventos (INSERT, UPDATE, DELETE)
          schema: "public",
          table: "users",
        },
        () => {
          refreshRanking();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, refreshRanking]);

  return query;
}
