"use client";

import { useSyncExternalStore } from "react";
import { addNews } from "@/lib/news-store";

type MatchStatus = "pendente" | "validado" | "contestado";

export type MatchEntry = {
  id: string;
  me: string;
  opponent: string;
  outcome: string; // ex: "3x1"
  horario: string;
  status: MatchStatus;
  delta?: string;
  setsDesc?: string;
  edited?: boolean; // true se foi ajustado por contestação
  lastActionBy?: string; // quem lançou/ajustou por último
};

type MatchState = {
  pendentes: MatchEntry[];
  recentes: MatchEntry[];
};

const listeners = new Set<() => void>();
let state: MatchState = {
  pendentes: [
    {
      id: "p2",
      me: "Felipe Velter",
      opponent: "Alice Jogadora",
      outcome: "0x3",
      horario: "Ontem 20:10",
      status: "pendente",
      edited: true,
      lastActionBy: "Felipe Velter",
    },
  ],
  recentes: [
    {
      id: "r1",
      me: "Lucas",
      opponent: "André",
      outcome: "3x2",
      delta: "+15 pts / -8 pts",
      setsDesc: "Set 1: 2/3 · Set 2: 1/3",
      horario: "Hoje, 10:30",
      status: "validado",
      lastActionBy: "Lucas",
    },
    {
      id: "r2",
      me: "Alice Jogadora",
      opponent: "Ricardo Oliveira",
      outcome: "3x2",
      delta: "+20 pts / -8 pts",
      setsDesc: "Resultado confirmado",
      horario: "Hoje 09:00",
      status: "validado",
      edited: false,
      lastActionBy: "Alice Jogadora",
    },
  ],
};

function notify() {
  listeners.forEach((l) => l());
}

export function useMatchStore() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}

function computeDelta(outcome: string) {
  const [aStr, bStr] = outcome.split("x");
  const a = Number(aStr);
  const b = Number(bStr);
  if (Number.isNaN(a) || Number.isNaN(b)) return { delta: undefined, winner: "a" as const };
  const youWin = a > b;
  return {
    winner: youWin ? "a" : "b",
    delta: youWin ? "+20 pts / -8 pts" : "-8 pts / +20 pts",
  };
}

export function registerMatch(input: {
  me: string;
  opponent: string;
  outcome: string;
  horario?: string;
}) {
  const horario = input.horario ?? "Agora";
  const entry: MatchEntry = {
    id: crypto.randomUUID(),
    me: input.me || "Você",
    opponent: input.opponent || "Adversário",
    outcome: input.outcome,
    horario,
    status: "pendente",
    lastActionBy: input.me,
  };
  state = {
    ...state,
    pendentes: [entry, ...state.pendentes],
  };
  notify();
}

export function confirmMatch(id: string) {
  const entry = state.pendentes.find((m) => m.id === id);
  if (!entry) return;
  const { delta } = computeDelta(entry.outcome);
  const updated: MatchEntry = {
    ...entry,
    status: "validado",
    delta,
    setsDesc: "Resultado confirmado",
    lastActionBy: entry.opponent,
  };
  addNews({
    title: "Resultado registrado",
    winner: entry.me,
    loser: entry.opponent,
    score: entry.outcome.replace("x", "x"),
  });
  state = {
    pendentes: state.pendentes.filter((m) => m.id !== id),
    recentes: [updated, ...state.recentes],
  };
  notify();
}

export function updateOutcome(id: string, outcome: string, actor: string) {
  const entry =
    state.pendentes.find((m) => m.id === id) ||
    state.recentes.find((m) => m.id === id);
  if (!entry) return;

  const updated: MatchEntry = {
    ...entry,
    outcome,
    status: "pendente",
    edited: true,
    delta: undefined,
    setsDesc: undefined,
    lastActionBy: actor,
  };

  state = {
    pendentes: [updated, ...state.pendentes.filter((m) => m.id !== id)],
    recentes: state.recentes.filter((m) => m.id !== id),
  };
  notify();
}
