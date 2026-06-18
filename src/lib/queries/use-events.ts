"use client";

import { useQuery } from "@tanstack/react-query";
import type { TournamentEvent, TournamentEventDetail } from "@/lib/tournaments/types";

export const eventKeys = {
  all: ["events"] as const,
  list: () => ["events", "list"] as const,
  detail: (id: string) => ["events", "detail", id] as const,
};

async function fetchEvents(): Promise<TournamentEvent[]> {
  const res = await fetch("/api/events");
  if (!res.ok) throw new Error("Falha ao buscar eventos");
  return res.json();
}

async function fetchEvent(id: string): Promise<TournamentEventDetail> {
  const res = await fetch(`/api/events/${id}`);
  if (!res.ok) throw new Error("Evento não encontrado");
  return res.json();
}

export function useEvents() {
  return useQuery({
    queryKey: eventKeys.list(),
    queryFn: fetchEvents,
    staleTime: 30_000,
  });
}

export function useEvent(id: string, opts?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: eventKeys.detail(id),
    queryFn: () => fetchEvent(id),
    staleTime: 0,
    enabled: !!id,
    refetchInterval: opts?.refetchInterval,
  });
}
