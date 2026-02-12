"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { queryKeys } from "@/lib/queries/query-keys";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type RealtimeUserRow = {
  id: string;
  rating_atual: number | null;
  vitorias: number | null;
  derrotas: number | null;
  jogos_disputados: number | null;
  is_active: boolean | null;
  hide_from_ranking: boolean | null;
  name: string | null;
  full_name: string | null;
};

const RANKING_RELEVANT_FIELDS: Array<keyof RealtimeUserRow> = [
  "rating_atual",
  "vitorias",
  "derrotas",
  "jogos_disputados",
  "is_active",
  "hide_from_ranking",
];

const PROFILE_RELEVANT_FIELDS: Array<keyof RealtimeUserRow> = [
  "name",
  "full_name",
];

const MATCH_ACTIVITY_FIELDS: Array<keyof RealtimeUserRow> = [
  "vitorias",
  "derrotas",
  "jogos_disputados",
];

const SYNC_DEBOUNCE_MS = 250;

type PendingSyncState = {
  rankingChanged: boolean;
  profileChanged: boolean;
  newsChanged: boolean;
  currentUserChanged: boolean;
};

function didFieldsChange(
  previous: RealtimeUserRow | null,
  next: RealtimeUserRow | null,
  fields: Array<keyof RealtimeUserRow>
) {
  if (!previous || !next) return true;
  return fields.some((field) => previous[field] !== next[field]);
}

export function useRealtimeRankingSync(userId?: string) {
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSyncStateRef = useRef<PendingSyncState>({
    rankingChanged: false,
    profileChanged: false,
    newsChanged: false,
    currentUserChanged: false,
  });

  const flushPendingSync = useCallback(() => {
    const pendingSync = pendingSyncStateRef.current;
    pendingSyncStateRef.current = {
      rankingChanged: false,
      profileChanged: false,
      newsChanged: false,
      currentUserChanged: false,
    };

    if (pendingSync.rankingChanged) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.rankingSearch.all });
    }

    if (pendingSync.profileChanged) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.matches.all });
    }

    if (pendingSync.newsChanged) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.news.all });
    }

    if (userId && pendingSync.currentUserChanged) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.users.detail(userId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.achievements.user(userId),
      });
    }
  }, [queryClient, userId]);

  const scheduleSync = useCallback(
    (syncState: PendingSyncState) => {
      pendingSyncStateRef.current = {
        rankingChanged:
          pendingSyncStateRef.current.rankingChanged || syncState.rankingChanged,
      profileChanged:
        pendingSyncStateRef.current.profileChanged || syncState.profileChanged,
      newsChanged: pendingSyncStateRef.current.newsChanged || syncState.newsChanged,
      currentUserChanged:
        pendingSyncStateRef.current.currentUserChanged ||
        syncState.currentUserChanged,
      };

      if (syncTimeoutRef.current) return;

      syncTimeoutRef.current = setTimeout(() => {
        syncTimeoutRef.current = null;
        flushPendingSync();
      }, SYNC_DEBOUNCE_MS);
    },
    [flushPendingSync]
  );

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`ranking-sync-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "users",
        },
        (payload: RealtimePostgresChangesPayload<RealtimeUserRow>) => {
          const previous = payload.old as RealtimeUserRow | null;
          const next = payload.new as RealtimeUserRow | null;
          const changedUserId = next?.id ?? previous?.id;
          const currentUserChanged = changedUserId === userId;

          const rankingChanged =
            payload.eventType !== "UPDATE" ||
            didFieldsChange(previous, next, RANKING_RELEVANT_FIELDS);
          const profileChanged =
            payload.eventType !== "UPDATE" ||
            didFieldsChange(previous, next, PROFILE_RELEVANT_FIELDS);
          const newsChanged =
            payload.eventType !== "UPDATE" ||
            didFieldsChange(previous, next, MATCH_ACTIVITY_FIELDS) ||
            profileChanged;

          if (!rankingChanged && !profileChanged && !newsChanged && !currentUserChanged) {
            return;
          }

          scheduleSync({
            rankingChanged,
            profileChanged,
            newsChanged,
            currentUserChanged,
          });
        }
      )
      .subscribe();

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
        flushPendingSync();
      }
      void supabase.removeChannel(channel);
    };
  }, [flushPendingSync, scheduleSync, supabase, userId]);
}
