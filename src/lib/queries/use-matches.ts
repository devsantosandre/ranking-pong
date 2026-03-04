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

type MatchesPage = {
  matches: MatchWithUsers[];
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

type RankingVisibleUser = {
  id: string;
  name: string | null;
  full_name: string | null;
  email: string | null;
  rating_atual: number | null;
  jogos_disputados: number | null;
};

type HighlightMatchRow = {
  player_a_id: string;
  player_b_id: string;
  vencedor_id: string | null;
  created_at: string;
};

type WeeklyHighlightMatchRow = Pick<HighlightMatchRow, "player_a_id" | "player_b_id">;

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

function getDisplayName(user: {
  full_name: string | null;
  name: string | null;
  email: string | null;
}) {
  return user.full_name || user.name || user.email?.split("@")[0] || "Jogador";
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
  const supabase = createClient();

  return useQuery({
    queryKey: queryKeys.matches.pending(userId || "anonymous"),
    queryFn: async () => {
      if (!userId) {
        return [] as MatchWithUsers[];
      }

      const { data: matchesData, error: matchesError } = await supabase
        .from("matches")
        .select("*")
        .or(`player_a_id.eq.${userId},player_b_id.eq.${userId}`)
        .in("status", ["pendente", "edited"])
        .order("created_at", { ascending: false });

      if (matchesError) throw matchesError;
      return fetchMatchesWithUsers(supabase, (matchesData ?? []) as MatchData[]);
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
  const supabase = createClient();

  return useQuery({
    queryKey: queryKeys.matches.homeHighlights(),
    queryFn: async (): Promise<HomeHighlights> => {
      const weekAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [usersResult, validatedMatchesResult, weeklyMatchesResult] = await Promise.all([
        supabase
          .from("users")
          .select("id, name, full_name, email, rating_atual, jogos_disputados")
          .eq("is_active", true)
          .eq("hide_from_ranking", false)
          .gt("jogos_disputados", 0),
        supabase
          .from("matches")
          .select("player_a_id, player_b_id, vencedor_id, created_at")
          .eq("status", "validado")
          .order("created_at", { ascending: false })
          .limit(2000),
        supabase
          .from("matches")
          .select("player_a_id, player_b_id")
          .eq("status", "validado")
          .gte("created_at", weekAgoIso),
      ]);

      if (usersResult.error) throw usersResult.error;
      if (validatedMatchesResult.error) throw validatedMatchesResult.error;
      if (weeklyMatchesResult.error) throw weeklyMatchesResult.error;

      const users = (usersResult.data ?? []) as RankingVisibleUser[];
      const validatedMatches = (validatedMatchesResult.data ?? []) as HighlightMatchRow[];
      const weeklyMatches = (weeklyMatchesResult.data ?? []) as WeeklyHighlightMatchRow[];

      if (users.length === 0) {
        return {
          streakLeader: null,
          weeklyActivityLeader: null,
        };
      }

      const usersById = new Map<string, RankingVisibleUser>(
        users.map((user) => [user.id, user])
      );
      const eligibleUserIds = new Set<string>(users.map((user) => user.id));

      const streakState = new Map<string, { streak: number; finished: boolean }>();
      users.forEach((user) => {
        streakState.set(user.id, { streak: 0, finished: false });
      });

      for (const match of validatedMatches) {
        if (!match.vencedor_id) continue;

        const participants = [
          {
            userId: match.player_a_id,
            won: match.vencedor_id === match.player_a_id,
          },
          {
            userId: match.player_b_id,
            won: match.vencedor_id === match.player_b_id,
          },
        ];

        for (const participant of participants) {
          if (!eligibleUserIds.has(participant.userId)) continue;

          const state = streakState.get(participant.userId);
          if (!state || state.finished) continue;

          if (participant.won) {
            state.streak += 1;
          } else {
            state.finished = true;
          }
        }
      }

      let streakLeader: HomeStreakHighlight | null = null;

      for (const [userId, state] of streakState.entries()) {
        if (state.streak <= 0) continue;

        const user = usersById.get(userId);
        if (!user) continue;

        if (!streakLeader) {
          streakLeader = {
            userId,
            userName: getDisplayName(user),
            streak: state.streak,
          };
          continue;
        }

        const leaderUser = usersById.get(streakLeader.userId);
        const candidateRating = user.rating_atual ?? 0;
        const leaderRating = leaderUser?.rating_atual ?? 0;
        const candidateName = getDisplayName(user);
        const leaderName = streakLeader.userName;

        if (
          state.streak > streakLeader.streak ||
          (state.streak === streakLeader.streak && candidateRating > leaderRating) ||
          (state.streak === streakLeader.streak &&
            candidateRating === leaderRating &&
            candidateName.localeCompare(leaderName, "pt-BR") < 0)
        ) {
          streakLeader = {
            userId,
            userName: candidateName,
            streak: state.streak,
          };
        }
      }

      const weeklyState = new Map<string, { matches: number; opponents: Set<string> }>();

      for (const match of weeklyMatches) {
        const sides = [
          { userId: match.player_a_id, opponentId: match.player_b_id },
          { userId: match.player_b_id, opponentId: match.player_a_id },
        ];

        for (const side of sides) {
          if (!eligibleUserIds.has(side.userId)) continue;

          const current =
            weeklyState.get(side.userId) ?? { matches: 0, opponents: new Set<string>() };
          current.matches += 1;
          current.opponents.add(side.opponentId);
          weeklyState.set(side.userId, current);
        }
      }

      let weeklyActivityLeader: HomeWeeklyActivityHighlight | null = null;

      for (const [userId, state] of weeklyState.entries()) {
        if (state.matches <= 0) continue;

        const user = usersById.get(userId);
        if (!user) continue;

        const candidate = {
          userId,
          userName: getDisplayName(user),
          matches: state.matches,
          uniqueOpponents: state.opponents.size,
        };

        if (!weeklyActivityLeader) {
          weeklyActivityLeader = candidate;
          continue;
        }

        const leaderUser = usersById.get(weeklyActivityLeader.userId);
        const candidateRating = user.rating_atual ?? 0;
        const leaderRating = leaderUser?.rating_atual ?? 0;

        if (
          candidate.matches > weeklyActivityLeader.matches ||
          (candidate.matches === weeklyActivityLeader.matches &&
            candidate.uniqueOpponents > weeklyActivityLeader.uniqueOpponents) ||
          (candidate.matches === weeklyActivityLeader.matches &&
            candidate.uniqueOpponents === weeklyActivityLeader.uniqueOpponents &&
            candidateRating > leaderRating) ||
          (candidate.matches === weeklyActivityLeader.matches &&
            candidate.uniqueOpponents === weeklyActivityLeader.uniqueOpponents &&
            candidateRating === leaderRating &&
            candidate.userName.localeCompare(weeklyActivityLeader.userName, "pt-BR") < 0)
        ) {
          weeklyActivityLeader = candidate;
        }
      }

      return {
        streakLeader,
        weeklyActivityLeader,
      };
    },
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

      const pairFilter =
        `and(player_a_id.eq.${userId},player_b_id.eq.${opponentId}),` +
        `and(player_a_id.eq.${opponentId},player_b_id.eq.${userId})`;

      const { data, error } = await supabase
        .from("matches")
        .select("id, vencedor_id")
        .eq("status", "validado")
        .or(pairFilter);

      if (error) throw error;

      const rows = (data ?? []) as Array<{ id: string; vencedor_id: string | null }>;
      const wins = rows.filter((match) => match.vencedor_id === userId).length;
      const losses = rows.filter((match) => match.vencedor_id === opponentId).length;
      const total = rows.length;

      return {
        wins,
        losses,
        total,
        winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
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
    },
  });
}
