import { validatePendingMatchByActor } from "@/lib/matches/validate-pending-match";
import type { PendingNotificationPayloadV1 } from "@/lib/types/notifications";
import { createAdminClient } from "@/utils/supabase/admin";

export const DEFAULT_PENDING_CONFIRMATION_DEADLINE_HOURS = 6;
export const MAX_PENDING_CONFIRMATION_DEADLINE_HOURS = 168;

type AdminSupabaseClient = ReturnType<typeof createAdminClient>;

type PendingConfirmationMatchRow = {
  id: string;
  player_a_id: string;
  player_b_id: string;
  criado_por: string | null;
  created_at: string;
};

type PendingConfirmationNotificationRow = {
  created_at: string;
  payload: unknown;
};

type PendingConfirmationSnapshot = {
  matchId: string;
  responsibleUserId: string | null;
  pendingSinceAt: string;
  currentDeadlineAt: string;
  pendingKind: "score" | "nonexistent";
  pendingContext: "default" | "nonexistent_rejected";
  pendingContextActorId: string | null;
};

type AutoValidatedMatchLogEntry = {
  matchId: string;
  deadlineAt: string;
  oldStatus: "pendente" | "edited";
  scoreLabel: string;
  playerAName: string;
  playerBName: string;
  playerADelta: number;
  playerBDelta: number;
};

type AutoCancelledMatchLogEntry = {
  matchId: string;
  deadlineAt: string;
  oldStatus: "pendente" | "edited";
  scoreLabel: string;
  playerAName: string;
  playerBName: string;
};

type CancelMatchRpcRow = {
  match_id: string;
  old_status: "pendente" | "edited" | "validado";
  player_a_id: string;
  player_b_id: string;
  created_by: string | null;
  player_a_name: string;
  player_b_name: string;
  score_a: number;
  score_b: number;
};

type CancelOpenPendingMatchRow = {
  id: string;
  status: "pendente" | "edited" | "validado" | "cancelado";
  player_a_id: string;
  player_b_id: string;
  criado_por: string | null;
  resultado_a: number | null;
  resultado_b: number | null;
  data_partida: string;
  player_a: { name: string | null; full_name: string | null; email: string | null } | null;
  player_b: { name: string | null; full_name: string | null; email: string | null } | null;
};

type DailyLimitRow = {
  id: string;
  jogos_registrados: number | null;
};

export type CancelPendingMatchForNonexistentResult =
  | {
      success: true;
      oldStatus: "pendente" | "edited";
      targetName: string;
      scoreLabel: string;
      playerAName: string;
      playerBName: string;
      playerAId?: string;
      playerBId?: string;
      createdBy?: string | null;
      scoreA?: number;
      scoreB?: number;
    }
  | {
      success: false;
      error: string;
      reason: string;
    };

function clampDeadlineHours(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_PENDING_CONFIRMATION_DEADLINE_HOURS;
  }

  return Math.min(
    MAX_PENDING_CONFIRMATION_DEADLINE_HOURS,
    Math.max(1, Math.trunc(value))
  );
}

async function getDeadlineHours(
  supabase: AdminSupabaseClient
): Promise<number> {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "pending_confirmation_deadline_hours")
    .single<{ value: string | null }>();

  return clampDeadlineHours(data?.value ? Number.parseInt(data.value, 10) : null);
}

function getPendingResponsibleUserId(match: {
  player_a_id: string;
  player_b_id: string;
  criado_por: string | null;
}) {
  if (match.criado_por === match.player_a_id) {
    return match.player_b_id;
  }

  if (match.criado_por === match.player_b_id) {
    return match.player_a_id;
  }

  return null;
}

function parsePendingNotificationPayload(
  payload: unknown
): PendingNotificationPayloadV1 | null {
  if (!payload || typeof payload !== "object") return null;

  const candidate = payload as Partial<PendingNotificationPayloadV1>;

  if (
    candidate.event !== "pending_created" &&
    candidate.event !== "pending_transferred" &&
    candidate.event !== "nonexistent_claimed" &&
    candidate.event !== "nonexistent_rejected" &&
    candidate.event !== "pending_resolved"
  ) {
    return null;
  }

  if (
    typeof candidate.match_id !== "string" ||
    typeof candidate.status !== "string" ||
    typeof candidate.actor_id !== "string" ||
    typeof candidate.created_by !== "string"
  ) {
    return null;
  }

  return {
    event: candidate.event,
    match_id: candidate.match_id,
    status: candidate.status as PendingNotificationPayloadV1["status"],
    actor_id: candidate.actor_id,
    actor_name: typeof candidate.actor_name === "string" ? candidate.actor_name : null,
    created_by: candidate.created_by,
  };
}

function addHoursToIso(dateInput: string, hours: number) {
  return new Date(new Date(dateInput).getTime() + hours * 60 * 60 * 1000).toISOString();
}

function getPendingKindFromEvent(event: PendingNotificationPayloadV1["event"]) {
  return event === "nonexistent_claimed" ? "nonexistent" : "score";
}

function getPendingContextFromEvent(event: PendingNotificationPayloadV1["event"]) {
  return event === "nonexistent_rejected" ? "nonexistent_rejected" : "default";
}

function parseCancelMatchRpcRow(data: unknown): CancelMatchRpcRow | null {
  const row = Array.isArray(data) ? data[0] : data;

  if (!row || typeof row !== "object") return null;

  const candidate = row as Partial<CancelMatchRpcRow>;
  if (
    typeof candidate.match_id !== "string" ||
    (candidate.old_status !== "pendente" &&
      candidate.old_status !== "edited" &&
      candidate.old_status !== "validado") ||
    typeof candidate.player_a_id !== "string" ||
    typeof candidate.player_b_id !== "string" ||
    typeof candidate.player_a_name !== "string" ||
    typeof candidate.player_b_name !== "string" ||
    typeof candidate.score_a !== "number" ||
    typeof candidate.score_b !== "number"
  ) {
    return null;
  }

  return {
    match_id: candidate.match_id,
    old_status: candidate.old_status,
    player_a_id: candidate.player_a_id,
    player_b_id: candidate.player_b_id,
    created_by: typeof candidate.created_by === "string" ? candidate.created_by : null,
    player_a_name: candidate.player_a_name,
    player_b_name: candidate.player_b_name,
    score_a: candidate.score_a,
    score_b: candidate.score_b,
  };
}

function mapCancelMatchRpcErrorMessage(message: string | undefined): {
  error: string;
  reason: string;
} {
  const normalized = (message || "").toLowerCase();

  if (normalized.includes("already_canceled")) {
    return { error: "Esta partida já foi cancelada", reason: "already_canceled" };
  }

  if (normalized.includes("match_not_found")) {
    return { error: "Partida não encontrada", reason: "match_not_found" };
  }

  if (normalized.includes("cannot_cancel_historical_validated_match")) {
    return {
      error: "Não é possível cancelar esta partida porque já existem partidas validadas mais recentes envolvendo esses jogadores",
      reason: "cannot_cancel_historical_validated_match",
    };
  }

  if (normalized.includes("match_already_processed")) {
    return {
      error: "Esta partida já foi processada por outro usuário",
      reason: "match_already_processed",
    };
  }

  return { error: "Erro ao cancelar partida", reason: "cancel_match_rpc_failed" };
}

function shouldFallbackCancelOpenPendingMatch(message: string | undefined) {
  const normalized = (message || "").toLowerCase();
  return (
    normalized.includes('column reference "match_id" is ambiguous') ||
    normalized.includes("column reference match_id is ambiguous")
  );
}

function getFallbackPlayerName(player: CancelOpenPendingMatchRow["player_a"]) {
  return (
    player?.full_name ||
    player?.name ||
    player?.email?.split("@")[0] ||
    "Jogador"
  );
}

async function cancelOpenPendingMatchWithoutRpc(params: {
  matchId: string;
  supabase: AdminSupabaseClient;
}): Promise<CancelPendingMatchForNonexistentResult> {
  const fail = (
    error: string,
    reason: string
  ): CancelPendingMatchForNonexistentResult => ({
    success: false,
    error,
    reason,
  });

  const { data: match, error: matchError } = await params.supabase
    .from("matches")
    .select(
      `
      id,
      status,
      player_a_id,
      player_b_id,
      criado_por,
      resultado_a,
      resultado_b,
      data_partida,
      player_a:users!player_a_id(name, full_name, email),
      player_b:users!player_b_id(name, full_name, email)
    `
    )
    .eq("id", params.matchId)
    .single<CancelOpenPendingMatchRow>();

  if (matchError || !match) {
    return fail("Partida não encontrada", "match_not_found");
  }

  if (match.status === "cancelado") {
    return fail("Esta partida já foi cancelada", "already_canceled");
  }

  if (match.status !== "pendente" && match.status !== "edited") {
    return fail(
      "Não foi possível cancelar automaticamente esta partida pelo fallback seguro",
      "fallback_only_open_pending"
    );
  }

  const { error: achievementsError } = await params.supabase
    .from("user_achievements")
    .delete()
    .eq("match_id", params.matchId);

  if (achievementsError) {
    return fail("Erro ao cancelar conquistas da partida", "delete_achievements_failed");
  }

  const { data: dailyLimits, error: dailyLimitsError } = await params.supabase
    .from("daily_limits")
    .select("id, jogos_registrados")
    .eq("data", match.data_partida)
    .or(
      `and(user_id.eq.${match.player_a_id},opponent_id.eq.${match.player_b_id}),and(user_id.eq.${match.player_b_id},opponent_id.eq.${match.player_a_id})`
    )
    .returns<DailyLimitRow[]>();

  if (dailyLimitsError) {
    return fail("Erro ao atualizar limite diário", "fetch_daily_limits_failed");
  }

  for (const dailyLimit of dailyLimits ?? []) {
    const nextValue = Math.max(0, (dailyLimit.jogos_registrados ?? 0) - 1);
    const { error: dailyLimitUpdateError } = await params.supabase
      .from("daily_limits")
      .update({ jogos_registrados: nextValue })
      .eq("id", dailyLimit.id);

    if (dailyLimitUpdateError) {
      return fail("Erro ao atualizar limite diário", "update_daily_limits_failed");
    }
  }

  const { data: updatedRows, error: updateError } = await params.supabase
    .from("matches")
    .update({
      status: "cancelado",
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.matchId)
    .eq("status", match.status)
    .select("id");

  if (updateError) {
    return fail("Erro ao cancelar partida", "fallback_update_match_failed");
  }

  if (!updatedRows?.length) {
    return fail(
      "Esta partida já foi processada por outro usuário",
      "match_already_processed"
    );
  }

  const scoreLabel = `${match.resultado_a ?? 0}x${match.resultado_b ?? 0}`;
  const playerAName = getFallbackPlayerName(match.player_a);
  const playerBName = getFallbackPlayerName(match.player_b);

  return {
    success: true,
    oldStatus: match.status,
    targetName: `${playerAName} vs ${playerBName} (${scoreLabel})`,
    scoreLabel,
    playerAName,
    playerBName,
    playerAId: match.player_a_id,
    playerBId: match.player_b_id,
    createdBy: match.criado_por,
    scoreA: match.resultado_a ?? 0,
    scoreB: match.resultado_b ?? 0,
  };
}

async function emitPendingResolutionNotification(params: {
  supabase: AdminSupabaseClient;
  recipientId: string;
  matchId: string;
  status: PendingNotificationPayloadV1["status"];
  actorId: string;
  actorName: string | null;
  createdBy: string;
}) {
  const payload: PendingNotificationPayloadV1 = {
    event: "pending_resolved",
    match_id: params.matchId,
    status: params.status,
    actor_id: params.actorId,
    actor_name: params.actorName,
    created_by: params.createdBy,
  };

  const { error } = await params.supabase.from("notifications").insert({
    user_id: params.recipientId,
    tipo: "confirmacao",
    payload,
    lida: false,
  });

  if (error) {
    console.error("pending_resolution_notification_insert_failed", {
      recipientId: params.recipientId,
      matchId: params.matchId,
      status: params.status,
      reason: error.message,
      code: error.code,
    });
  }
}

export async function getOpenPendingConfirmationSnapshots(params?: {
  responsibleUserId?: string;
  supabase?: AdminSupabaseClient;
}) {
  const supabase = params?.supabase ?? createAdminClient();
  const deadlineHours = await getDeadlineHours(supabase);

  let matchesQuery = supabase
    .from("matches")
    .select("id, player_a_id, player_b_id, criado_por, created_at")
    .in("status", ["pendente", "edited"])
    .order("created_at", { ascending: true });

  if (params?.responsibleUserId) {
    matchesQuery = matchesQuery.or(
      `player_a_id.eq.${params.responsibleUserId},player_b_id.eq.${params.responsibleUserId}`
    );
  }

  const { data: matchesData, error: matchesError } =
    await matchesQuery.returns<PendingConfirmationMatchRow[]>();

  if (matchesError) {
    throw new Error("Erro ao carregar pendências abertas");
  }

  if (!matchesData?.length) {
    return {
      deadlineHours,
      items: [] as PendingConfirmationSnapshot[],
    };
  }

  const openMatchIds = new Set(matchesData.map((row) => row.id));
  const oldestCreatedAt = matchesData[0]?.created_at;
  const { data: notificationsData, error: notificationsError } = await supabase
    .from("notifications")
    .select("created_at, payload")
    .eq("tipo", "confirmacao")
    .gte("created_at", oldestCreatedAt)
    .order("created_at", { ascending: true })
    .returns<PendingConfirmationNotificationRow[]>();

  if (notificationsError) {
    throw new Error("Erro ao carregar o histórico das pendências");
  }

  const latestPendingEventByMatchId = new Map<
    string,
    {
      pendingSinceAt: string;
      pendingKind: PendingConfirmationSnapshot["pendingKind"];
      pendingContext: PendingConfirmationSnapshot["pendingContext"];
    }
  >();
  const nonexistentRejectedByMatchId = new Map<string, string>();

  for (const row of notificationsData ?? []) {
    const payload = parsePendingNotificationPayload(row.payload);

    if (!payload || !openMatchIds.has(payload.match_id)) {
      continue;
    }

    if (payload.event === "nonexistent_rejected") {
      nonexistentRejectedByMatchId.set(payload.match_id, payload.actor_id);
    }

    if (
      payload.event !== "pending_created" &&
      payload.event !== "pending_transferred" &&
      payload.event !== "nonexistent_claimed" &&
      payload.event !== "nonexistent_rejected"
    ) {
      continue;
    }

    latestPendingEventByMatchId.set(payload.match_id, {
      pendingSinceAt: row.created_at,
      pendingKind: getPendingKindFromEvent(payload.event),
      pendingContext: getPendingContextFromEvent(payload.event),
    });
  }

  const items = matchesData
    .map((match) => {
      const responsibleUserId = getPendingResponsibleUserId(match);
      const latestPendingEvent = latestPendingEventByMatchId.get(match.id);
      const pendingSinceAt = latestPendingEvent?.pendingSinceAt ?? match.created_at;
      const pendingContext =
        nonexistentRejectedByMatchId.has(match.id) &&
        latestPendingEvent?.pendingKind !== "nonexistent"
          ? "nonexistent_rejected"
          : latestPendingEvent?.pendingContext ?? "default";

      return {
        matchId: match.id,
        responsibleUserId,
        pendingSinceAt,
        currentDeadlineAt: addHoursToIso(pendingSinceAt, deadlineHours),
        pendingKind: latestPendingEvent?.pendingKind ?? "score",
        pendingContext,
        pendingContextActorId:
          pendingContext === "nonexistent_rejected"
            ? nonexistentRejectedByMatchId.get(match.id) ?? null
            : null,
      };
    })
    .filter((item) => {
      if (!item.responsibleUserId) return false;
      if (!params?.responsibleUserId) return true;
      return item.responsibleUserId === params.responsibleUserId;
    });

  return {
    deadlineHours,
    items,
  };
}

async function insertSystemAutoValidationLogs(
  supabase: AdminSupabaseClient,
  rows: AutoValidatedMatchLogEntry[],
  deadlineHours: number
) {
  if (rows.length === 0) return;

  const { error } = await supabase.from("admin_logs").insert(
    rows.map((row) => ({
      admin_id: null,
      admin_role: "system",
      action: "match_auto_validated",
      action_description: `Partida confirmada automaticamente após ${deadlineHours}h sem resposta.`,
      target_type: "match",
      target_id: row.matchId,
      target_name: `${row.playerAName} vs ${row.playerBName} (${row.scoreLabel})`,
      old_value: {
        status: row.oldStatus,
        prazo_original: row.deadlineAt,
      },
      new_value: {
        status: "validado",
        origem: "Automática",
        prazo_confirmacao_horas: deadlineHours,
        placar: row.scoreLabel,
        player_a: row.playerAName,
        player_b: row.playerBName,
        pontos_variacao_a: row.playerADelta,
        pontos_variacao_b: row.playerBDelta,
      },
      reason: null,
    }))
  );

  if (error) {
    console.error("match_auto_validated_log_failed", {
      reason: error.message,
      code: error.code,
      matches: rows.map((row) => row.matchId),
    });
  }
}

async function insertSystemAutoCancellationLogs(
  supabase: AdminSupabaseClient,
  rows: AutoCancelledMatchLogEntry[],
  deadlineHours: number
) {
  if (rows.length === 0) return;

  const { error } = await supabase.from("admin_logs").insert(
    rows.map((row) => ({
      admin_id: null,
      admin_role: "system",
      action: "match_auto_cancelled_nonexistent",
      action_description: `Partida cancelada automaticamente após ${deadlineHours}h sem confirmação de jogo inexistente.`,
      target_type: "match",
      target_id: row.matchId,
      target_name: `${row.playerAName} vs ${row.playerBName} (${row.scoreLabel})`,
      old_value: {
        status: row.oldStatus,
        prazo_original: row.deadlineAt,
        solicitacao: "jogo_inexistente",
      },
      new_value: {
        status: "cancelado",
        origem: "Automática",
        prazo_confirmacao_horas: deadlineHours,
        placar: row.scoreLabel,
        player_a: row.playerAName,
        player_b: row.playerBName,
      },
      reason: "Solicitação de jogo inexistente sem resposta dentro do prazo.",
    }))
  );

  if (error) {
    console.error("match_auto_cancelled_nonexistent_log_failed", {
      reason: error.message,
      code: error.code,
      matches: rows.map((row) => row.matchId),
    });
  }
}

export async function getPendingConfirmationDeadlineHours(
  supabase: AdminSupabaseClient = createAdminClient()
) {
  return getDeadlineHours(supabase);
}

export async function cancelPendingMatchForNonexistent(params: {
  matchId: string;
  actorUserId?: string | null;
  actorName?: string | null;
  actorType: "player" | "system";
  supabase?: AdminSupabaseClient;
}): Promise<CancelPendingMatchForNonexistentResult> {
  const supabase = params.supabase ?? createAdminClient();
  const fail = (
    error: string,
    reason: string
  ): CancelPendingMatchForNonexistentResult => ({
    success: false,
    error,
    reason,
  });

  const { items } = await getOpenPendingConfirmationSnapshots({ supabase });
  const pendingSnapshot = items.find((item) => item.matchId === params.matchId);

  if (!pendingSnapshot || pendingSnapshot.pendingKind !== "nonexistent") {
    return fail(
      "Esta partida não está aguardando confirmação de jogo inexistente",
      "pending_not_nonexistent"
    );
  }

  if (
    params.actorType === "player" &&
    (!params.actorUserId || pendingSnapshot.responsibleUserId !== params.actorUserId)
  ) {
    return fail(
      "Esta partida não está aguardando sua confirmação de cancelamento",
      "actor_not_waiting_user"
    );
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc("cancel_match_v2", {
    p_match_id: params.matchId,
  });

  let cancelledMatch = rpcError
    ? null
    : parseCancelMatchRpcRow(rpcData);

  if (rpcError && shouldFallbackCancelOpenPendingMatch(rpcError.message)) {
    const fallbackResult = await cancelOpenPendingMatchWithoutRpc({
      matchId: params.matchId,
      supabase,
    });

    if (!fallbackResult.success) {
      return fallbackResult;
    }

    cancelledMatch = {
      match_id: params.matchId,
      old_status: fallbackResult.oldStatus,
      player_a_id: fallbackResult.playerAId || "",
      player_b_id: fallbackResult.playerBId || "",
      created_by: fallbackResult.createdBy ?? params.actorUserId ?? null,
      player_a_name: fallbackResult.playerAName,
      player_b_name: fallbackResult.playerBName,
      score_a: fallbackResult.scoreA ?? Number.parseInt(fallbackResult.scoreLabel.split("x")[0] ?? "0", 10),
      score_b: fallbackResult.scoreB ?? Number.parseInt(fallbackResult.scoreLabel.split("x")[1] ?? "0", 10),
    };
  } else if (rpcError) {
    const mappedError = mapCancelMatchRpcErrorMessage(rpcError.message);
    return fail(mappedError.error, mappedError.reason);
  }

  if (!cancelledMatch) {
    return fail("Erro ao cancelar partida", "cancel_match_rpc_invalid");
  }

  if (cancelledMatch.old_status !== "pendente" && cancelledMatch.old_status !== "edited") {
    return fail(
      "Esta partida não era uma pendência aberta",
      "match_not_open_pending"
    );
  }

  const actorId =
    params.actorType === "system"
      ? "system"
      : params.actorUserId || cancelledMatch.created_by || cancelledMatch.player_a_id;
  const actorName =
    params.actorName ??
    (params.actorType === "system" ? "Cancelamento automático" : null);
  const createdBy = cancelledMatch.created_by || actorId;
  const recipients = Array.from(
    new Set([cancelledMatch.player_a_id, cancelledMatch.player_b_id])
  );

  await Promise.all(
    recipients.map((recipientId) =>
      emitPendingResolutionNotification({
        supabase,
        recipientId,
        matchId: params.matchId,
        status: "cancelado",
        actorId,
        actorName,
        createdBy,
      })
    )
  );

  const scoreLabel = `${cancelledMatch.score_a}x${cancelledMatch.score_b}`;

  return {
    success: true,
    oldStatus: cancelledMatch.old_status,
    targetName: `${cancelledMatch.player_a_name} vs ${cancelledMatch.player_b_name} (${scoreLabel})`,
    scoreLabel,
    playerAName: cancelledMatch.player_a_name,
    playerBName: cancelledMatch.player_b_name,
  };
}

export async function enforcePendingConfirmationSla(params?: {
  responsibleUserId?: string;
  supabase?: AdminSupabaseClient;
}) {
  const supabase = params?.supabase ?? createAdminClient();
  const nowIso = new Date().toISOString();
  const { deadlineHours, items } = await getOpenPendingConfirmationSnapshots({
    responsibleUserId: params?.responsibleUserId,
    supabase,
  });
  const overdueRows = items.filter(
    (item) => new Date(item.currentDeadlineAt).getTime() <= new Date(nowIso).getTime()
  );

  if (!overdueRows.length) {
    return [];
  }

  const autoValidatedLogs: AutoValidatedMatchLogEntry[] = [];
  const autoCancelledLogs: AutoCancelledMatchLogEntry[] = [];

  for (const row of overdueRows) {
    if (row.pendingKind === "nonexistent") {
      const result = await cancelPendingMatchForNonexistent({
        matchId: row.matchId,
        actorUserId: null,
        actorName: "Cancelamento automático",
        actorType: "system",
        supabase,
      });

      if (result.success) {
        autoCancelledLogs.push({
          matchId: row.matchId,
          deadlineAt: row.currentDeadlineAt,
          oldStatus: result.oldStatus,
          scoreLabel: result.scoreLabel,
          playerAName: result.playerAName,
          playerBName: result.playerBName,
        });
        continue;
      }

      if (
        result.reason === "already_canceled" ||
        result.reason === "match_already_processed" ||
        result.reason === "pending_not_nonexistent"
      ) {
        continue;
      }

      console.error("match_auto_cancellation_failed", {
        matchId: row.matchId,
        reason: result.reason,
        error: result.error,
      });
      continue;
    }

    const result = await validatePendingMatchByActor({
      matchId: row.matchId,
      actorUserId: null,
      actorName: "Confirmação automática",
      actorType: "system",
    });

    if (result.success) {
      autoValidatedLogs.push({
        matchId: row.matchId,
        deadlineAt: row.currentDeadlineAt,
        oldStatus: result.oldStatus,
        scoreLabel: result.scoreLabel,
        playerAName: result.playerAName,
        playerBName: result.playerBName,
        playerADelta: result.playerADelta,
        playerBDelta: result.playerBDelta,
      });
      continue;
    }

    if (
      result.reason === "already_validated" ||
      result.reason === "already_canceled" ||
      result.reason === "match_already_processed"
    ) {
      continue;
    }

    console.error("match_auto_validation_failed", {
      matchId: row.matchId,
      reason: result.reason,
      error: result.error,
    });
  }

  await insertSystemAutoValidationLogs(supabase, autoValidatedLogs, deadlineHours);
  await insertSystemAutoCancellationLogs(supabase, autoCancelledLogs, deadlineHours);
  return autoValidatedLogs;
}

export async function transferMatchConfirmationResponsibility(params: {
  matchId: string;
  responsibleUserId: string;
  startedAt?: Date | string;
  supabase?: AdminSupabaseClient;
}) {
  const supabase = params.supabase ?? createAdminClient();
  const startedAtIso = new Date(params.startedAt ?? new Date()).toISOString();
  const deadlineHours = await getDeadlineHours(supabase);
  const deadlineAt = addHoursToIso(startedAtIso, deadlineHours);

  return {
    deadlineAt,
    deadlineHours,
  };
}

export async function resolveMatchConfirmationState(params: {
  matchId: string;
  resolvedAt?: Date | string;
  supabase?: AdminSupabaseClient;
}) {
  void params;
}

export async function shiftOpenPendingConfirmationDeadlines(params: {
  previousDeadlineHours: number;
  nextDeadlineHours: number;
  supabase?: AdminSupabaseClient;
}) {
  void params;
  return 0;
}
