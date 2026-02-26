"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { queryKeys } from "./query-keys";

const PAGE_SIZE = 20;
export const NEWS_STALE_TIME_MS = 1000 * 45;
export const NEWS_GC_TIME_MS = 1000 * 60 * 10;

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

export type NewsPage = {
  news: NewsItem[];
  nextPage: number | undefined;
};

function normalizeRelationUser(user: MatchUser | MatchUser[] | null): MatchUser | null {
  if (!user) return null;
  return Array.isArray(user) ? (user[0] ?? null) : user;
}

function getDisplayName(user: MatchUser | null, fallbackName: string) {
  if (!user) return fallbackName;
  return user.full_name || user.name || user.email?.split("@")[0] || fallbackName;
}

export async function fetchNewsPage(
  supabase: ReturnType<typeof createClient>,
  pageParam: number
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
    };
  });

  return {
    news,
    nextPage: rows.length === PAGE_SIZE ? pageParam + 1 : undefined,
  };
}

// Hook para buscar notícias com paginacao (baseado em partidas validadas)
export function useNews() {
  const supabase = useMemo(() => createClient(), []);

  return useInfiniteQuery({
    queryKey: queryKeys.news.all,
    queryFn: ({ pageParam = 0 }) => fetchNewsPage(supabase, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    staleTime: NEWS_STALE_TIME_MS,
    gcTime: NEWS_GC_TIME_MS,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });
}








