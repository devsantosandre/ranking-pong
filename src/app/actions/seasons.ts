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

// ── Admin: criar temporada ────────────────────────────────────────────────────

export async function adminCreateSeason(
  input: { name: string; starts_at: string; ends_at: string; recurrence: string },
  opts: { notify: boolean } = { notify: false }
): Promise<SeasonAdminResult> {
  try {
    await requireModerator();
    const actor = await getCurrentUser();
    const supabase = createAdminClient();

    const slug = input.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const fullSlug = `${slug}-${Date.now()}`;

    const { data: inserted, error } = await supabase
      .from("seasons")
      .insert({
        name: input.name.trim(),
        slug: fullSlug,
        starts_at: input.starts_at,
        ends_at: input.ends_at,
        recurrence: input.recurrence,
        status: "upcoming",
        created_by: actor?.id ?? null,
      })
      .select("id")
      .single();

    if (error) return { success: false, error: error.message };

    if (opts.notify) {
      const startDate = new Date(input.starts_at).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
      });
      const endDate = new Date(input.ends_at).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
      });
      await supabase.from("news_posts").insert({
        title: `Nova temporada: ${input.name.trim()}`,
        slug: `nova-temporada-${fullSlug}`,
        resumo: `A ${input.name.trim()} começa em ${startDate} e vai até ${endDate}. Bora jogar!`,
        tipo: "temporada",
        published_at: new Date().toISOString(),
        created_by: actor?.id ?? null,
      });
    }

    await supabase.from("admin_logs").insert({
      admin_id: actor?.id ?? null,
      admin_role: actor?.role ?? "admin",
      action: "season_created",
      action_description: `Temporada "${input.name}" criada.${opts.notify ? " Anúncio publicado no feed." : ""}`,
      target_type: "season",
      target_id: inserted?.id ?? null,
      target_name: input.name,
      old_value: null,
      new_value: { name: input.name, starts_at: input.starts_at, ends_at: input.ends_at, notified: opts.notify },
      reason: null,
    });

    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Erro ao criar temporada.",
    };
  }
}

// ── Admin: editar temporada ───────────────────────────────────────────────────

export async function adminEditSeason(
  seasonId: string,
  input: { name: string; starts_at: string; ends_at: string; recurrence: string }
): Promise<SeasonAdminResult> {
  try {
    await requireModerator();
    const actor = await getCurrentUser();
    const supabase = createAdminClient();

    const { error } = await supabase
      .from("seasons")
      .update({
        name: input.name.trim(),
        starts_at: input.starts_at,
        ends_at: input.ends_at,
        recurrence: input.recurrence,
        updated_at: new Date().toISOString(),
      })
      .eq("id", seasonId)
      .in("status", ["upcoming", "active"]);

    if (error) return { success: false, error: error.message };

    await supabase.from("admin_logs").insert({
      admin_id: actor?.id ?? null,
      admin_role: actor?.role ?? "admin",
      action: "season_edited",
      action_description: `Temporada "${input.name}" editada.`,
      target_type: "season",
      target_id: seasonId,
      target_name: input.name,
      old_value: null,
      new_value: { name: input.name, starts_at: input.starts_at, ends_at: input.ends_at },
      reason: null,
    });

    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Erro ao editar temporada.",
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

    // Remover notícia de encerramento e publicar notícia de reabertura
    const champSlug = `campeao-${season.slug ?? seasonId}`;
    await supabase.from("news_posts").delete().eq("slug", champSlug);

    await supabase.from("news_posts").insert({
      title: `${season.name} foi reaberta`,
      slug: `reaberta-${season.slug ?? seasonId}-${Date.now()}`,
      resumo: `As posições e o ranking da ${season.name} foram reiniciados. O campeonato está aberto novamente!`,
      tipo: "temporada",
      published_at: new Date().toISOString(),
      created_by: actor?.id ?? null,
    });

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

// ── Remover notícia de temporada ──────────────────────────────────────────────

export async function adminDeleteSeasonNewsPost(
  newsPostId: string
): Promise<SeasonAdminResult> {
  try {
    await requireModerator();
    const supabase = createAdminClient();

    const { error } = await supabase
      .from("news_posts")
      .delete()
      .eq("id", newsPostId)
      .eq("tipo", "temporada");

    if (error) throw error;
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Erro ao remover notícia.",
    };
  }
}
