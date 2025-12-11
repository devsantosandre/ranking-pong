"use client";

import { useSyncExternalStore } from "react";

export type NewsEntry = {
  id: string;
  title: string;
  season?: string;
  timeAgo: string;
  winner: string;
  loser: string;
  score: string;
};

type NewsState = {
  posts: NewsEntry[];
};

let state: NewsState = {
  posts: [
    {
      id: "n1",
      title: "BARRAGEM MASCULINA SESC TAGUATINGA SUL",
      season: "42ª Temporada",
      timeAgo: "15 horas",
      winner: "Felipe Velter Teles",
      loser: "Saulo Velter Teles",
      score: "6x3 4x6 10x6",
    },
  ],
};

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}

export function useNewsStore() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}

export function addNews(entry: Omit<NewsEntry, "id" | "timeAgo">) {
  const newEntry: NewsEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timeAgo: "Agora",
  };
  state = { posts: [newEntry, ...state.posts] };
  notify();
}
