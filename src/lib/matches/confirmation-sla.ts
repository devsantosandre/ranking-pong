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

  const pendingSinceByMatchId = new Map<string, string>();

  for (const row of notificationsData ?? []) {
    const payload = parsePendingNotificationPayload(row.payload);

    if (!payload || !openMatchIds.has(payload.match_id)) {
      continue;
    }

    if (payload.event !== "pending_created" && payload.event !== "pending_transferred") {
      continue;
    }

    pendingSinceByMatchId.set(payload.match_id, row.created_at);
  }

  const items = matchesData
    .map((match) => {
      const responsibleUserId = getPendingResponsibleUserId(match);
      const pendingSinceAt = pendingSinceByMatchId.get(match.id) ?? match.created_at;

      return {
        matchId: match.id,
        responsibleUserId,
        pendingSinceAt,
        currentDeadlineAt: addHoursToIso(pendingSinceAt, deadlineHours),
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

export async function getPendingConfirmationDeadlineHours(
  supabase: AdminSupabaseClient = createAdminClient()
) {
  return getDeadlineHours(supabase);
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

  for (const row of overdueRows) {
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
