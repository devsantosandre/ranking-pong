"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { queryKeys } from "./query-keys";

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

// Hook para buscar lista de usuários
export function useUsers() {
  const supabase = createClient();

  return useQuery({
    queryKey: queryKeys.users.list(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, full_name, email, rating_atual, vitorias, derrotas, jogos_disputados")
        .order("name");

      if (error) throw error;
      return data as User[];
    },
  });
}

// Hook para buscar ranking (ordenado por rating)
export function useRanking() {
  const supabase = createClient();

  return useQuery({
    queryKey: queryKeys.users.ranking(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, full_name, email, rating_atual, vitorias, derrotas, jogos_disputados")
        .order("rating_atual", { ascending: false });

      if (error) throw error;
      return data as User[];
    },
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





