"use server";

import { after } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import type { Achievement } from "@/lib/achievements";
import { sendPushToUsers } from "@/lib/push";
import type { PendingNotificationPayloadV1 } from "@/lib/types/notifications";
import {
  validatePendingMatchRpcOnly,
  runAchievementsAfterValidation,
} from "@/lib/matches/validate-pending-match";
import {
  cancelPendingMatchForNonexistent,
  enforcePendingConfirmationSla,
  getMatchPendingKindAndContext,
} from "@/lib/matches/confirmation-sla";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

// Validar formato do score (ex: "3x1", "2x3")
function parseScore(outcome: string): { a: number; b: number } | null {
  if (!outcome || typeof outcome !== "string") return null;

  const match = outcome.match(/^(\d{1,2})x(\d{1,2})$/);
  if (!match) return null;

  const a = parseInt(match[1], 10);
  const b = parseInt(match[2], 10);

  // Validar range (0-99) e que não seja empate
  if (isNaN(a) || isNaN(b) || a < 0 || b < 0 || a > 99 || b > 99 || a === b) {
    return null;
  }

  return { a, b };
}

async function getActorName(
  supabase: ServerSupabaseClient,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("users")
    .select("full_name, name, email")
    .eq("id", userId)
    .single();

  if (!data) return null;

  return data.full_name || data.name || data.email?.split("@")[0] || null;
}

async function emitPendingNotification(
  supabase: ServerSupabaseClient | ReturnType<typeof createAdminClient>,
  userId: string,
  payload: PendingNotificationPayloadV1
) {
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    tipo: "confirmacao",
    payload,
    lida: false,
  });

  if (error) {
    console.error("pending_notification_insert_failed", {
      recipientId: userId,
      matchId: payload.match_id,
      event: payload.event,
      actorId: payload.actor_id,
      reason: error.message,
      code: error.code,
    });
  }
}

async function getAuthenticatedUserId(
  supabase: ServerSupabaseClient
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id ?? null;
}

/**
 * Confirmar partida pendente.
 *
 * Caminho crítico: auth (1) + getMatchPendingKindAndContext (1) + RPC (1) = 3 ops
 * after(): conquistas + push + notificação + SLA enforcement
 */
export async function confirmMatchAction(
  matchId: string,
  requestedUserId: string
): Promise<{ success: boolean; error?: string; unlockedAchievements?: Achievement[] }> {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const fail = (errorMessage: string) => ({ success: false, error: errorMessage });

  const authenticatedUserId = await getAuthenticatedUserId(supabase);
  if (!authenticatedUserId) return fail("Usuário não autenticado");
  if (requestedUserId !== authenticatedUserId) return fail("Sessão inválida para confirmar a partida");

  const userId = authenticatedUserId;

  // 1 query: estado desta partida específica (substitui getOpenPendingConfirmationSnapshots)
  const matchState = await getMatchPendingKindAndContext(matchId, adminSupabase);

  if (matchState.pendingKind === "nonexistent") {
    // Cancela a partida — passa snapshot pré-carregado para evitar query redundante
    const cancellationResult = await cancelPendingMatchForNonexistent({
      matchId,
      actorUserId: userId,
      actorName: null, // será buscado em after() se necessário para notif
      actorType: "player",
      supabase: adminSupabase,
      preloadedSnapshot: {
        pendingKind: "nonexistent",
        responsibleUserId: userId,
      },
    });

    if (!cancellationResult.success) {
      return fail(cancellationResult.error);
    }

    // SLA em background — não bloqueia resposta
    after(async () => {
      try {
        await enforcePendingConfirmationSla({ supabase: adminSupabase });
      } catch (e) {
        console.error("[after/confirmMatch/nonexistent/sla]", e);
      }
    });

    return { success: true, unlockedAchievements: [] };
  }

  // Fluxo normal: 1 RPC atômico
  const result = await validatePendingMatchRpcOnly({
    matchId,
    actorUserId: userId,
    actorName: null, // não necessário para o RPC em si
    actorType: "player",
  });

  if (!result.success) {
    return fail(result.error);
  }

  const validationRow = result.row;

  // Tudo que não afeta a resposta vai para after()
  after(async () => {
    try {
      const adminClient = createAdminClient();

      // Conquistas (queries adicionais: users + matches recent)
      const achievementsByUserId = await runAchievementsAfterValidation(validationRow);
      void achievementsByUserId; // conquistas são exibidas no próximo refresh

      // Notificação de resolução para os dois jogadores
      const recipients = Array.from(
        new Set([validationRow.player_a_id, validationRow.player_b_id])
      );
      const actorName = validationRow.player_a_id === userId
        ? validationRow.player_a_name
        : validationRow.player_b_name;

      await Promise.all(
        recipients.map((recipientId) =>
          emitPendingNotification(adminClient, recipientId, {
            event: "pending_resolved",
            match_id: matchId,
            status: "validado",
            actor_id: userId,
            actor_name: actorName,
            created_by: userId,
          })
        )
      );

      // Push para o adversário
      const opponentId = userId === validationRow.player_a_id
        ? validationRow.player_b_id
        : validationRow.player_a_id;

      await sendPushToUsers([opponentId], {
        title: "Partida confirmada",
        body: `${actorName || "Seu adversário"} confirmou a partida. Resultado: ${validationRow.score_label}.`,
        url: "/partidas",
        tag: `pending-match-${matchId}`,
        data: { matchId, event: "pending_resolved" },
      });

      // SLA enforcement em background
      await enforcePendingConfirmationSla({ supabase: adminClient });
    } catch (e) {
      console.error("[after/confirmMatch]", e);
    }
  });

  return {
    success: true,
    unlockedAchievements: [], // conquistas aparecem no próximo refresh via invalidação de cache
  };
}

/**
 * Contestar placar de uma partida pendente.
 *
 * Caminho crítico: auth (1) + fetch match (1) + update match (1) = 3 ops
 * after(): actorName + notificação + push + SLA
 */
export async function contestMatchAction(
  matchId: string,
  requestedUserId: string,
  newOutcome: string
): Promise<{ success: boolean; error?: string }> {
  const score = parseScore(newOutcome);
  if (!score) {
    return { success: false, error: "Formato de placar inválido. Use o formato NxN (ex: 3x1)" };
  }

  const supabase = await createClient();
  const authenticatedUserId = await getAuthenticatedUserId(supabase);

  if (!authenticatedUserId) return { success: false, error: "Usuário não autenticado" };
  if (requestedUserId !== authenticatedUserId) return { success: false, error: "Sessão inválida para contestar a partida" };

  const userId = authenticatedUserId;

  // Busca a partida para verificar status e determinar vencedor
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("player_a_id, player_b_id, status, resultado_a, resultado_b, vencedor_id, criado_por")
    .eq("id", matchId)
    .single();

  if (matchError || !match) return { success: false, error: "Partida não encontrada" };

  if (match.status === "validado") {
    return { success: false, error: "Não é possível contestar uma partida já validada" };
  }
  if (match.status === "cancelado") {
    return { success: false, error: "Não é possível contestar uma partida cancelada" };
  }

  const waitingUserId =
    match.criado_por === match.player_a_id
      ? match.player_b_id
      : match.criado_por === match.player_b_id
        ? match.player_a_id
        : null;

  if (!waitingUserId || waitingUserId !== userId) {
    return { success: false, error: "Esta partida não está aguardando sua contestação" };
  }

  const vencedorId = score.a > score.b ? match.player_a_id : match.player_b_id;
  const recipientId = userId === match.player_a_id ? match.player_b_id : match.player_a_id;

  const { data: updatedRows, error: updateError } = await supabase
    .from("matches")
    .update({
      resultado_a: score.a,
      resultado_b: score.b,
      vencedor_id: vencedorId,
      status: "edited",
      criado_por: userId,
    })
    .eq("id", matchId)
    .neq("criado_por", userId)
    .in("status", ["pendente", "edited"])
    .select("id");

  if (updateError) return { success: false, error: "Erro ao contestar partida" };

  if (!updatedRows || updatedRows.length === 0) {
    return { success: false, error: "Esta partida já foi processada por outro usuário" };
  }

  // Notificação + push + SLA em background
  after(async () => {
    try {
      const adminClient = createAdminClient();
      const actorName = await getActorName(supabase, userId);

      const transferPayload: PendingNotificationPayloadV1 = {
        event: "pending_transferred",
        match_id: matchId,
        status: "edited",
        actor_id: userId,
        actor_name: actorName,
        created_by: userId,
      };

      await emitPendingNotification(adminClient, recipientId, transferPayload);

      await sendPushToUsers([recipientId], {
        title: "Partida contestada",
        body: `${actorName || "Seu adversário"} contestou o placar para ${score.a}x${score.b}. Revise e confirme.`,
        url: "/partidas",
        tag: `pending-match-${matchId}`,
        data: { matchId, event: "pending_transferred" },
      });

      await enforcePendingConfirmationSla({ supabase: adminClient });
    } catch (e) {
      console.error("[after/contestMatch]", e);
    }
  });

  return { success: true };
}

/**
 * Reportar que uma partida não aconteceu.
 *
 * Caminho crítico: auth (1) + [fetch match + estado notif] paralelo (2) + update (1) = 4 ops
 * after(): actorName + notificação + push + SLA
 */
export async function reportMatchDidNotHappenAction(
  matchId: string,
  requestedUserId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const authenticatedUserId = await getAuthenticatedUserId(supabase);

  if (!authenticatedUserId) return { success: false, error: "Usuário não autenticado" };
  if (requestedUserId !== authenticatedUserId) return { success: false, error: "Sessão inválida para revisar a partida" };

  const userId = authenticatedUserId;
  const adminSupabase = createAdminClient();

  // Busca paralela: dados da partida + estado de confirmação (1 query cada)
  const [matchResult, matchState] = await Promise.all([
    supabase
      .from("matches")
      .select("player_a_id, player_b_id, status, criado_por")
      .eq("id", matchId)
      .single(),
    getMatchPendingKindAndContext(matchId, adminSupabase),
  ]);

  if (matchResult.error || !matchResult.data) {
    return { success: false, error: "Partida não encontrada" };
  }

  const match = matchResult.data;

  if (match.status === "validado") {
    return { success: false, error: "Não é possível marcar uma partida já confirmada como inexistente" };
  }
  if (match.status === "cancelado") {
    return { success: false, error: "Esta partida já foi cancelada" };
  }
  if (match.status !== "pendente" && match.status !== "edited") {
    return { success: false, error: "Esta partida não está pendente" };
  }

  const waitingUserId =
    match.criado_por === match.player_a_id
      ? match.player_b_id
      : match.criado_por === match.player_b_id
        ? match.player_a_id
        : null;

  if (!waitingUserId || waitingUserId !== userId) {
    return { success: false, error: "Esta partida não está aguardando sua resposta" };
  }

  if (matchState.pendingContext === "nonexistent_rejected") {
    return {
      success: false,
      error: "O adversário já informou que este jogo existiu. Confirme ou conteste o placar.",
    };
  }

  const recipientId = userId === match.player_a_id ? match.player_b_id : match.player_a_id;

  const { data: updatedRows, error: updateError } = await supabase
    .from("matches")
    .update({ status: "edited", criado_por: userId })
    .eq("id", matchId)
    .neq("criado_por", userId)
    .in("status", ["pendente", "edited"])
    .select("id");

  if (updateError) return { success: false, error: "Erro ao marcar jogo como inexistente" };

  if (!updatedRows || updatedRows.length === 0) {
    return { success: false, error: "Esta partida já foi processada por outro usuário" };
  }

  after(async () => {
    try {
      const adminClient = createAdminClient();
      const actorName = await getActorName(supabase, userId);

      const payload: PendingNotificationPayloadV1 = {
        event: "nonexistent_claimed",
        match_id: matchId,
        status: "edited",
        actor_id: userId,
        actor_name: actorName,
        created_by: userId,
      };

      await emitPendingNotification(adminClient, recipientId, payload);

      await sendPushToUsers([recipientId], {
        title: "Jogo marcado como inexistente",
        body: `${actorName || "Seu adversário"} informou que esse jogo não aconteceu. Revise a pendência.`,
        url: "/partidas",
        tag: `pending-match-${matchId}`,
        data: { matchId, event: "nonexistent_claimed" },
      });

      await enforcePendingConfirmationSla({ supabase: adminClient });
    } catch (e) {
      console.error("[after/reportMatchDidNotHappen]", e);
    }
  });

  return { success: true };
}

/**
 * Confirmar que o jogo realmente existiu (rejeitar claim de inexistência).
 *
 * Caminho crítico: auth (1) + [estado notif + fetch match] paralelo (2) + update (1) = 4 ops
 * after(): actorName + notificação + push + SLA
 */
export async function confirmMatchDidHappenAction(
  matchId: string,
  requestedUserId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const authenticatedUserId = await getAuthenticatedUserId(supabase);

  if (!authenticatedUserId) return { success: false, error: "Usuário não autenticado" };
  if (requestedUserId !== authenticatedUserId) return { success: false, error: "Sessão inválida para revisar a partida" };

  const userId = authenticatedUserId;
  const adminSupabase = createAdminClient();

  // Busca paralela: estado de confirmação + dados da partida
  const [matchState, matchResult] = await Promise.all([
    getMatchPendingKindAndContext(matchId, adminSupabase),
    supabase
      .from("matches")
      .select("player_a_id, player_b_id, status, criado_por")
      .eq("id", matchId)
      .single(),
  ]);

  if (!matchState || matchState.pendingKind !== "nonexistent") {
    return {
      success: false,
      error: "Esta partida não está aguardando sua resposta sobre jogo inexistente",
    };
  }

  if (matchResult.error || !matchResult.data) {
    return { success: false, error: "Partida não encontrada" };
  }

  const match = matchResult.data;

  if (match.status === "validado") return { success: false, error: "Esta partida já foi confirmada" };
  if (match.status === "cancelado") return { success: false, error: "Esta partida já foi cancelada" };

  const recipientId = userId === match.player_a_id ? match.player_b_id : match.player_a_id;

  const { data: updatedRows, error: updateError } = await supabase
    .from("matches")
    .update({ status: "edited", criado_por: userId })
    .eq("id", matchId)
    .neq("criado_por", userId)
    .in("status", ["pendente", "edited"])
    .select("id");

  if (updateError) return { success: false, error: "Erro ao informar que o jogo existiu" };

  if (!updatedRows || updatedRows.length === 0) {
    return { success: false, error: "Esta partida já foi processada por outro usuário" };
  }

  after(async () => {
    try {
      const adminClient = createAdminClient();
      const actorName = await getActorName(supabase, userId);

      const payload: PendingNotificationPayloadV1 = {
        event: "nonexistent_rejected",
        match_id: matchId,
        status: "edited",
        actor_id: userId,
        actor_name: actorName,
        created_by: userId,
      };

      await emitPendingNotification(adminClient, recipientId, payload);

      await sendPushToUsers([recipientId], {
        title: "Jogo confirmado como existente",
        body: `${actorName || "Seu adversário"} informou que esse jogo aconteceu. Confirme o placar ou conteste.`,
        url: "/partidas",
        tag: `pending-match-${matchId}`,
        data: { matchId, event: "nonexistent_rejected" },
      });

      await enforcePendingConfirmationSla({ supabase: adminClient });
    } catch (e) {
      console.error("[after/confirmMatchDidHappen]", e);
    }
  });

  return { success: true };
}
