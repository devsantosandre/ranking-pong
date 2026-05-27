"use server";

import { createClient } from "@/utils/supabase/server";
import type { Achievement } from "@/lib/achievements";
import { sendPushToUsers } from "@/lib/push";
import type { PendingNotificationPayloadV1 } from "@/lib/types/notifications";
import { validatePendingMatchByActor } from "@/lib/matches/validate-pending-match";
import {
  cancelPendingMatchForNonexistent,
  enforcePendingConfirmationSla,
  getOpenPendingConfirmationSnapshots,
  transferMatchConfirmationResponsibility,
} from "@/lib/matches/confirmation-sla";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

function createMatchActionTelemetry() {
  return {
    step(...args: unknown[]) {
      void args;
    },
    finish(...args: unknown[]) {
      void args;
    },
  };
}

function createConfirmMatchTelemetry() {
  return createMatchActionTelemetry();
}

function createContestMatchTelemetry() {
  return createMatchActionTelemetry();
}

function createReportMatchDidNotHappenTelemetry() {
  return createMatchActionTelemetry();
}

function createConfirmMatchDidHappenTelemetry() {
  return createMatchActionTelemetry();
}

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
  supabase: ServerSupabaseClient,
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

export async function confirmMatchAction(
  matchId: string,
  requestedUserId: string
): Promise<{ success: boolean; error?: string; unlockedAchievements?: Achievement[] }> {
  const supabase = await createClient();
  const telemetry = createConfirmMatchTelemetry();
  const fail = (errorMessage: string, reason: string) => {
    telemetry.finish("error", reason);
    return { success: false, error: errorMessage };
  };
  const authenticatedUserId = await getAuthenticatedUserId(supabase);

  if (!authenticatedUserId) {
    return fail("Usuário não autenticado", "not_authenticated");
  }

  if (requestedUserId !== authenticatedUserId) {
    return fail("Sessão inválida para confirmar a partida", "actor_mismatch");
  }

  const userId = authenticatedUserId;
  await enforcePendingConfirmationSla({
    responsibleUserId: userId,
  });
  const actorName = await getActorName(supabase, userId);
  const { items: pendingSnapshots } = await getOpenPendingConfirmationSnapshots({
    responsibleUserId: userId,
  });
  const pendingSnapshot = pendingSnapshots.find((item) => item.matchId === matchId);

  if (pendingSnapshot?.pendingKind === "nonexistent") {
    const cancellationResult = await cancelPendingMatchForNonexistent({
      matchId,
      actorUserId: userId,
      actorName,
      actorType: "player",
    });

    if (!cancellationResult.success) {
      return fail(cancellationResult.error, cancellationResult.reason);
    }

    telemetry.finish("success_cancelled");
    return {
      success: true,
      unlockedAchievements: [],
    };
  }

  const result = await validatePendingMatchByActor({
    matchId,
    actorUserId: userId,
    actorName,
    actorType: "player",
  });

  if (!result.success) {
    return fail(result.error, result.reason);
  }

  telemetry.finish("success");
  return {
    success: true,
    unlockedAchievements: result.unlockedAchievementsByUserId[userId] ?? [],
  };
}

export async function contestMatchAction(
  matchId: string,
  requestedUserId: string,
  newOutcome: string
): Promise<{ success: boolean; error?: string }> {
  const telemetry = createContestMatchTelemetry();
  const fail = (errorMessage: string, reason: string) => {
    telemetry.finish("error", reason);
    return { success: false, error: errorMessage };
  };

  // Validar formato do score
  const score = parseScore(newOutcome);
  if (!score) {
    return fail("Formato de placar inválido. Use o formato NxN (ex: 3x1)", "invalid_score");
  }

  const supabase = await createClient();
  const authenticatedUserId = await getAuthenticatedUserId(supabase);

  if (!authenticatedUserId) {
    return fail("Usuário não autenticado", "not_authenticated");
  }

  if (requestedUserId !== authenticatedUserId) {
    return fail("Sessão inválida para contestar a partida", "actor_mismatch");
  }

  const userId = authenticatedUserId;
  await enforcePendingConfirmationSla({
    responsibleUserId: userId,
  });

  // Buscar a partida para determinar o vencedor e verificar status
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select(
      "player_a_id, player_b_id, status, resultado_a, resultado_b, vencedor_id, criado_por"
    )
    .eq("id", matchId)
    .single();
  telemetry.step("fetch_match");

  if (matchError || !match) {
    return fail("Partida não encontrada", "match_not_found");
  }

  // Não permitir contestar partida já validada ou cancelada
  if (match.status === "validado") {
    return fail(
      "Não é possível contestar uma partida já validada",
      "match_already_validated"
    );
  }
  if (match.status === "cancelado") {
    return fail(
      "Não é possível contestar uma partida cancelada",
      "match_already_canceled"
    );
  }

  const waitingUserId =
    match.criado_por === match.player_a_id
      ? match.player_b_id
      : match.criado_por === match.player_b_id
        ? match.player_a_id
        : null;

  if (!waitingUserId || waitingUserId !== userId) {
    return fail(
      "Esta partida não está aguardando sua contestação",
      "actor_not_waiting_user"
    );
  }

  const vencedorId = score.a > score.b ? match.player_a_id : match.player_b_id;

  const { data: updatedRows, error } = await supabase
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
    .select("id"); // Só atualiza se status for válido
  telemetry.step("update_match");

  if (error) {
    return fail("Erro ao contestar partida", "update_match_failed");
  }

  if (!updatedRows || updatedRows.length === 0) {
    return fail(
      "Esta partida já foi processada por outro usuário",
      "match_already_processed"
    );
  }

  const recipientId = userId === match.player_a_id ? match.player_b_id : match.player_a_id;

  try {
    await transferMatchConfirmationResponsibility({
      matchId,
      responsibleUserId: recipientId,
    });
  } catch (transferError) {
    await supabase
      .from("matches")
      .update({
        resultado_a: match.resultado_a,
        resultado_b: match.resultado_b,
        vencedor_id: match.vencedor_id,
        status: match.status,
        criado_por: match.criado_por,
      })
      .eq("id", matchId);

    return fail(
      transferError instanceof Error
        ? transferError.message
        : "Erro ao atualizar a responsabilidade da pendência",
      "pending_confirmation_transfer_failed"
    );
  }

  const actorName = await getActorName(supabase, userId);
  const transferPayload: PendingNotificationPayloadV1 = {
    event: "pending_transferred",
    match_id: matchId,
    status: "edited",
    actor_id: userId,
    actor_name: actorName,
    created_by: userId,
  };

  await emitPendingNotification(supabase, recipientId, transferPayload);
  telemetry.step("emit_transfer_notification");

  await sendPushToUsers([recipientId], {
    title: "Partida contestada",
    body: `${actorName || "Seu adversário"} contestou o placar para ${score.a}x${score.b}. Revise e confirme.`,
    url: "/partidas",
    tag: `pending-match-${matchId}`,
    data: {
      matchId,
      event: "pending_transferred",
    },
  });
  telemetry.step("emit_transfer_push");
  telemetry.finish("success");

  return { success: true };
}

export async function reportMatchDidNotHappenAction(
  matchId: string,
  requestedUserId: string
): Promise<{ success: boolean; error?: string }> {
  const telemetry = createReportMatchDidNotHappenTelemetry();
  const fail = (errorMessage: string, reason: string) => {
    telemetry.finish("error", reason);
    return { success: false, error: errorMessage };
  };
  const supabase = await createClient();
  const authenticatedUserId = await getAuthenticatedUserId(supabase);

  if (!authenticatedUserId) {
    return fail("Usuário não autenticado", "not_authenticated");
  }

  if (requestedUserId !== authenticatedUserId) {
    return fail("Sessão inválida para revisar a partida", "actor_mismatch");
  }

  const userId = authenticatedUserId;
  await enforcePendingConfirmationSla({
    responsibleUserId: userId,
  });

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("player_a_id, player_b_id, status, criado_por")
    .eq("id", matchId)
    .single();
  telemetry.step("fetch_match");

  if (matchError || !match) {
    return fail("Partida não encontrada", "match_not_found");
  }

  if (match.status === "validado") {
    return fail(
      "Não é possível marcar uma partida já confirmada como inexistente",
      "match_already_validated"
    );
  }

  if (match.status === "cancelado") {
    return fail("Esta partida já foi cancelada", "match_already_canceled");
  }

  if (match.status !== "pendente" && match.status !== "edited") {
    return fail("Esta partida não está pendente", "match_not_pending");
  }

  const waitingUserId =
    match.criado_por === match.player_a_id
      ? match.player_b_id
      : match.criado_por === match.player_b_id
        ? match.player_a_id
        : null;

  if (!waitingUserId || waitingUserId !== userId) {
    return fail(
      "Esta partida não está aguardando sua resposta",
      "actor_not_waiting_user"
    );
  }

  const { items: pendingSnapshots } = await getOpenPendingConfirmationSnapshots({
    responsibleUserId: userId,
  });
  const pendingSnapshot = pendingSnapshots.find((item) => item.matchId === matchId);

  if (pendingSnapshot?.pendingContext === "nonexistent_rejected") {
    return fail(
      "O adversário já informou que este jogo existiu. Confirme ou conteste o placar.",
      "nonexistent_already_rejected"
    );
  }

  const { data: updatedRows, error: updateError } = await supabase
    .from("matches")
    .update({
      status: "edited",
      criado_por: userId,
    })
    .eq("id", matchId)
    .neq("criado_por", userId)
    .in("status", ["pendente", "edited"])
    .select("id");
  telemetry.step("update_match");

  if (updateError) {
    return fail("Erro ao marcar jogo como inexistente", "update_match_failed");
  }

  if (!updatedRows || updatedRows.length === 0) {
    return fail(
      "Esta partida já foi processada por outro usuário",
      "match_already_processed"
    );
  }

  const recipientId = userId === match.player_a_id ? match.player_b_id : match.player_a_id;

  try {
    await transferMatchConfirmationResponsibility({
      matchId,
      responsibleUserId: recipientId,
    });
  } catch (transferError) {
    await supabase
      .from("matches")
      .update({
        status: match.status,
        criado_por: match.criado_por,
      })
      .eq("id", matchId);

    return fail(
      transferError instanceof Error
        ? transferError.message
        : "Erro ao atualizar a responsabilidade da pendência",
      "pending_confirmation_transfer_failed"
    );
  }

  const actorName = await getActorName(supabase, userId);
  const payload: PendingNotificationPayloadV1 = {
    event: "nonexistent_claimed",
    match_id: matchId,
    status: "edited",
    actor_id: userId,
    actor_name: actorName,
    created_by: userId,
  };

  await emitPendingNotification(supabase, recipientId, payload);
  telemetry.step("emit_nonexistent_notification");

  await sendPushToUsers([recipientId], {
    title: "Jogo marcado como inexistente",
    body: `${actorName || "Seu adversário"} informou que esse jogo não aconteceu. Revise a pendência.`,
    url: "/partidas",
    tag: `pending-match-${matchId}`,
    data: {
      matchId,
      event: "nonexistent_claimed",
    },
  });
  telemetry.step("emit_nonexistent_push");
  telemetry.finish("success");

  return { success: true };
}

export async function confirmMatchDidHappenAction(
  matchId: string,
  requestedUserId: string
): Promise<{ success: boolean; error?: string }> {
  const telemetry = createConfirmMatchDidHappenTelemetry();
  const fail = (errorMessage: string, reason: string) => {
    telemetry.finish("error", reason);
    return { success: false, error: errorMessage };
  };
  const supabase = await createClient();
  const authenticatedUserId = await getAuthenticatedUserId(supabase);

  if (!authenticatedUserId) {
    return fail("Usuário não autenticado", "not_authenticated");
  }

  if (requestedUserId !== authenticatedUserId) {
    return fail("Sessão inválida para revisar a partida", "actor_mismatch");
  }

  const userId = authenticatedUserId;
  await enforcePendingConfirmationSla({
    responsibleUserId: userId,
  });

  const { items: pendingSnapshots } = await getOpenPendingConfirmationSnapshots({
    responsibleUserId: userId,
  });
  const pendingSnapshot = pendingSnapshots.find((item) => item.matchId === matchId);

  if (!pendingSnapshot || pendingSnapshot.pendingKind !== "nonexistent") {
    return fail(
      "Esta partida não está aguardando sua resposta sobre jogo inexistente",
      "pending_not_nonexistent"
    );
  }

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("player_a_id, player_b_id, status, criado_por")
    .eq("id", matchId)
    .single();
  telemetry.step("fetch_match");

  if (matchError || !match) {
    return fail("Partida não encontrada", "match_not_found");
  }

  if (match.status === "validado") {
    return fail("Esta partida já foi confirmada", "match_already_validated");
  }

  if (match.status === "cancelado") {
    return fail("Esta partida já foi cancelada", "match_already_canceled");
  }

  const recipientId = userId === match.player_a_id ? match.player_b_id : match.player_a_id;

  const { data: updatedRows, error: updateError } = await supabase
    .from("matches")
    .update({
      status: "edited",
      criado_por: userId,
    })
    .eq("id", matchId)
    .neq("criado_por", userId)
    .in("status", ["pendente", "edited"])
    .select("id");
  telemetry.step("update_match");

  if (updateError) {
    return fail("Erro ao informar que o jogo existiu", "update_match_failed");
  }

  if (!updatedRows || updatedRows.length === 0) {
    return fail(
      "Esta partida já foi processada por outro usuário",
      "match_already_processed"
    );
  }

  try {
    await transferMatchConfirmationResponsibility({
      matchId,
      responsibleUserId: recipientId,
    });
  } catch (transferError) {
    await supabase
      .from("matches")
      .update({
        status: match.status,
        criado_por: match.criado_por,
      })
      .eq("id", matchId);

    return fail(
      transferError instanceof Error
        ? transferError.message
        : "Erro ao atualizar a responsabilidade da pendência",
      "pending_confirmation_transfer_failed"
    );
  }

  const actorName = await getActorName(supabase, userId);
  const payload: PendingNotificationPayloadV1 = {
    event: "nonexistent_rejected",
    match_id: matchId,
    status: "edited",
    actor_id: userId,
    actor_name: actorName,
    created_by: userId,
  };

  await emitPendingNotification(supabase, recipientId, payload);
  telemetry.step("emit_nonexistent_rejected_notification");

  await sendPushToUsers([recipientId], {
    title: "Jogo confirmado como existente",
    body: `${actorName || "Seu adversário"} informou que esse jogo aconteceu. Confirme o placar ou conteste.`,
    url: "/partidas",
    tag: `pending-match-${matchId}`,
    data: {
      matchId,
      event: "nonexistent_rejected",
    },
  });
  telemetry.step("emit_nonexistent_rejected_push");
  telemetry.finish("success");

  return { success: true };
}

