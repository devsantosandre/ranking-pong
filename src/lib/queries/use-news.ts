"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { queryKeys } from "./query-keys";

const PAGE_SIZE = 20;
export const NEWS_STALE_TIME_MS = 1000 * 45;
export const NEWS_GC_TIME_MS = 1000 * 60 * 10;

export const REACTION_VALUES = [
  "clap",
  "fire",
  "wow",
  "laugh",
  "sad",
  "pong",
] as const;

export type ReactionType = (typeof REACTION_VALUES)[number];
export type ReactionCounts = Record<ReactionType, number>;
export type ReactionPeople = Record<ReactionType, string[]>;

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
  reactionCounts: ReactionCounts;
  reactionsTotal: number;
  myReaction: ReactionType | null;
};

type MatchUser = {
  id: string;
  name: string | null;
  full_name: string | null;
  email: string | null;
};

type MatchNewsRow = {
  id: string;
  player_a_id: string;
  player_b_id: string;
  vencedor_id: string | null;
  resultado_a: number;
  resultado_b: number;
  pontos_variacao_a: number | null;
  pontos_variacao_b: number | null;
  created_at: string;
  player_a: MatchUser | MatchUser[] | null;
  player_b: MatchUser | MatchUser[] | null;
};

type MatchReactionSummaryRow = {
  match_id: string;
  reaction: string;
  total: number | string;
  reacted_by_me: boolean;
};

type MatchReactionPeopleRow = {
  reaction: string;
  user_id: string;
  user: MatchUser | MatchUser[] | null;
};

export type NewsPage = {
  news: NewsItem[];
  nextPage: number | undefined;
};

function createEmptyReactionCounts(): ReactionCounts {
  return {
    clap: 0,
    fire: 0,
    wow: 0,
    laugh: 0,
    sad: 0,
    pong: 0,
  };
}

function createEmptyReactionPeople(): ReactionPeople {
  return {
    clap: [],
    fire: [],
    wow: [],
    laugh: [],
    sad: [],
    pong: [],
  };
}

function isReactionType(value: string): value is ReactionType {
  return REACTION_VALUES.includes(value as ReactionType);
}

function getReactionsTotal(counts: ReactionCounts) {
  return REACTION_VALUES.reduce((acc, reaction) => acc + counts[reaction], 0);
}

function normalizeRelationUser(user: MatchUser | MatchUser[] | null): MatchUser | null {
  if (!user) return null;
  return Array.isArray(user) ? (user[0] ?? null) : user;
}

function getDisplayName(user: MatchUser | null, fallbackName: string) {
  if (!user) return fallbackName;
  return user.full_name || user.name || user.email?.split("@")[0] || fallbackName;
}

function applyOptimisticReaction(
  currentItem: NewsItem,
  selectedReaction: ReactionType,
  currentReaction: ReactionType | null
): NewsItem {
  const nextCounts: ReactionCounts = {
    ...createEmptyReactionCounts(),
    ...currentItem.reactionCounts,
  };

  if (currentReaction) {
    nextCounts[currentReaction] = Math.max(0, nextCounts[currentReaction] - 1);
  }

  const shouldRemoveReaction = currentReaction === selectedReaction;
  const nextMyReaction = shouldRemoveReaction ? null : selectedReaction;

  if (!shouldRemoveReaction) {
    nextCounts[selectedReaction] += 1;
  }

  return {
    ...currentItem,
    reactionCounts: nextCounts,
    reactionsTotal: getReactionsTotal(nextCounts),
    myReaction: nextMyReaction,
  };
}

export async function fetchNewsPage(
  supabase: ReturnType<typeof createClient>,
  pageParam: number,
  userId?: string
): Promise<NewsPage> {
  const from = pageParam * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: matches, error } = await supabase
    .from("matches")
    .select(
      `
      id,
      player_a_id,
      player_b_id,
      vencedor_id,
      resultado_a,
      resultado_b,
      pontos_variacao_a,
      pontos_variacao_b,
      created_at,
      player_a:users!player_a_id(id, name, full_name, email),
      player_b:users!player_b_id(id, name, full_name, email)
    `
    )
    .eq("status", "validado")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;
  if (!matches || matches.length === 0) {
    return { news: [], nextPage: undefined };
  }

  const rows = matches as MatchNewsRow[];
  const matchIds = rows.map((row) => row.id);

  const reactionCountsByMatch = new Map<string, ReactionCounts>();
  const myReactionByMatch = new Map<string, ReactionType | null>();

  if (matchIds.length > 0) {
    const { data: reactions, error: reactionsError } = await supabase.rpc(
      "get_match_reactions_summary",
      { p_match_ids: matchIds }
    );

    if (reactionsError) throw reactionsError;

    const reactionRows = (reactions ?? []) as MatchReactionSummaryRow[];

    reactionRows.forEach((reactionRow) => {
      if (!isReactionType(reactionRow.reaction)) return;
      const total = Number(reactionRow.total) || 0;

      const currentCounts =
        reactionCountsByMatch.get(reactionRow.match_id) ?? createEmptyReactionCounts();
      currentCounts[reactionRow.reaction] += total;
      reactionCountsByMatch.set(reactionRow.match_id, currentCounts);

      if (userId && reactionRow.reacted_by_me) {
        myReactionByMatch.set(reactionRow.match_id, reactionRow.reaction);
      }
    });
  }

  const news: NewsItem[] = rows.map((match) => {
    const playerA = normalizeRelationUser(match.player_a);
    const playerB = normalizeRelationUser(match.player_b);
    const playerAInfo = {
      id: match.player_a_id,
      name: getDisplayName(playerA, "Jogador A"),
    };
    const playerBInfo = {
      id: match.player_b_id,
      name: getDisplayName(playerB, "Jogador B"),
    };

    const isPlayerAWinner = match.vencedor_id
      ? match.vencedor_id === match.player_a_id
      : match.resultado_a >= match.resultado_b;
    const winner = isPlayerAWinner ? playerAInfo : playerBInfo;
    const loser = isPlayerAWinner ? playerBInfo : playerAInfo;
    const pointsWinner = isPlayerAWinner
      ? match.pontos_variacao_a
      : match.pontos_variacao_b;
    const pointsLoser = isPlayerAWinner
      ? match.pontos_variacao_b
      : match.pontos_variacao_a;
    const scoreWinner = isPlayerAWinner ? match.resultado_a : match.resultado_b;
    const scoreLoser = isPlayerAWinner ? match.resultado_b : match.resultado_a;
    const reactionCounts = reactionCountsByMatch.get(match.id) ?? createEmptyReactionCounts();

    return {
      id: match.id,
      type: "resultado" as const,
      title: `${winner.name} vence ${loser.name}`,
      winner,
      loser,
      score: `${scoreWinner} x ${scoreLoser}`,
      pointsWinner: pointsWinner ?? 0,
      pointsLoser: pointsLoser ?? 0,
      createdAt: match.created_at,
      reactionCounts,
      reactionsTotal: getReactionsTotal(reactionCounts),
      myReaction: myReactionByMatch.get(match.id) ?? null,
    };
  });

  return {
    news,
    nextPage: rows.length === PAGE_SIZE ? pageParam + 1 : undefined,
  };
}

export function useMatchReactionPeople(matchId: string, enabled: boolean) {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: queryKeys.news.reactionPeople(matchId),
    queryFn: async (): Promise<ReactionPeople> => {
      const { data, error } = await supabase
        .from("match_reactions")
        .select(
          `
          reaction,
          user_id,
          user:users!user_id(id, name, full_name, email)
        `
        )
        .eq("match_id", matchId);

      if (error) throw error;

      const grouped = createEmptyReactionPeople();

      const reactionRows = (data ?? []) as MatchReactionPeopleRow[];

      reactionRows.forEach((reactionRow) => {
        if (!isReactionType(reactionRow.reaction)) return;
        const user = normalizeRelationUser(reactionRow.user);
        const displayName = getDisplayName(user, "Jogador");
        grouped[reactionRow.reaction].push(displayName);
      });

      return grouped;
    },
    enabled: enabled && !!matchId,
    staleTime: 1000 * 30,
  });
}

export function useToggleMatchReaction(userId?: string) {
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);

  return useMutation({
    mutationFn: async ({
      matchId,
      reaction,
      currentReaction,
    }: {
      matchId: string;
      reaction: ReactionType;
      currentReaction: ReactionType | null;
    }) => {
      if (!userId) {
        throw new Error("Usuário não autenticado");
      }

      if (currentReaction === reaction) {
        const { error } = await supabase
          .from("match_reactions")
          .delete()
          .eq("match_id", matchId)
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("match_reactions")
          .upsert(
            {
              match_id: matchId,
              user_id: userId,
              reaction,
            },
            { onConflict: "match_id,user_id" }
          );

        if (error) throw error;
      }

      return { matchId, reaction, currentReaction };
    },
    onMutate: async ({ matchId, reaction, currentReaction }) => {
      if (!userId) return null;

      const queryKey = queryKeys.news.feed(userId);
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<InfiniteData<NewsPage>>(queryKey);

      queryClient.setQueryData<InfiniteData<NewsPage>>(queryKey, (currentData) => {
        if (!currentData) return currentData;

        return {
          ...currentData,
          pages: currentData.pages.map((page) => ({
            ...page,
            news: page.news.map((item) =>
              item.id === matchId
                ? applyOptimisticReaction(item, reaction, currentReaction)
                : item
            ),
          })),
        };
      });

      return { previousData, queryKey, matchId };
    },
    onError: (_error, _variables, context) => {
      if (!context?.previousData || !context.queryKey) return;
      queryClient.setQueryData(context.queryKey, context.previousData);
    },
    onSettled: (_data, _error, variables, context) => {
      if (!userId) return;
      if (context?.queryKey) {
        void queryClient.invalidateQueries({ queryKey: context.queryKey });
      } else {
        void queryClient.invalidateQueries({ queryKey: queryKeys.news.feed(userId) });
      }

      void queryClient.invalidateQueries({
        queryKey: queryKeys.news.reactionPeople(variables.matchId),
      });
    },
  });
}

// Hook para buscar notícias com paginação (baseado em partidas validadas)
export function useNews(userId?: string, enabled: boolean = true) {
  const supabase = useMemo(() => createClient(), []);
  const isEnabled = enabled && !!userId;

  return useInfiniteQuery({
    queryKey: queryKeys.news.feed(userId),
    queryFn: ({ pageParam = 0 }) => fetchNewsPage(supabase, pageParam, userId),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    enabled: isEnabled,
    staleTime: NEWS_STALE_TIME_MS,
    gcTime: NEWS_GC_TIME_MS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  });
}
