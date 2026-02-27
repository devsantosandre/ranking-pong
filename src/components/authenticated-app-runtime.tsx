"use client";

import type { ReactNode } from "react";
import { InstallPrompt } from "@/components/install-prompt";
import { AchievementUnlockToastHost } from "@/components/achievement-unlock-toast";
import { NetworkStatusLayer } from "@/components/network-status-layer";
import { useRealtimePendingSync } from "@/lib/hooks/use-realtime-pending";
import { useRealtimeRankingSync } from "@/lib/hooks/use-realtime-ranking-sync";
import { usePrefetchNews } from "@/lib/hooks/use-prefetch-news";
import { PushSubscriptionProvider } from "@/lib/hooks/use-push-subscription";

function RealtimePendingBridge({ userId }: { userId: string }) {
  useRealtimePendingSync(userId);
  return null;
}

function RealtimeRankingBridge({ userId }: { userId: string }) {
  useRealtimeRankingSync(userId);
  return null;
}

function NewsPrefetchBridge() {
  usePrefetchNews(true);
  return null;
}

export function AuthenticatedAppRuntime({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  return (
    <PushSubscriptionProvider userId={userId}>
      <RealtimePendingBridge userId={userId} />
      <RealtimeRankingBridge userId={userId} />
      <NewsPrefetchBridge />
      {children}
      <NetworkStatusLayer />
      <InstallPrompt />
      <AchievementUnlockToastHost key={userId} userId={userId} />
    </PushSubscriptionProvider>
  );
}
