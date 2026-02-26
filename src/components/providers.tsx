"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/lib/auth-store";
import { AuthGuard } from "@/components/auth-guard";
import { InstallPrompt } from "@/components/install-prompt";
import { AchievementUnlockToastHost } from "@/components/achievement-unlock-toast";
import { NetworkStatusLayer } from "@/components/network-status-layer";
import { getQueryClient } from "@/lib/query-client";
import { useRealtimePendingSync } from "@/lib/hooks/use-realtime-pending";
import { useRealtimeRankingSync } from "@/lib/hooks/use-realtime-ranking-sync";
import { usePrefetchNews } from "@/lib/hooks/use-prefetch-news";
import { PushSubscriptionProvider } from "@/lib/hooks/use-push-subscription";
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

function NewsPrefetchBridge() {
  const { user } = useAuth();

  usePrefetchNews(!!user?.id);

  return null;
}

function AchievementToastBridge() {
  const { user } = useAuth();

  return (
    <AchievementUnlockToastHost
      key={user?.id || "anonymous"}
      userId={user?.id}
    />
  );
}

function PushSubscriptionBridge({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  return <PushSubscriptionProvider userId={user?.id}>{children}</PushSubscriptionProvider>;
}

export function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RealtimePendingBridge />
        <RealtimeRankingBridge />
        <NewsPrefetchBridge />
        <PushSubscriptionBridge>
          <AuthGuard>{children}</AuthGuard>
          <NetworkStatusLayer />
          <InstallPrompt />
          <AchievementToastBridge />
        </PushSubscriptionBridge>
      </AuthProvider>
    </QueryClientProvider>
  );
}
