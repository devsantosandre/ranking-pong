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
  confirmMatchDidHappenAction,
  reportMatchDidNotHappenAction,
} from "@/app/actions/matches";
import {
  getCurrentUserMatchCountsAction,
  getCurrentUserPendingMatchesAction,
  getCurrentUserRecentMatchesAction,
  getHomeHighlightsAction,
  type CurrentUserRecentMatch,
  type CurrentUserPendingMatch,
} from "@/app/actions/pending-confirmation";
import {
  enqueuePendingMatch,
  removePendingMatch,
  tryRegisterBackgroundSync,
} from "@/lib/sync/match-sync-queue";
import { postRegisterMatch } from "@/lib/sync/register-match-client";

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
  pending_kind?: "score" | "nonexistent";
  pending_context?: "default" | "nonexistent_rejected";
  pending_context_actor_id?: string | null;
  cancellation_reason?: CurrentUserRecentMatch["cancellation_reason"];
  cancellation_actor?: CurrentUserRecentMatch["cancellation_actor"];
  cancellation_actor_name?: string | null;
  cancellation_resolved_at?: string | null;
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
  return useInfiniteQuery({
    queryKey: queryKeys.matches.recent(userId || "anonymous"),
    queryFn: async ({ pageParam = 0 }) => {
      if (!userId) {
        return { matches: [] as CurrentUserRecentMatch[], nextPage: undefined };
      }

      const page = typeof pageParam === "number" ? pageParam : 0;
      return getCurrentUserRecentMatchesAction(page);
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
  return useQuery({
    queryKey: queryKeys.matches.counts(userId),
    queryFn: async () => {
      if (!userId) {
        return { pendentes: 0, recentes: 0 } as MatchCounts;
      }

      return getCurrentUserMatchCountsAction();
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

type PendingOptimisticContext = {
  pendingQueryKey: ReturnType<typeof queryKeys.matches.pending>;
  previousPending?: CurrentUserPendingMatch[];
};

/**
 * Remove o match da lista de pendências do usuário de forma otimista.
 * Usado pelos 3 hooks de confirmação que transferem a responsabilidade.
 */
async function optimisticallyRemoveFromPending(
  queryClient: ReturnType<typeof useQueryClient>,
  matchId: string,
  userId: string
): Promise<PendingOptimisticContext> {
  const pendingQueryKey = queryKeys.matches.pending(userId);
  await queryClient.cancelQueries({ queryKey: pendingQueryKey });
  const previousPending = queryClient.getQueryData<CurrentUserPendingMatch[]>(pendingQueryKey);
  queryClient.setQueryData<CurrentUserPendingMatch[]>(
    pendingQueryKey,
    (old) => (old ?? []).filter((m) => m.id !== matchId)
  );
  return { pendingQueryKey, previousPending };
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
    onMutate: async ({ matchId, userId }) => {
      return optimisticallyRemoveFromPending(queryClient, matchId, userId);
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previousPending !== undefined) {
        queryClient.setQueryData(ctx.pendingQueryKey, ctx.previousPending);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.matches.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.matches.homeHighlights() });
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.matches.all, "pending-status"],
      });
    },
  });
}

export function useReportMatchDidNotHappen() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ matchId, userId }: { matchId: string; userId: string }) => {
      const result = await reportMatchDidNotHappenAction(matchId, userId);
      if (!result.success) {
        throw new Error(result.error || "Erro ao marcar jogo como inexistente");
      }
      return result;
    },
    networkMode: "online",
    retry: false,
    onMutate: async ({ matchId, userId }) => {
      return optimisticallyRemoveFromPending(queryClient, matchId, userId);
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previousPending !== undefined) {
        queryClient.setQueryData(ctx.pendingQueryKey, ctx.previousPending);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.matches.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.matches.homeHighlights() });
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.matches.all, "pending-status"],
      });
    },
  });
}

export function useConfirmMatchDidHappen() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ matchId, userId }: { matchId: string; userId: string }) => {
      const result = await confirmMatchDidHappenAction(matchId, userId);
      if (!result.success) {
        throw new Error(result.error || "Erro ao informar que o jogo existiu");
      }
      return result;
    },
    networkMode: "online",
    retry: false,
    onMutate: async ({ matchId, userId }) => {
      return optimisticallyRemoveFromPending(queryClient, matchId, userId);
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previousPending !== undefined) {
        queryClient.setQueryData(ctx.pendingQueryKey, ctx.previousPending);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.matches.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.matches.homeHighlights() });
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.matches.all, "pending-status"],
      });
    },
  });
}

export type OptimisticOpponent = {
  id: string;
  name: string | null;
  full_name: string | null;
  email: string | null;
};

export type RegisterMatchInput = {
  playerId: string;
  opponentId: string;
  outcome: string;
  requestId: string;
  optimisticOpponent?: OptimisticOpponent | null;
  optimisticSelf?: OptimisticOpponent | null;
};

type RegisterMatchMutationContext = {
  pendingQueryKey: ReturnType<typeof queryKeys.matches.pending>;
  previousPending?: CurrentUserPendingMatch[];
};

function buildOptimisticPendingMatch(
  input: RegisterMatchInput
): CurrentUserPendingMatch | null {
  const [aStr, bStr] = input.outcome.split("x");
  const a = Number.parseInt(aStr, 10);
  const b = Number.parseInt(bStr, 10);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;

  const winnerId = a > b ? input.playerId : input.opponentId;
  const nowIso = new Date().toISOString();

  const opponent: OptimisticOpponent = input.optimisticOpponent ?? {
    id: input.opponentId,
    name: null,
    full_name: null,
    email: null,
  };

  const self: OptimisticOpponent = input.optimisticSelf ?? {
    id: input.playerId,
    name: null,
    full_name: null,
    email: null,
  };

  return {
    id: `optimistic-${input.requestId}`,
    player_a_id: input.playerId,
    player_b_id: input.opponentId,
    vencedor_id: winnerId,
    resultado_a: a,
    resultado_b: b,
    status: "pendente",
    criado_por: input.playerId,
    aprovado_por: null,
    created_at: nowIso,
    pontos_variacao_a: null,
    pontos_variacao_b: null,
    confirmation_deadline_at: null,
    pending_kind: "score",
    pending_context: "default",
    pending_context_actor_id: null,
    player_a: {
      id: self.id,
      name: self.name,
      full_name: self.full_name,
      email: self.email,
    },
    player_b: {
      id: opponent.id,
      name: opponent.name,
      full_name: opponent.full_name,
      email: opponent.email,
    },
  };
}

// Hook para registrar nova partida — usa API Route + Background Sync + Optimistic UI
export function useRegisterMatch() {
  const queryClient = useQueryClient();

  return useMutation<
    { success: true; matchId: string; wasInserted: boolean; queued: boolean },
    Error,
    RegisterMatchInput,
    RegisterMatchMutationContext
  >({
    mutationFn: async (input) => {
      // Persiste no IndexedDB ANTES de tentar enviar — sobrevive a fechamento
      await enqueuePendingMatch({
        requestId: input.requestId,
        playerId: input.playerId,
        opponentId: input.opponentId,
        outcome: input.outcome,
        enqueuedAt: Date.now(),
      });

      // Registra Background Sync para retomar mesmo se o app fechar
      void tryRegisterBackgroundSync();

      const result = await postRegisterMatch({
        playerId: input.playerId,
        opponentId: input.opponentId,
        outcome: input.outcome,
        requestId: input.requestId,
      });

      if (result.success) {
        await removePendingMatch(input.requestId);
        return {
          success: true,
          matchId: result.matchId,
          wasInserted: result.wasInserted,
          queued: false,
        };
      }

      // status 0 = falha de rede real (offline, DNS, fetch abortado)
      // → mantém na fila e sinaliza queued para o caller navegar com toast offline
      if (result.status === 0) {
        return {
          success: true,
          matchId: `queued-${input.requestId}`,
          wasInserted: false,
          queued: true,
        };
      }

      // Qualquer outro erro (4xx negócio ou 5xx servidor) bloqueia a navegação
      // O usuário precisa ver o motivo e decidir o que fazer
      await removePendingMatch(input.requestId);
      throw new Error(result.error);
    },
    networkMode: "always",
    retry: false,
    onMutate: async (input) => {
      const pendingQueryKey = queryKeys.matches.pending(input.playerId);
      await queryClient.cancelQueries({ queryKey: pendingQueryKey });

      const previousPending =
        queryClient.getQueryData<CurrentUserPendingMatch[]>(pendingQueryKey);

      const optimisticMatch = buildOptimisticPendingMatch(input);
      if (optimisticMatch) {
        queryClient.setQueryData<CurrentUserPendingMatch[]>(
          pendingQueryKey,
          (oldData) => [optimisticMatch, ...(oldData ?? [])]
        );
      }

      return { pendingQueryKey, previousPending };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      if (context.previousPending !== undefined) {
        queryClient.setQueryData(context.pendingQueryKey, context.previousPending);
      } else {
        queryClient.removeQueries({ queryKey: context.pendingQueryKey });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.matches.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dailyLimits.all });
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.matches.all, "pending-status"],
      });
    },
  });
}
