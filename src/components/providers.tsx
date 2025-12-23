"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth-store";
import { AuthGuard } from "@/components/auth-guard";
import { InstallPrompt } from "@/components/install-prompt";
import { getQueryClient } from "@/lib/query-client";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGuard>{children}</AuthGuard>
        <InstallPrompt />
      </AuthProvider>
    </QueryClientProvider>
  );
}
