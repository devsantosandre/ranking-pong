"use client";

import { QueryClient, isServer, onlineManager } from "@tanstack/react-query";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Com SSR, definimos staleTime > 0 para evitar refetch imediato no cliente
        staleTime: 60 * 1000, // 1 minuto
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
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









