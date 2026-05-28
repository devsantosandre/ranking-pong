"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { queryKeys } from "./query-keys";

const BUSINESS_TIMEZONE = "America/Sao_Paulo";

function getBusinessDateIso(): string {
  // Date no fuso de negócio (mesmo usado no RPC).
  // 'en-CA' produz YYYY-MM-DD pronto para comparar com a coluna date.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
  }).format(new Date());
}

export type DailyLimitPairStatus = {
  jogosHoje: number;
  date: string;
};

export function useDailyLimitForPair(
  playerId: string | undefined,
  opponentId: string | undefined
) {
  const supabase = createClient();
  const date = getBusinessDateIso();

  return useQuery<DailyLimitPairStatus>({
    queryKey:
      playerId && opponentId
        ? queryKeys.dailyLimits.check(playerId, opponentId, date)
        : [...queryKeys.dailyLimits.all, "idle"],
    queryFn: async () => {
      if (!playerId || !opponentId || playerId === opponentId) {
        return { jogosHoje: 0, date };
      }

      const { data, error } = await supabase
        .from("daily_limits")
        .select("jogos_registrados")
        .eq("data", date)
        .or(
          `and(user_id.eq.${playerId},opponent_id.eq.${opponentId}),and(user_id.eq.${opponentId},opponent_id.eq.${playerId})`
        );

      if (error) throw error;

      const rows = (data ?? []) as { jogos_registrados: number | null }[];
      const max = rows.reduce(
        (acc: number, row) => Math.max(acc, row.jogos_registrados ?? 0),
        0
      );

      return { jogosHoje: max, date };
    },
    enabled: Boolean(playerId && opponentId && playerId !== opponentId),
    staleTime: 1000 * 15,
    refetchOnWindowFocus: true,
  });
}
