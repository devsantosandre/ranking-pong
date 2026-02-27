"use client";

import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { queryKeys } from "./query-keys";

const PAGE_SIZE = 20;

export type User = {
  id: string;
  name: string | null;
  full_name: string | null;
  email: string | null;
  rating_atual: number | null;
  vitorias: number | null;
  derrotas: number | null;
  jogos_disputados: number | null;
};

function getViewerScopeKey(viewerId?: string) {
  return viewerId || "anonymous";
}

// Hook para buscar lista de usuários (apenas ativos)
export function useUsers(viewerId?: string) {
  const supabase = createClient();
  const viewerScopeKey = getViewerScopeKey(viewerId);

  return useQuery({
    queryKey: [...queryKeys.users.list(), "viewer", viewerScopeKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, full_name, email, rating_atual, vitorias, derrotas, jogos_disputados")
        .eq("is_active", true)
        .eq("hide_from_ranking", false)
        .order("name");

      if (error) throw error;
      return data as User[];
    },
  });
}

// Hook para buscar ranking com paginacao (ordenado por rating, apenas ativos)
export function useRanking(viewerId?: string) {
  const supabase = createClient();
  const viewerScopeKey = getViewerScopeKey(viewerId);

  return useInfiniteQuery({
    queryKey: [...queryKeys.users.ranking(), "viewer", viewerScopeKey],
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from("users")
        .select("id, name, full_name, email, rating_atual, vitorias, derrotas, jogos_disputados")
        .eq("is_active", true)
        .eq("hide_from_ranking", false)
        .gt("jogos_disputados", 0)
        .order("rating_atual", { ascending: false })
        .range(from, to);

      if (error) throw error;
      return {
        users: data as User[],
        nextPage: data && data.length === PAGE_SIZE ? pageParam + 1 : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
  });
}

// Hook para buscar ranking completo (sem paginação)
export function useRankingAll(viewerId?: string) {
  const supabase = createClient();
  const viewerScopeKey = getViewerScopeKey(viewerId);

  return useQuery({
    queryKey: [...queryKeys.users.ranking(), "all", "viewer", viewerScopeKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, full_name, email, rating_atual, vitorias, derrotas, jogos_disputados")
        .eq("is_active", true)
        .eq("hide_from_ranking", false)
        .gt("jogos_disputados", 0)
        .order("rating_atual", { ascending: false });

      if (error) throw error;
      return (data ?? []) as User[];
    },
    staleTime: 1000 * 30,
  });
}

// Hook para buscar um usuário específico
export function useUser(userId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: queryKeys.users.detail(userId || ""),
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;
      return data as User;
    },
    enabled: !!userId,
  });
}

// Hook para buscar posição real do usuário no ranking completo
export function useUserRankingPosition(userId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: queryKeys.users.position(userId || ""),
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from("users")
        .select("id")
        .eq("is_active", true)
        .eq("hide_from_ranking", false)
        .gt("jogos_disputados", 0)
        .order("rating_atual", { ascending: false });

      if (error) throw error;

      const rankingRows = (data ?? []) as Array<{ id: string }>;
      const index = rankingRows.findIndex((item) => item.id === userId);
      return index >= 0 ? index + 1 : null;
    },
    enabled: !!userId,
    staleTime: 1000 * 30,
  });
}





