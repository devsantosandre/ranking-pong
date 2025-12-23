"use client";

import { QueryClient, isServer } from "@tanstack/react-query";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Com SSR, definimos staleTime > 0 para evitar refetch imediato no cliente
        staleTime: 60 * 1000, // 1 minuto
        refetchOnWindowFocus: false,
        retry: 1,
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







