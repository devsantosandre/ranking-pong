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

// Hook para buscar lista de usuários (apenas ativos)
export function useUsers() {
  const supabase = createClient();

  return useQuery({
    queryKey: queryKeys.users.list(),
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
export function useRanking() {
  const supabase = createClient();

  return useInfiniteQuery({
    queryKey: queryKeys.users.ranking(),
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from("users")
        .select("id, name, full_name, email, rating_atual, vitorias, derrotas, jogos_disputados")
        .eq("is_active", true)
        .eq("hide_from_ranking", false)
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










