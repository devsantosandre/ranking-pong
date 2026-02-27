"use client";

import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useQueryClient } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/lib/auth-store";
import { AuthGuard } from "@/components/auth-guard";
import {
  QUERY_PERSISTENCE_MAX_AGE_MS,
  getQueryClient,
} from "@/lib/query-client";
import { getQueryPersister } from "@/lib/query-persistence";
import { clearClientSessionData } from "@/lib/client-session-cleanup";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import dynamic from "next/dynamic";

const AuthenticatedAppRuntime = dynamic(
  () =>
    import("@/components/authenticated-app-runtime").then(
      (module) => module.AuthenticatedAppRuntime
    ),
  { ssr: false }
);

function ProvidersContent({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const previousUserIdRef = useRef<string | null>(null);
  const guardedChildren = <AuthGuard>{children}</AuthGuard>;

  useEffect(() => {
    const currentUserId = user?.id ?? null;
    const previousUserId = previousUserIdRef.current;

    if (!previousUserId || previousUserId === currentUserId) {
      previousUserIdRef.current = currentUserId;
      return;
    }

    queryClient.clear();
    clearClientSessionData();
    previousUserIdRef.current = currentUserId;
  }, [user?.id, queryClient]);

  if (!user?.id) {
    return guardedChildren;
  }

  return (
    <AuthenticatedAppRuntime userId={user.id}>
      {guardedChildren}
    </AuthenticatedAppRuntime>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();
  const persister = useMemo(() => getQueryPersister(), []);
  const persistOptions = useMemo(
    () => ({
      persister,
      maxAge: QUERY_PERSISTENCE_MAX_AGE_MS,
      buster: "ranking-pong-cache-v1",
      dehydrateOptions: {
        shouldDehydrateQuery: (query: { queryKey: readonly unknown[]; state: { status: string } }) => {
          if (query.state.status !== "success") return false;
          const rootKey = query.queryKey[0];
          return rootKey !== "notifications";
        },
      },
    }),
    [persister]
  );

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}
      onSuccess={() => queryClient.resumePausedMutations()}
    >
      <AuthProvider>
        <ProvidersContent>{children}</ProvidersContent>
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}
