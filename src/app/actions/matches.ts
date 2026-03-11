"use server";

import { createClient } from "@/utils/supabase/server";
import type { Achievement } from "@/lib/achievements";
import { sendPushToUsers } from "@/lib/push";
import type { PendingNotificationPayloadV1 } from "@/lib/types/notifications";
import { validatePendingMatchByActor } from "@/lib/matches/validate-pending-match";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;
const BUSINESS_TIMEZONE = process.env.APP_TIMEZONE || "America/Sao_Paulo";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RegisterMatchRpcRow = {
  match_id: string;
  opponent_id: string;
  actor_name: string | null;
  was_inserted: boolean;
};

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

function createRegisterMatchTelemetry() {
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

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

function parseRegisterMatchRpcRow(data: unknown): RegisterMatchRpcRow | null {
  const row = Array.isArray(data) ? data[0] : data;

  if (!row || typeof row !== "object") return null;

  const candidate = row as Partial<RegisterMatchRpcRow>;
  if (
    typeof candidate.match_id !== "string" ||
    typeof candidate.opponent_id !== "string" ||
    typeof candidate.was_inserted !== "boolean"
  ) {
    return null;
  }

  return {
    match_id: candidate.match_id,
    opponent_id: candidate.opponent_id,
    actor_name: typeof candidate.actor_name === "string" ? candidate.actor_name : null,
    was_inserted: candidate.was_inserted,
  };
}

function mapRegisterMatchRpcErrorMessage(message: string | undefined): string {
  const normalized = (message || "").toLowerCase();

  if (normalized.includes("not_authenticated")) {
    return "Usuário não autenticado";
  }

  if (normalized.includes("actor_mismatch")) {
    return "Sessão inválida para registrar a partida";
  }

  if (normalized.includes("same_player")) {
    return "Você não pode jogar contra si mesmo";
  }

  if (normalized.includes("invalid_score")) {
    return "Formato de placar inválido. Use o formato NxN (ex: 3x1)";
  }

  if (normalized.includes("daily_limit_reached")) {
    return "Limite diário de jogos contra este adversário atingido";
  }

  if (normalized.includes("invalid_input")) {
    return "Dados inválidos para registrar a partida";
  }

  if (normalized.includes("duplicate key value violates unique constraint")) {
    return "Solicitação duplicada detectada. Atualize a tela e tente novamente.";
  }

  return "Erro ao registrar partida";
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
  const actorName = await getActorName(supabase, userId);
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

  // Buscar a partida para determinar o vencedor e verificar status
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("player_a_id, player_b_id, status")
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

  const vencedorId = score.a > score.b ? match.player_a_id : match.player_b_id;

  const { error } = await supabase
    .from("matches")
    .update({
      resultado_a: score.a,
      resultado_b: score.b,
      vencedor_id: vencedorId,
      status: "edited",
      criado_por: userId,
    })
    .eq("id", matchId)
    .in("status", ["pendente", "edited"]); // Só atualiza se status for válido
  telemetry.step("update_match");

  if (error) {
    return fail("Erro ao contestar partida", "update_match_failed");
  }

  const recipientId = userId === match.player_a_id ? match.player_b_id : match.player_a_id;
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

export async function registerMatchAction(input: {
  playerId: string;
  opponentId: string;
  outcome: string;
  requestId: string;
}): Promise<{ success: boolean; error?: string; matchId?: string }> {
  const telemetry = createRegisterMatchTelemetry();
  const fail = (errorMessage: string, reason: string) => {
    telemetry.finish("error", reason);
    return { success: false, error: errorMessage };
  };

  // Validar formato do score
  const score = parseScore(input.outcome);
  if (!score) {
    return fail("Formato de placar inválido. Use o formato NxN (ex: 3x1)", "invalid_score");
  }

  // Validar que não é o mesmo jogador
  if (input.playerId === input.opponentId) {
    return fail("Você não pode jogar contra si mesmo", "same_player");
  }

  if (!isUuid(input.requestId)) {
    return fail("Identificador de envio inválido. Tente novamente.", "invalid_request_id");
  }

  const supabase = await createClient();
  const authenticatedUserId = await getAuthenticatedUserId(supabase);

  if (!authenticatedUserId) {
    return fail("Usuário não autenticado", "not_authenticated");
  }

  if (input.playerId !== authenticatedUserId) {
    return fail("Sessão inválida para registrar a partida", "actor_mismatch");
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "register_match_with_notification_v1",
    {
      p_player_id: input.playerId,
      p_opponent_id: input.opponentId,
      p_resultado_a: score.a,
      p_resultado_b: score.b,
      p_request_id: input.requestId,
      p_timezone: BUSINESS_TIMEZONE,
    }
  );
  telemetry.step("register_match_rpc");

  if (rpcError) {
    return fail(
      mapRegisterMatchRpcErrorMessage(rpcError.message),
      `register_match_rpc_failed:${rpcError.code || "unknown"}`
    );
  }

  const rpcRow = parseRegisterMatchRpcRow(rpcData);
  if (!rpcRow) {
    return fail("Erro ao registrar partida", "register_match_rpc_invalid_payload");
  }

  if (rpcRow.was_inserted) {
    await sendPushToUsers([rpcRow.opponent_id], {
      title: "Nova partida para confirmar",
      body: `${rpcRow.actor_name || "Seu adversário"} registrou ${score.a}x${score.b}. Toque para revisar.`,
      url: "/partidas",
      tag: `pending-match-${rpcRow.match_id}`,
      data: {
        matchId: rpcRow.match_id,
        event: "pending_created",
      },
    });
  }
  telemetry.step("emit_pending_push");
  telemetry.finish("success");

  return { success: true, matchId: rpcRow.match_id };
}
