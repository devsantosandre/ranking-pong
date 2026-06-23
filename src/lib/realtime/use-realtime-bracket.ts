"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { tournamentKeys } from "@/lib/queries/use-tournaments";
import type { TournamentMatch } from "@/lib/tournaments/types";
import { matchFromRow } from "@/lib/tournaments/types";

export function useRealtimeBracket(tournamentId: string) {
  const queryClient = useQueryClient();
  const coalesceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUpdates = useRef<Map<string, TournamentMatch>>(new Map());

  useEffect(() => {
    if (!tournamentId) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channel: any;

    async function subscribe() {
      const { createClient } = await import("@/utils/supabase/client");
      const supabase = createClient();

      channel = supabase
        .channel(`tournament:${tournamentId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "tournament_matches",
            filter: `tournament_id=eq.${tournamentId}`,
          },
          (payload: { new: Record<string, unknown> }) => {
            const updated = matchFromRow(payload.new);
            pendingUpdates.current.set(updated.id, updated);

            if (coalesceTimer.current) clearTimeout(coalesceTimer.current);
            coalesceTimer.current = setTimeout(() => {
              const updates = Array.from(pendingUpdates.current.values());
              pendingUpdates.current.clear();

              queryClient.setQueryData(
                tournamentKeys.bracket(tournamentId),
                (old: { matches: TournamentMatch[]; participants: unknown[] } | undefined) => {
                  if (!old) return old;
                  const matchMap = new Map(old.matches.map((m) => [m.id, m]));
                  for (const u of updates) matchMap.set(u.id, u);
                  return { ...old, matches: Array.from(matchMap.values()) };
                },
              );
            }, 150);
          },
        )
        .subscribe();
    }

    subscribe();

    return () => {
      if (coalesceTimer.current) clearTimeout(coalesceTimer.current);
      if (channel) channel.unsubscribe();
    };
  }, [tournamentId, queryClient]);
}
