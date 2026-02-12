"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";

type MatchUser = {
  id: string;
  name: string | null;
  full_name: string | null;
  email: string | null;
};

type LatestMatchRow = {
  id: string;
  player_a_id: string;
  player_b_id: string;
  resultado_a: number;
  resultado_b: number;
  updated_at: string | null;
  created_at: string | null;
  player_a: MatchUser | MatchUser[] | null;
  player_b: MatchUser | MatchUser[] | null;
};

export type LatestValidatedMatch = {
  id: string;
  playerAId: string;
  playerBId: string;
  playerAName: string;
  playerBName: string;
  score: string;
  happenedAt: string | null;
};

const latestMatchQueryKey = ["tv", "latest-validated-match"] as const;

function normalizeRelationUser(user: MatchUser | MatchUser[] | null): MatchUser | null {
  if (!user) return null;
  return Array.isArray(user) ? (user[0] ?? null) : user;
}

function getDisplayName(user: MatchUser | null) {
  if (!user) return "Jogador";
  return user.full_name || user.name || user.email?.split("@")[0] || "Jogador";
}

export function useLatestValidatedMatch() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  const refreshLatestMatch = useCallback(() => {
    void queryClient.refetchQueries({
      queryKey: latestMatchQueryKey,
      exact: true,
      type: "active",
    });
  }, [queryClient]);

  const query = useQuery({
    queryKey: latestMatchQueryKey,
    queryFn: async (): Promise<LatestValidatedMatch | null> => {
      const { data, error } = await supabase
        .from("matches")
        .select(
          `
          id,
          player_a_id,
          player_b_id,
          resultado_a,
          resultado_b,
          updated_at,
          created_at,
          player_a:users!player_a_id(id, name, full_name, email),
          player_b:users!player_b_id(id, name, full_name, email)
        `
        )
        .eq("status", "validado")
        .order("updated_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      const match = (data?.[0] ?? null) as LatestMatchRow | null;
      if (!match) return null;

      const playerA = normalizeRelationUser(match.player_a);
      const playerB = normalizeRelationUser(match.player_b);

      return {
        id: match.id,
        playerAId: match.player_a_id,
        playerBId: match.player_b_id,
        playerAName: getDisplayName(playerA),
        playerBName: getDisplayName(playerB),
        score: `${match.resultado_a} x ${match.resultado_b}`,
        happenedAt: match.updated_at || match.created_at,
      };
    },
    staleTime: 1000 * 5,
    refetchInterval: 1000 * 5,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    const channel = supabase
      .channel("tv-latest-match-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
        },
        () => {
          refreshLatestMatch();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, refreshLatestMatch]);

  return query;
}
