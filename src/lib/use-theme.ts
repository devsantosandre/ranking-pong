"use client";

import { useCallback, useSyncExternalStore } from "react";

export type ThemePref = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "arena-theme";

function systemPrefersDark(): boolean {
  return typeof window !== "undefined"
    && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function readPref(): ThemePref {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

/** Aplica/remove a classe `dark` no <html> conforme a preferência. */
function applyTheme(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

// Store externo (localStorage + matchMedia) consumido via useSyncExternalStore —
// evita setState em efeito e funciona com SSR sem mismatch de hidratação.
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_STORAGE_KEY) onChange();
  };
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => {
    applyTheme(readPref()); // segue o sistema quando pref === "system"
    onChange();
  };
  window.addEventListener("storage", onStorage);
  mq.addEventListener("change", onSystem);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
    mq.removeEventListener("change", onSystem);
  };
}

/**
 * Tema do app (claro/escuro/sistema). Persiste em localStorage, aplica a classe
 * `dark` no <html> e reage a mudanças do sistema. O flash inicial é evitado pelo
 * script inline em app/layout.tsx (que aplica a mesma lógica antes do paint).
 */
export function useTheme() {
  const pref = useSyncExternalStore(subscribe, readPref, () => "system" as ThemePref);

  const setTheme = useCallback((next: ThemePref) => {
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next);
    listeners.forEach((l) => l());
  }, []);

  return { pref, setTheme };
}
