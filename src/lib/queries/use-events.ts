"use client";

import { useQuery } from "@tanstack/react-query";
import type { EventListItem, TournamentEventDetail, EventSignup } from "@/lib/tournaments/types";

export const eventKeys = {
  all: ["events"] as const,
  list: () => ["events", "list"] as const,
  detail: (id: string) => ["events", "detail", id] as const,
  signups: (id: string) => ["events", "signups", id] as const,
};

async function fetchEvents(): Promise<EventListItem[]> {
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

async function fetchEventSignups(id: string): Promise<EventSignup[]> {
  const res = await fetch(`/api/events/${id}/signups`);
  if (!res.ok) throw new Error("Falha ao buscar inscrições");
  return res.json();
}

export function useEventSignups(id: string, enabled = true) {
  return useQuery({
    queryKey: eventKeys.signups(id),
    queryFn: () => fetchEventSignups(id),
    staleTime: 0,
    enabled: !!id && enabled,
  });
}
