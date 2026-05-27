"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/query-keys";
import { flushPendingMatchQueue } from "./register-match-client";
import { getAllPendingMatches } from "./match-sync-queue";

async function tryNotifyServiceWorkerFlush(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const syncManager = (
      registration as ServiceWorkerRegistration & {
        sync?: { register: (tag: string) => Promise<void> };
      }
    ).sync;

    if (syncManager) {
      await syncManager.register("register-match");
      return true;
    }

    if (registration.active) {
      registration.active.postMessage({ type: "flush-pending-matches" });
      return true;
    }
  } catch {
    // silencia — fallback no flush direto
  }

  return false;
}

export function usePendingMatchFlush(userId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    if (typeof window === "undefined") return;

    let cancelled = false;

    async function flushOnce() {
      if (cancelled) return;

      try {
        const pending = await getAllPendingMatches();
        if (pending.length === 0) return;

        const dispatched = await tryNotifyServiceWorkerFlush();
        const result = dispatched
          ? { succeeded: 0, dropped: 0 }
          : await flushPendingMatchQueue();

        if (result.succeeded > 0 || result.dropped > 0) {
          queryClient.invalidateQueries({ queryKey: queryKeys.matches.all });
        }
      } catch (error) {
        console.error("pending_match_flush_failed", error);
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void flushOnce();
      }
    }

    function handleOnline() {
      void flushOnce();
    }

    void flushOnce();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleOnline);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleOnline);
    };
  }, [queryClient, userId]);
}
