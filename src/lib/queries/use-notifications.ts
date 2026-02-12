"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { queryKeys } from "./query-keys";

export function usePendingActionCount(userId?: string) {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: queryKeys.matches.pendingActions(userId || "anonymous"),
    queryFn: async () => {
      if (!userId) return 0;

      const { count, error } = await supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .in("status", ["pendente", "edited"])
        .or(`player_a_id.eq.${userId},player_b_id.eq.${userId}`)
        .neq("criado_por", userId);

      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!userId,
    staleTime: 1000 * 10,
    refetchInterval: 1000 * 30,
    refetchIntervalInBackground: true,
  });
}
