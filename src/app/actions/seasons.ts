"use server";

import { after } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireModerator, getCurrentUser } from "@/lib/admin";
import { sendPushToUsers } from "@/lib/push";
import { enforceSeasonLifecycle } from "@/lib/seasons/lifecycle";
import type { Season } from "@/lib/queries/use-seasons";

type CloseSeasonRpcResult = {
  ok: boolean;
  already_closed?: boolean;
  champion_user_id?: string | null;
  champion_name?: string | null;
  season_name?: string;
};

export type SeasonAdminResult =
  | { success: true }
  | { success: false; error: string };

// ── Leitura com verificação de ciclo de vida ──────────────────────────────────

/**
 * Retorna a temporada ativa e dispara enforceSeasonLifecycle() em after().
 * Deve ser usada como queryFn do useActiveSeason para garantir que temporadas
 * expiradas sejam encerradas automaticamente na primeira leitura do ranking.
 */
export async function getSeasonOverviewAction(): Promise<Season | null> {
  after(async () => {
    try {
      await enforceSeasonLifecycle({ supabase: createAdminClient() });
    } catch (e) {
      console.error("[after/getSeasonOverview/lifecycle]", e);
    }
  });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("seasons")
    .select(
      "id, name, slug, starts_at, ends_at, status, recurrence, champion_user_id, closed_at, created_at"
    )
    .eq("status", "active")
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as Season | null;
}

// ── Admin: encerrar agora ─────────────────────────────────────────────────────

export async function adminCloseSeasonNow(
  seasonId: string
): Promise<SeasonAdminResult> {
  try {
    await requireModerator();
    const actor = await getCurrentUser();
    const supabase = createAdminClient();

    const { data: rpcData, error: rpcError } = await supabase.rpc("close_season", {
      p_season_id: seasonId,
      p_actor_id: actor?.id ?? null,
    });

    if (rpcError) return { success: false, error: rpcError.message };

    const result = rpcData as CloseSeasonRpcResult;
    if (!result?.ok) return { success: false, error: "Falha ao encerrar temporada." };

    // Efeitos colaterais apenas quando realmente encerrou (não duplicar)
    if (!result.already_closed) {
      const { data: standings } = await supabase
        .from("season_standings")
        .select("user_id")
        .eq("season_id", seasonId);

      const userIds = (standings ?? []).map((s: { user_id: string }) => s.user_id);

      if (userIds.length > 0) {
        await sendPushToUsers(userIds, {
          title: `${result.season_name} encerrada!`,
          body: result.champion_name
            ? `${result.champion_name} é o campeão da temporada!`
            : "A temporada foi encerrada.",
          url: "/temporadas",
          tag: `season-closed-${seasonId}`,
        });
      }

      await supabase.from("admin_logs").insert({
        admin_id: actor?.id ?? null,
        admin_role: actor?.role ?? "admin",
        action: "season_closed_manual",
        action_description: `Temporada "${result.season_name}" encerrada manualmente.`,
        target_type: "season",
        target_id: seasonId,
        target_name: result.season_name ?? null,
        old_value: { status: "active" },
        new_value: {
          status: "closed",
          champion_id: result.champion_user_id,
          champion_name: result.champion_name,
        },
        reason: null,
      });
    }

    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Erro ao encerrar temporada.",
    };
  }
}

// ── Admin: reabrir ────────────────────────────────────────────────────────────

export async function adminReopenSeason(
  seasonId: string
): Promise<SeasonAdminResult> {
  try {
    await requireModerator();
    const actor = await getCurrentUser();
    const supabase = createAdminClient();

    const { data: season, error: fetchError } = await supabase
      .from("seasons")
      .select("id, name, slug, status")
      .eq("id", seasonId)
      .single();

    if (fetchError || !season) return { success: false, error: "Temporada não encontrada." };
    if (season.status !== "closed")
      return { success: false, error: "Só é possível reabrir temporadas encerradas." };

    const { error: updateError } = await supabase
      .from("seasons")
      .update({
        status: "active",
        champion_user_id: null,
        closed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", seasonId);

    if (updateError) return { success: false, error: updateError.message };

    // Limpar posições congeladas
    await supabase
      .from("season_standings")
      .update({ position: null })
      .eq("season_id", seasonId);

    // Remover notícia de encerramento
    const newsSlug = `campeao-${season.slug ?? seasonId}`;
    await supabase.from("news_posts").delete().eq("slug", newsSlug);

    await supabase.from("admin_logs").insert({
      admin_id: actor?.id ?? null,
      admin_role: actor?.role ?? "admin",
      action: "season_reopened",
      action_description: `Temporada "${season.name}" reaberta manualmente.`,
      target_type: "season",
      target_id: seasonId,
      target_name: season.name,
      old_value: { status: "closed" },
      new_value: { status: "active" },
      reason: null,
    });

    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Erro ao reabrir temporada.",
    };
  }
}
