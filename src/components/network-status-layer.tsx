"use client";

import { onlineManager, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Wifi, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type NetworkState = "online" | "checking" | "offline";

const HEALTH_CHECK_URL = "/api/health";
const HEALTH_CHECK_TIMEOUT_MS = 4000;
const OFFLINE_RECHECK_MS = 12000;
const ONLINE_REVALIDATE_MS = 45000;
const ONLINE_TOAST_MS = 2500;

function getInitialNetworkState(): NetworkState {
  if (typeof window === "undefined") return "online";
  return navigator.onLine ? "online" : "offline";
}

export function NetworkStatusLayer() {
  const queryClient = useQueryClient();
  const [networkState, setNetworkState] = useState<NetworkState>(getInitialNetworkState);
  const [showOnlineToast, setShowOnlineToast] = useState(false);

  const stateRef = useRef<NetworkState>(getInitialNetworkState());
  const initializedRef = useRef(false);
  const healthCheckControllerRef = useRef<AbortController | null>(null);
  const healthCheckRunIdRef = useRef(0);

  const applyNetworkState = useCallback(
    (nextState: NetworkState) => {
      const previousState = stateRef.current;
      if (previousState === nextState) return;

      stateRef.current = nextState;
      setNetworkState(nextState);
      onlineManager.setOnline(nextState === "online");

      if (initializedRef.current && previousState !== "online" && nextState === "online") {
        setShowOnlineToast(true);
        void queryClient.resumePausedMutations();
        void queryClient.refetchQueries({ type: "active" });
      }
    },
    [queryClient]
  );

  const runHealthCheck = useCallback(
    async (showCheckingState: boolean) => {
      if (typeof window === "undefined") return;

      if (!navigator.onLine) {
        healthCheckControllerRef.current?.abort();
        applyNetworkState("offline");
        return;
      }

      if (showCheckingState && stateRef.current !== "online") {
        applyNetworkState("checking");
      }

      const runId = ++healthCheckRunIdRef.current;
      const controller = new AbortController();
      healthCheckControllerRef.current?.abort();
      healthCheckControllerRef.current = controller;

      const timeoutId = window.setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

      try {
        const response = await fetch(HEALTH_CHECK_URL, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
          headers: {
            "x-network-check": "1",
          },
        });

        if (healthCheckRunIdRef.current !== runId) return;
        applyNetworkState(response.ok ? "online" : "offline");
      } catch {
        if (healthCheckRunIdRef.current !== runId) return;
        if (controller.signal.aborted && navigator.onLine) {
          applyNetworkState("offline");
          return;
        }
        applyNetworkState("offline");
      } finally {
        window.clearTimeout(timeoutId);
        if (healthCheckControllerRef.current === controller) {
          healthCheckControllerRef.current = null;
        }
      }
    },
    [applyNetworkState]
  );

  useEffect(() => {
    onlineManager.setOnline(stateRef.current === "online");
    initializedRef.current = true;

    void runHealthCheck(false);

    const handleOffline = () => {
      healthCheckControllerRef.current?.abort();
      applyNetworkState("offline");
    };

    const handleOnline = () => {
      void runHealthCheck(true);
    };

    const handleVisibilityOrFocus = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void runHealthCheck(stateRef.current !== "online");
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    const offlineInterval = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (stateRef.current !== "online") {
        void runHealthCheck(true);
      }
    }, OFFLINE_RECHECK_MS);

    const onlineInterval = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (stateRef.current === "online") {
        void runHealthCheck(false);
      }
    }, ONLINE_REVALIDATE_MS);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.clearInterval(offlineInterval);
      window.clearInterval(onlineInterval);
      healthCheckControllerRef.current?.abort();
    };
  }, [applyNetworkState, runHealthCheck]);

  useEffect(() => {
    if (!showOnlineToast) return;

    const timer = window.setTimeout(() => {
      setShowOnlineToast(false);
    }, ONLINE_TOAST_MS);

    return () => window.clearTimeout(timer);
  }, [showOnlineToast]);

  const showPersistentBanner = networkState === "offline" || networkState === "checking";

  return (
    <>
      {showPersistentBanner ? (
        <div className="pointer-events-none fixed inset-x-0 top-2 z-[95] flex justify-center px-3">
          <div
            className={`flex w-full max-w-[440px] items-center gap-2 rounded-xl border px-3 py-2 shadow-lg backdrop-blur ${
              networkState === "offline"
                ? "border-red-200 bg-red-50/95 text-red-700"
                : "border-amber-200 bg-amber-50/95 text-amber-700"
            }`}
            role="status"
            aria-live="polite"
          >
            {networkState === "offline" ? (
              <WifiOff className="h-4 w-4 shrink-0" />
            ) : (
              <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" />
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold">
                {networkState === "offline" ? "Sem conexão com a internet" : "Reconectando..."}
              </p>
              <p className="truncate text-[11px] opacity-90">
                {networkState === "offline"
                  ? "Mostrando dados em cache quando disponíveis."
                  : "Tentando restabelecer a conexão com o servidor."}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {!showPersistentBanner && showOnlineToast ? (
        <div className="pointer-events-none fixed inset-x-0 top-2 z-[95] flex justify-center px-3">
          <div
            className="flex w-full max-w-[420px] items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/95 px-3 py-2 text-emerald-700 shadow-lg backdrop-blur"
            role="status"
            aria-live="polite"
          >
            <Wifi className="h-4 w-4 shrink-0" />
            <p className="text-xs font-semibold">Conexão restabelecida</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
