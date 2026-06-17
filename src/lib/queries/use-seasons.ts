"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { getSeasonOverviewAction } from "@/app/actions/seasons";
import { queryKeys } from "./query-keys";

export type Season = {
  id: string;
  name: string;
  slug: string | null;
  starts_at: string;
  ends_at: string;
  status: "upcoming" | "active" | "closed";
  recurrence: "none" | "weekly" | "monthly" | "quarterly" | "semiannual";
  champion_user_id: string | null;
  closed_at: string | null;
  created_at: string;
};

export type SeasonStandingEntry = {
  id: string;
  full_name: string | null;
  name: string | null;
  email: string | null;
  points: number;
  wins: number;
  losses: number;
  games: number;
  zebra_wins: number;
  win_rate: number | null;
  position: number;
};

type StandingsRow = {
  user_id: string;
  points: number;
  wins: number;
  losses: number;
  games: number;
  zebra_wins: number;
  win_rate: number | null;
  position: number | null;
  user: {
    id: string;
    full_name: string | null;
    name: string | null;
    email: string | null;
    is_active: boolean;
    hide_from_ranking: boolean;
  } | null;
};

export function useActiveSeason() {
  return useQuery({
    queryKey: queryKeys.seasons.active(),
    // Chama server action para também disparar enforceSeasonLifecycle() em after()
    queryFn: getSeasonOverviewAction,
    staleTime: 1000 * 30,
  });
}

export type ClosedSeason = Season & {
  champion: {
    id: string;
    full_name: string | null;
    name: string | null;
    email: string | null;
  } | null;
};

export type UserSeasonStanding = {
  points: number;
  wins: number;
  losses: number;
  games: number;
  position: number | null;
  win_rate: number | null;
} | null;

export function useClosedSeasons() {
  const supabase = createClient();
  return useQuery({
    queryKey: queryKeys.seasons.closed(),
    queryFn: async (): Promise<ClosedSeason[]> => {
      const { data, error } = await supabase
        .from("seasons")
        .select(`
          id, name, slug, starts_at, ends_at, status, recurrence,
          champion_user_id, closed_at, created_at,
          champion:users!champion_user_id(id, full_name, name, email)
        `)
        .eq("status", "closed")
        .order("ends_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClosedSeason[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useAllSeasons() {
  const supabase = createClient();
  return useQuery({
    queryKey: queryKeys.seasons.list(),
    queryFn: async (): Promise<ClosedSeason[]> => {
      const { data, error } = await supabase
        .from("seasons")
        .select(`
          id, name, slug, starts_at, ends_at, status, recurrence,
          champion_user_id, closed_at, created_at,
          champion:users!champion_user_id(id, full_name, name, email)
        `)
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClosedSeason[];
    },
    staleTime: 1000 * 30,
  });
}

export function useUserSeasonStanding(
  seasonId?: string | null,
  userId?: string | null
) {
  const supabase = createClient();
  return useQuery({
    queryKey: queryKeys.seasons.userStanding(seasonId ?? "", userId ?? ""),
    queryFn: async (): Promise<UserSeasonStanding> => {
      if (!seasonId || !userId) return null;
      const { data, error } = await supabase
        .from("season_standings")
        .select("points, wins, losses, games, position, win_rate")
        .eq("season_id", seasonId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data as UserSeasonStanding;
    },
    enabled: !!seasonId && !!userId,
    staleTime: 1000 * 30,
  });
}

export function useSeasonStandings(seasonId?: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: queryKeys.seasons.standings(seasonId ?? ""),
    queryFn: async (): Promise<SeasonStandingEntry[]> => {
      if (!seasonId) return [];

      const { data, error } = await supabase
        .from("season_standings")
        .select(`
          user_id, points, wins, losses, games, zebra_wins, win_rate, position,
          user:users!user_id(id, full_name, name, email, is_active, hide_from_ranking)
        `)
        .eq("season_id", seasonId)
        .order("points", { ascending: false })
        .order("win_rate", { ascending: false })
        .order("wins", { ascending: false });

      if (error) throw error;

      return (data as StandingsRow[] ?? [])
        .filter((row) => row.user?.is_active && !row.user?.hide_from_ranking)
        .map((row, index) => ({
          id: row.user?.id ?? row.user_id,
          full_name: row.user?.full_name ?? null,
          name: row.user?.name ?? null,
          email: row.user?.email ?? null,
          points: row.points,
          wins: row.wins,
          losses: row.losses,
          games: row.games,
          zebra_wins: row.zebra_wins,
          win_rate: row.win_rate,
          position: row.position ?? index + 1,
        }));
    },
    enabled: !!seasonId,
    staleTime: 1000 * 30,
  });
}
