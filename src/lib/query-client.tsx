"use client";

import { QueryClient, isServer, onlineManager } from "@tanstack/react-query";

export const QUERY_PERSISTENCE_KEY = "ranking-pong-query-cache-v1";
export const QUERY_PERSISTENCE_MAX_AGE_MS = 1000 * 60 * 60 * 6; // 6 horas

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Com SSR, definimos staleTime > 0 para evitar refetch imediato no cliente
        staleTime: 60 * 1000, // 1 minuto
        gcTime: 1000 * 60 * 60, // 1 hora em memória para navegação/resume
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        networkMode: "offlineFirst",
        retry: (failureCount) => {
          if (isServer) return failureCount < 2;
          if (!onlineManager.isOnline()) return false;
          return failureCount < 2;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 8000),
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient() {
  if (isServer) {
    // Servidor: sempre cria um novo cliente
    return makeQueryClient();
  } else {
    // Browser: reutiliza o cliente existente
    if (!browserQueryClient) {
      browserQueryClient = makeQueryClient();
    }
    return browserQueryClient;
  }
}








