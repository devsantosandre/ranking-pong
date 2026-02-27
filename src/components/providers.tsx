"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/lib/auth-store";
import { AuthGuard } from "@/components/auth-guard";
import { getQueryClient } from "@/lib/query-client";
import type { ReactNode } from "react";
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
  const guardedChildren = <AuthGuard>{children}</AuthGuard>;

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

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ProvidersContent>{children}</ProvidersContent>
      </AuthProvider>
    </QueryClientProvider>
  );
}
