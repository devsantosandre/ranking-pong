"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Tournament, TournamentDetail } from "@/lib/tournaments/types";

export const tournamentKeys = {
  all: ["tournaments"] as const,
  list: (status?: Tournament["status"]) => ["tournaments", "list", status ?? "all"] as const,
  detail: (id: string) => ["tournaments", "detail", id] as const,
  bracket: (id: string) => ["tournaments", "bracket", id] as const,
  standings: (id: string) => ["tournaments", "standings", id] as const,
};

async function fetchTournaments(status?: Tournament["status"]): Promise<Tournament[]> {
  const params = status ? `?status=${status}` : "";
  const res = await fetch(`/api/tournaments${params}`);
  if (!res.ok) throw new Error("Falha ao buscar torneios");
  return res.json();
}

async function fetchTournament(id: string): Promise<TournamentDetail> {
  const res = await fetch(`/api/tournaments/${id}`);
  if (!res.ok) throw new Error("Torneio não encontrado");
  return res.json();
}

export function useTournaments(status?: Tournament["status"]) {
  return useQuery({
    queryKey: tournamentKeys.list(status),
    queryFn: () => fetchTournaments(status),
    staleTime: 30_000,
  });
}

export function useTournament(id: string) {
  return useQuery({
    queryKey: tournamentKeys.detail(id),
    queryFn: () => fetchTournament(id),
    staleTime: 0,
    enabled: !!id,
  });
}

export function useTournamentBracket(id: string, opts?: { live?: boolean }) {
  return useQuery({
    queryKey: tournamentKeys.bracket(id),
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/${id}/bracket`);
      if (!res.ok) throw new Error("Falha ao buscar bracket");
      return res.json();
    },
    staleTime: 5_000,
    enabled: !!id,
    // Quando ao vivo, faz polling como fallback de tempo real (cobre mock,
    // múltiplas abas e complementa o realtime do Supabase).
    refetchInterval: opts?.live ? 8_000 : false,
    refetchOnWindowFocus: true,
  });
}

export function useTournamentStandings(id: string) {
  return useQuery({
    queryKey: tournamentKeys.standings(id),
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/${id}/standings`);
      if (!res.ok) throw new Error("Falha ao buscar standings");
      return res.json();
    },
    staleTime: 15_000,
    enabled: !!id,
  });
}
