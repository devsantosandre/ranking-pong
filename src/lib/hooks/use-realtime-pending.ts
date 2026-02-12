"use client";

import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { queryKeys } from "@/lib/queries/query-keys";
import type { PendingNotificationPayloadV1 } from "@/lib/types/notifications";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type NotificationRow = {
  user_id: string;
  tipo: string;
  payload: PendingNotificationPayloadV1 | null;
};

export function useRealtimePendingSync(userId?: string) {
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`pending-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<NotificationRow>) => {
          const row = payload.new as NotificationRow;

          if (row.tipo !== "confirmacao") return;

          void queryClient.invalidateQueries({ queryKey: queryKeys.matches.all });
          void queryClient.invalidateQueries({
            queryKey: queryKeys.matches.pendingActions(userId),
          });
          void queryClient.invalidateQueries({
            queryKey: queryKeys.notifications.user(userId),
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, supabase, userId]);
}
