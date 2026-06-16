import { createAdminClient } from "@/utils/supabase/admin";
import { sendPushToUsers } from "@/lib/push";

type AdminSupabaseClient = ReturnType<typeof createAdminClient>;

type CloseSeasonRpcResult = {
  ok: boolean;
  already_closed?: boolean;
  champion_user_id?: string | null;
  champion_name?: string | null;
  season_name?: string;
  reason?: string;
};

/**
 * Throttle de módulo: no máximo 1 execução por minuto por processo Node.
 * Evita trabalho duplicado quando vários after() disparam em sequência.
 */
let _lifecycleLastRunAt = 0;
const LIFECYCLE_MIN_INTERVAL_MS = 60_000;

/**
 * Verifica e encerra temporadas ativas cuja data de encerramento já passou.
 * Chamada em after() nas leituras do ranking — sem cron, sem infra extra.
 */
export async function enforceSeasonLifecycle(params?: {
  supabase?: AdminSupabaseClient;
}) {
  const now = Date.now();
  if (now - _lifecycleLastRunAt < LIFECYCLE_MIN_INTERVAL_MS) return;
  _lifecycleLastRunAt = now;

  const supabase = params?.supabase ?? createAdminClient();

  const { data: expiredSeasons, error } = await supabase
    .from("seasons")
    .select("id, name, slug")
    .eq("status", "active")
    .lte("ends_at", new Date().toISOString());

  if (error || !expiredSeasons?.length) return;

  for (const season of expiredSeasons) {
    const { data: rpcData, error: rpcError } = await supabase.rpc("close_season", {
      p_season_id: season.id,
      p_actor_id: null,
    });

    if (rpcError) {
      console.error("[enforceSeasonLifecycle] close_season failed", {
        seasonId: season.id,
        reason: rpcError.message,
      });
      continue;
    }

    const result = rpcData as CloseSeasonRpcResult;
    if (!result?.ok || result.already_closed) continue;

    // Push para todos os participantes
    const { data: standings } = await supabase
      .from("season_standings")
      .select("user_id")
      .eq("season_id", season.id);

    const userIds = (standings ?? []).map((s: { user_id: string }) => s.user_id);

    if (userIds.length > 0) {
      await sendPushToUsers(userIds, {
        title: `${result.season_name ?? season.name} encerrada!`,
        body: result.champion_name
          ? `${result.champion_name} é o campeão da temporada!`
          : "A temporada foi encerrada.",
        url: "/temporadas",
        tag: `season-closed-${season.id}`,
      });
    }

    // Log de auditoria
    await supabase.from("admin_logs").insert({
      admin_id: null,
      admin_role: "system",
      action: "season_auto_closed",
      action_description: `Temporada "${result.season_name ?? season.name}" encerrada automaticamente.`,
      target_type: "season",
      target_id: season.id,
      target_name: result.season_name ?? season.name,
      old_value: { status: "active" },
      new_value: {
        status: "closed",
        champion_id: result.champion_user_id,
        champion_name: result.champion_name,
      },
      reason: null,
    });
  }
}
