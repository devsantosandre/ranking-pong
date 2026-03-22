"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import { queryKeys } from "./query-keys";
import {
  confirmMatchAction,
  contestMatchAction,
  registerMatchAction,
} from "@/app/actions/matches";
import {
  getCurrentUserPendingMatchesAction,
  getHomeHighlightsAction,
  type CurrentUserPendingMatch,
} from "@/app/actions/pending-confirmation";

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
  aprovado_por: string | null;
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
  confirmation_deadline_at?: string | null;
};

export type PlayerValidatedMatch = {
  id: string;
  player_a_id: string;
  player_b_id: string;
  vencedor_id: string | null;
  resultado_a: number;
  resultado_b: number;
  created_at: string;
  pontos_variacao_a: number | null;
  pontos_variacao_b: number | null;
  player_a: UserInfo;
  player_b: UserInfo;
};

type MatchesPage = {
  matches: MatchWithUsers[];
  nextPage: number | undefined;
};

type PlayerValidatedMatchesPage = {
  matches: PlayerValidatedMatch[];
  totalCount: number;
  nextPage: number | undefined;
};

type MatchCounts = {
  pendentes: number;
  recentes: number;
};

export type HeadToHeadStats = {
  wins: number;
  losses: number;
  total: number;
  winRate: number;
};

type MatchMetricsRealtimeRow = {
  total_validated_matches?: number | null;
};

type UserRelation = UserInfo | UserInfo[] | null;

type PlayerValidatedMatchRow = {
  id: string;
  player_a_id: string;
  player_b_id: string;
  vencedor_id: string | null;
  resultado_a: number;
  resultado_b: number;
  created_at: string;
  pontos_variacao_a: number | null;
  pontos_variacao_b: number | null;
  player_a: UserRelation;
  player_b: UserRelation;
};

type HeadToHeadStatsRpcRow = {
  wins: number | string | null;
  losses: number | string | null;
  total: number | string | null;
  win_rate: number | string | null;
};

export type HomeStreakHighlight = {
  userId: string;
  userName: string;
  streak: number;
};

export type HomeWeeklyActivityHighlight = {
  userId: string;
  userName: string;
  matches: number;
  uniqueOpponents: number;
};

export type HomeHighlights = {
  streakLeader: HomeStreakHighlight | null;
  weeklyActivityLeader: HomeWeeklyActivityHighlight | null;
};

const NETWORK_ERROR_PATTERNS = [
  "failed to fetch",
  "network",
  "connection",
  "timeout",
  "temporarily unavailable",
];

function isLikelyNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return NETWORK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

function normalizeRelationUser(user: UserRelation, fallbackId: string): UserInfo {
  const normalized = Array.isArray(user) ? (user[0] ?? null) : user;

  if (!normalized) {
    return {
      id: fallbackId,
      name: null,
      full_name: null,
      email: null,
    };
  }

  return {
    id: normalized.id || fallbackId,
    name: normalized.name ?? null,
    full_name: normalized.full_name ?? null,
    email: normalized.email ?? null,
  };
}

async function fetchMatchesWithUsers(
  supabase: ReturnType<typeof createClient>,
  matchesData: MatchData[]
) {
  if (matchesData.length === 0) {
    return [] as MatchWithUsers[];
  }

  const playerIds = new Set<string>();
  matchesData.forEach((m) => {
    playerIds.add(m.player_a_id);
    playerIds.add(m.player_b_id);
  });

  const { data: usersData, error: usersError } = await supabase
    .from("users")
    .select("id, name, full_name, email")
    .in("id", Array.from(playerIds));

  if (usersError) throw usersError;

  const usersMap = new Map<string, UserInfo>();
  usersData?.forEach((u: UserInfo) => usersMap.set(u.id, u));

  return matchesData.map((match) => ({
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
  })) as MatchWithUsers[];
}

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

      const matchesWithUsers = await fetchMatchesWithUsers(supabase, matchesData as MatchData[]);

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

export function usePendingMatches(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.matches.pending(userId || "anonymous"),
    queryFn: async () => {
      if (!userId) {
        return [] as CurrentUserPendingMatch[];
      }

      return getCurrentUserPendingMatchesAction();
    },
    enabled: !!userId,
    staleTime: 1000 * 5,
    refetchInterval: 1000 * 15,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function useRecentMatches(userId: string | undefined) {
  const supabase = createClient();

  return useInfiniteQuery({
    queryKey: queryKeys.matches.recent(userId || "anonymous"),
    queryFn: async ({ pageParam = 0 }) => {
      if (!userId) {
        return { matches: [] as MatchWithUsers[], nextPage: undefined };
      }

      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: matchesData, error: matchesError } = await supabase
        .from("matches")
        .select("*")
        .or(`player_a_id.eq.${userId},player_b_id.eq.${userId}`)
        .eq("status", "validado")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (matchesError) throw matchesError;
      if (!matchesData || matchesData.length === 0) {
        return { matches: [] as MatchWithUsers[], nextPage: undefined };
      }

      const matchesWithUsers = await fetchMatchesWithUsers(supabase, matchesData as MatchData[]);

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

export function usePlayerValidatedMatches(playerId: string | undefined) {
  const supabase = createClient();

  return useInfiniteQuery({
    queryKey: queryKeys.matches.playerValidated(playerId),
    queryFn: async ({ pageParam = 0 }) => {
      if (!playerId) {
        return {
          matches: [] as PlayerValidatedMatch[],
          totalCount: 0,
          nextPage: undefined,
        } as PlayerValidatedMatchesPage;
      }

      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: matchesData, error: matchesError, count } = await supabase
        .from("matches")
        .select(
          `
          id,
          player_a_id,
          player_b_id,
          vencedor_id,
          resultado_a,
          resultado_b,
          created_at,
          pontos_variacao_a,
          pontos_variacao_b,
          player_a:users!player_a_id(id, name, full_name, email),
          player_b:users!player_b_id(id, name, full_name, email)
          `,
          { count: "exact" }
        )
        .or(`player_a_id.eq.${playerId},player_b_id.eq.${playerId}`)
        .eq("status", "validado")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (matchesError) throw matchesError;

      const rows = (matchesData ?? []) as PlayerValidatedMatchRow[];
      const matches = rows.map((match) => ({
        id: match.id,
        player_a_id: match.player_a_id,
        player_b_id: match.player_b_id,
        vencedor_id: match.vencedor_id,
        resultado_a: match.resultado_a,
        resultado_b: match.resultado_b,
        created_at: match.created_at,
        pontos_variacao_a: match.pontos_variacao_a,
        pontos_variacao_b: match.pontos_variacao_b,
        player_a: normalizeRelationUser(match.player_a, match.player_a_id),
        player_b: normalizeRelationUser(match.player_b, match.player_b_id),
      })) as PlayerValidatedMatch[];

      const resolvedTotalCount = typeof count === "number" ? count : rows.length;
      const nextPage = to + 1 < resolvedTotalCount ? pageParam + 1 : undefined;

      return {
        matches,
        totalCount: resolvedTotalCount,
        nextPage,
      } as PlayerValidatedMatchesPage;
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    enabled: !!playerId,
    staleTime: 1000 * 60,
  });
}

export function useMatchCounts(userId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: queryKeys.matches.counts(userId),
    queryFn: async () => {
      if (!userId) {
        return { pendentes: 0, recentes: 0 } as MatchCounts;
      }

      const baseFilter = `player_a_id.eq.${userId},player_b_id.eq.${userId}`;

      const [pendingResult, recentResult] = await Promise.all([
        supabase
          .from("matches")
          .select("id", { count: "exact", head: true })
          .or(baseFilter)
          .in("status", ["pendente", "edited"]),
        supabase
          .from("matches")
          .select("id", { count: "exact", head: true })
          .or(baseFilter)
          .eq("status", "validado"),
      ]);

      if (pendingResult.error) throw pendingResult.error;
      if (recentResult.error) throw recentResult.error;

      return {
        pendentes: pendingResult.count ?? 0,
        recentes: recentResult.count ?? 0,
      } as MatchCounts;
    },
    enabled: !!userId,
  });
}

export function useHomeHighlights() {
  return useQuery({
    queryKey: queryKeys.matches.homeHighlights(),
    queryFn: async (): Promise<HomeHighlights> => getHomeHighlightsAction(),
    staleTime: 1000 * 20,
    refetchInterval: 1000 * 30,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function useTotalValidatedMatches() {
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);
  const totalValidatedQueryKey = useMemo(
    () => queryKeys.matches.totalValidated(),
    []
  );

  const query = useQuery({
    queryKey: totalValidatedQueryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_metrics")
        .select("total_validated_matches")
        .eq("id", true)
        .single();

      if (error) throw error;
      return data?.total_validated_matches ?? 0;
    },
    staleTime: 1000 * 60 * 30,
    retry: 3,
    refetchOnWindowFocus: true,
  });

  const refreshTotal = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: totalValidatedQueryKey,
      exact: true,
    });
  }, [queryClient, totalValidatedQueryKey]);

  useEffect(() => {
    const channel = supabase
      .channel("match-metrics-total")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_metrics",
        },
        (payload: RealtimePostgresChangesPayload<MatchMetricsRealtimeRow>) => {
          const next = payload.new as { total_validated_matches?: number } | null;
          if (next && typeof next.total_validated_matches === "number") {
            queryClient.setQueryData(
              totalValidatedQueryKey,
              next.total_validated_matches
            );
            return;
          }

          refreshTotal();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, refreshTotal, supabase, totalValidatedQueryKey]);

  return query;
}

export function useHeadToHeadStats(
  userId: string | undefined,
  opponentId: string | undefined
) {
  const supabase = createClient();

  return useQuery({
    queryKey: queryKeys.matches.h2h(userId, opponentId),
    queryFn: async (): Promise<HeadToHeadStats> => {
      if (!userId || !opponentId || userId === opponentId) {
        return { wins: 0, losses: 0, total: 0, winRate: 0 };
      }

      const { data, error } = await supabase
        .rpc("get_head_to_head_stats_v1", {
          p_user_id: userId,
          p_opponent_id: opponentId,
        });

      if (error) throw error;

      const row = (Array.isArray(data) ? (data[0] ?? null) : data) as HeadToHeadStatsRpcRow | null;
      const wins = Number(row?.wins ?? 0);
      const losses = Number(row?.losses ?? 0);
      const total = Number(row?.total ?? 0);
      const winRate = Number(row?.win_rate ?? 0);

      return {
        wins: Number.isFinite(wins) ? wins : 0,
        losses: Number.isFinite(losses) ? losses : 0,
        total: Number.isFinite(total) ? total : 0,
        winRate: Number.isFinite(winRate) ? winRate : 0,
      };
    },
    enabled: Boolean(userId && opponentId),
    staleTime: 1000 * 30,
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
    networkMode: "online",
    retry: false,
    onMutate: async ({ matchId, userId }) => {
      const matchesQueryKey = queryKeys.matches.list(userId);
      await queryClient.cancelQueries({ queryKey: matchesQueryKey });

      const previousMatches =
        queryClient.getQueryData<InfiniteData<MatchesPage>>(matchesQueryKey);

      queryClient.setQueryData<InfiniteData<MatchesPage>>(matchesQueryKey, (oldData) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            matches: page.matches.map((match) =>
              match.id === matchId ? { ...match, status: "validado" } : match
            ),
          })),
        };
      });

      return { previousMatches, matchesQueryKey };
    },
    onError: (_error, _variables, context) => {
      if (!context?.previousMatches || !context.matchesQueryKey) return;
      queryClient.setQueryData(context.matchesQueryKey, context.previousMatches);
    },
    onSuccess: () => {
      // Invalida cache de partidas, usuários e conquistas para atualizar dados
      queryClient.invalidateQueries({ queryKey: queryKeys.matches.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.achievements.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.matches.homeHighlights() });
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.matches.all, "pending-status"],
      });
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
    networkMode: "online",
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.matches.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.matches.homeHighlights() });
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.matches.all, "pending-status"],
      });
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
      requestId: string;
    }) => {
      const result = await registerMatchAction(input);
      if (!result.success) {
        throw new Error(result.error || "Erro ao registrar partida");
      }
      return result;
    },
    networkMode: "online",
    retry: (failureCount, error) => isLikelyNetworkError(error) && failureCount < 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 8000),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.matches.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dailyLimits.all });
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.matches.all, "pending-status"],
      });
    },
  });
}
