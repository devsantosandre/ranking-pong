"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/lib/auth-store";
import { AuthGuard } from "@/components/auth-guard";
import { InstallPrompt } from "@/components/install-prompt";
import { AchievementUnlockToast } from "@/components/achievement-unlock-toast";
import { getQueryClient } from "@/lib/query-client";
import { useRealtimePendingSync } from "@/lib/hooks/use-realtime-pending";
import { useRealtimeRankingSync } from "@/lib/hooks/use-realtime-ranking-sync";
import type { ReactNode } from "react";

function RealtimePendingBridge() {
  const { user } = useAuth();

  useRealtimePendingSync(user?.id);

  return null;
}

function RealtimeRankingBridge() {
  const { user } = useAuth();

  useRealtimeRankingSync(user?.id);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RealtimePendingBridge />
        <RealtimeRankingBridge />
        <AuthGuard>{children}</AuthGuard>
        <InstallPrompt />
        {/* ⚠️ PREVIEW MODE - Remover após ajustes */}
        <AchievementUnlockToast achievements={[]} onClose={() => {}} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
