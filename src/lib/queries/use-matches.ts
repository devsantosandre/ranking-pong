"use client";

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { queryKeys } from "./query-keys";
import {
  confirmMatchAction,
  contestMatchAction,
  registerMatchAction,
} from "@/app/actions/matches";

const PAGE_SIZE = 20;

export type MatchData = {
  id: string;
  player_a_id: string;
  player_b_id: string;
  vencedor_id: string | null;
  resultado_a: number;
  resultado_b: number;
  status: string;
  criado_por: string;
  created_at: string;
  pontos_variacao_a: number | null;
  pontos_variacao_b: number | null;
};

export type UserInfo = {
  id: string;
  name: string | null;
  full_name: string | null;
  email: string | null;
};

export type MatchWithUsers = MatchData & {
  player_a: UserInfo;
  player_b: UserInfo;
};

// Hook para buscar partidas do usuário com paginacao
export function useMatches(userId: string | undefined) {
  const supabase = createClient();

  return useInfiniteQuery({
    queryKey: queryKeys.matches.list(userId),
    queryFn: async ({ pageParam = 0 }) => {
      if (!userId) return { matches: [] as MatchWithUsers[], nextPage: undefined };

      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Buscar partidas
      const { data: matchesData, error: matchesError } = await supabase
        .from("matches")
        .select("*")
        .or(`player_a_id.eq.${userId},player_b_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (matchesError) throw matchesError;
      if (!matchesData || matchesData.length === 0) {
        return { matches: [] as MatchWithUsers[], nextPage: undefined };
      }

      // Coletar IDs únicos de jogadores
      const playerIds = new Set<string>();
      matchesData.forEach((m: MatchData) => {
        playerIds.add(m.player_a_id);
        playerIds.add(m.player_b_id);
      });

      // Buscar dados dos jogadores
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("id, name, full_name, email")
        .in("id", Array.from(playerIds));

      if (usersError) throw usersError;

      // Criar mapa de usuários
      const usersMap = new Map<string, UserInfo>();
      usersData?.forEach((u: UserInfo) => usersMap.set(u.id, u));

      // Combinar dados
      const matchesWithUsers: MatchWithUsers[] = matchesData.map((match: MatchData) => ({
        ...match,
        player_a: usersMap.get(match.player_a_id) || {
          id: match.player_a_id,
          name: null,
          full_name: null,
          email: null,
        },
        player_b: usersMap.get(match.player_b_id) || {
          id: match.player_b_id,
          name: null,
          full_name: null,
          email: null,
        },
      }));

      return {
        matches: matchesWithUsers,
        nextPage: matchesData.length === PAGE_SIZE ? pageParam + 1 : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    enabled: !!userId,
  });
}

// Hook para confirmar partida
export function useConfirmMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ matchId, userId }: { matchId: string; userId: string }) => {
      const result = await confirmMatchAction(matchId, userId);
      if (!result.success) {
        throw new Error(result.error || "Erro ao confirmar partida");
      }
      return result;
    },
    onSuccess: () => {
      // Invalida cache de partidas e usuários para atualizar dados
      queryClient.invalidateQueries({ queryKey: queryKeys.matches.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

// Hook para contestar partida
export function useContestMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      matchId,
      userId,
      newOutcome,
    }: {
      matchId: string;
      userId: string;
      newOutcome: string;
    }) => {
      const result = await contestMatchAction(matchId, userId, newOutcome);
      if (!result.success) {
        throw new Error(result.error || "Erro ao contestar partida");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.matches.all });
    },
  });
}

// Hook para registrar nova partida
export function useRegisterMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      playerId: string;
      opponentId: string;
      outcome: string;
    }) => {
      const result = await registerMatchAction(input);
      if (!result.success) {
        throw new Error(result.error || "Erro ao registrar partida");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.matches.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dailyLimits.all });
    },
  });
}











