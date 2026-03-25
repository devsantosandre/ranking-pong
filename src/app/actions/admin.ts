"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import {
  requireModerator,
  requireAdminOnly,
  getCurrentUser,
} from "@/lib/admin";
import { revalidatePath } from "next/cache";
import { validatePendingMatchByActor } from "@/lib/matches/validate-pending-match";
import type { PendingNotificationPayloadV1 } from "@/lib/types/notifications";
import {
  enforcePendingConfirmationSla,
  getPendingConfirmationDeadlineHours,
  shiftOpenPendingConfirmationDeadlines,
} from "@/lib/matches/confirmation-sla";

// ============================================================
// TIPOS
// ============================================================

export type AdminMatch = {
  id: string;
  player_a_id: string;
  player_b_id: string;
  vencedor_id: string | null;
  resultado_a: number;
  resultado_b: number;
  status: string;
  criado_por: string;
  aprovado_por: string | null;
  pontos_variacao_a: number | null;
  pontos_variacao_b: number | null;
  created_at: string;
  correction_kind: string | null;
  correction_reason: string | null;
  correction_applied_at: string | null;
  correction_applied_by: string | null;
  correction_compensation_a: number | null;
  correction_compensation_b: number | null;
  correction_impacted_match_count: number | null;
  correction_impacted_player_count: number | null;
  can_cancel_safely?: boolean;
  cancel_unavailable_reason?: string | null;
  player_a: { id: string; name: string; full_name: string };
  player_b: { id: string; name: string; full_name: string };
};

export type AdminUser = {
  id: string;
  name: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  hide_from_ranking: boolean;
  rating_atual: number;
  vitorias: number;
  derrotas: number;
  jogos_disputados: number;
};

export type AdminSetting = {
  id: string;
  key: string;
  value: string;
  description: string;
  updated_at: string;
};

export type AdminLog = {
  id: string;
  admin_id: string | null;
  admin_role: string;
  action: string;
  action_description: string;
  target_type: string;
  target_id: string | null;
  target_name: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
  admin?: { name: string; full_name: string };
};

export type AdminUpdateUserNameInput = {
  userId: string;
  name: string;
  reason: string;
};

export type AdminUpdateUserNameResult = {
  success: boolean;
  updatedName: string;
};

export type AdminCancelMatchResult =
  | { success: true }
  | { success: false; error: string };

export type AdminExceptionalCorrectionPreview = {
  matchId: string;
  playerAName: string;
  playerBName: string;
  scoreLabel: string;
  appliedAt: string;
  isAutoValidated: boolean;
  safeCancelStillAvailable: boolean;
  directMatchCount: number;
  cascadeMatchCount: number;
  cascadePlayerCount: number;
};

export type AdminExceptionalCorrectionPreviewResult =
  | { success: true; preview: AdminExceptionalCorrectionPreview }
  | { success: false; error: string };

export type AdminExceptionalCorrectionResult =
  | { success: true }
  | { success: false; error: string };

export type AdminAnalyticsSummary = {
  registrations: number;
  registrationsDelta: number;
  validated: number;
  validationRate: number;
  activePlayers: number;
  activePlayersDelta: number;
  activeAccounts: number;
  participationRate: number;
  averagePerDay: number;
  hoursSinceLastRegistration: number;
  longestGapWithoutRegistrations: number;
  newUsers: number;
  newUsersDelta: number;
  openPending: number;
  adminActions: number;
};

export type AdminAnalyticsWeekday = {
  key: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
  label: string;
  shortLabel: string;
  registrations: number;
  validated: number;
  pending: number;
  edited: number;
  canceled: number;
  uniquePlayers: number;
};

export type AdminAnalyticsDay = {
  date: string;
  label: string;
  weekday: string;
  registrations: number;
  validated: number;
  pending: number;
  edited: number;
  canceled: number;
  uniquePlayers: number;
};

export type AdminAnalyticsTrendPoint = {
  month: string;
  label: string;
  registrations: number;
  validated: number;
  activePlayers: number;
  newUsers: number;
};

export type AdminAnalyticsPlayer = {
  userId: string;
  userName: string;
  registrations: number;
  validated: number;
  wins: number;
  uniqueOpponents: number;
};

export type AdminAnalyticsRivalry = {
  id: string;
  playersLabel: string;
  registrations: number;
  validated: number;
};

export type AdminAnalyticsPendingMatch = {
  id: string;
  status: "pendente" | "edited";
  playersLabel: string;
  scoreLabel: string;
  playerAName: string;
  playerBName: string;
  scoreA: number;
  scoreB: number;
  waitingForUserId: string | null;
  waitingForUserName: string;
  pendingSinceAt: string;
  lastActorUserId: string | null;
  lastActorUserName: string;
  createdAt: string;
  matchDate: string;
  ageHours: number;
  deadlineAt: string;
  timeline: {
    id: string;
    type: "registered" | "contested";
    actorName: string;
    occurredAt: string;
  }[];
};

export type AdminPendingMatchesResponse = {
  deadlineHours: number;
  openCount: number;
  pendingCount: number;
  editedCount: number;
  items: AdminAnalyticsPendingMatch[];
};

export type AdminAnalyticsStatus = {
  key: "pendente" | "edited" | "validado" | "cancelado";
  label: string;
  count: number;
  percentage: number;
};

export type AdminAnalyticsActionBreakdown = {
  key: string;
  label: string;
  description: string;
  count: number;
};

export type AdminAnalyticsResponse = {
  selectedMonth: string;
  selectedMonthLabel: string;
  previousMonthLabel: string;
  firstAvailableMonth: string;
  firstAvailableMonthLabel: string;
  isFirstAvailableMonth: boolean;
  isCurrentMonth: boolean;
  last7DaysRangeLabel: string;
  summary: AdminAnalyticsSummary;
  weekdayStats: AdminAnalyticsWeekday[];
  dayStats: AdminAnalyticsDay[];
  trend: AdminAnalyticsTrendPoint[];
  topPlayersMonth: AdminAnalyticsPlayer[];
  topPlayersLast7Days: AdminAnalyticsPlayer[];
  topRivalries: AdminAnalyticsRivalry[];
  statusBreakdown: AdminAnalyticsStatus[];
  adminActionBreakdown: AdminAnalyticsActionBreakdown[];
  insights: string[];
};

// ============================================================
// HELPERS
// ============================================================

const MAX_PAGE = 1000; // Limite máximo de páginas para evitar abuso
type ServerSupabaseClient = ReturnType<typeof createAdminClient>;
const BUSINESS_TIMEZONE = process.env.APP_TIMEZONE || "America/Sao_Paulo";
type AdminMatchActionSource = "partidas" | "pendencias";
const ADMIN_MATCH_ACTION_SOURCE_LABEL: Record<AdminMatchActionSource, string> = {
  partidas: "Partidas",
  pendencias: "Pendências",
};
const ADMIN_MATCH_ACTION_SOURCE_TEXT: Record<AdminMatchActionSource, string> = {
  partidas: "pela tela de Partidas",
  pendencias: "pela tela de Pendências",
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
  player_a_delta: number | null;
  player_b_delta: number | null;
  achievements_revoked: number;
};
type ExceptionalCorrectionRpcRow = {
  match_id: string;
  old_status: "validado";
  correction_kind: "without_recalculation";
  player_a_id: string;
  player_b_id: string;
  player_a_name: string;
  player_b_name: string;
  score_a: number;
  score_b: number;
  compensation_a: number;
  compensation_b: number;
  achievements_revoked: number;
};
type MatchAppliedAtSource = {
  id: string;
  created_at: string;
};
type RatingTransactionAppliedAtRow = {
  match_id: string | null;
  created_at: string;
};
const WEEKDAY_METADATA = [
  { day: 1, key: "mon", label: "Segunda-feira", shortLabel: "Seg" },
  { day: 2, key: "tue", label: "Terça-feira", shortLabel: "Ter" },
  { day: 3, key: "wed", label: "Quarta-feira", shortLabel: "Qua" },
  { day: 4, key: "thu", label: "Quinta-feira", shortLabel: "Qui" },
  { day: 5, key: "fri", label: "Sexta-feira", shortLabel: "Sex" },
  { day: 6, key: "sat", label: "Sábado", shortLabel: "Sáb" },
  { day: 0, key: "sun", label: "Domingo", shortLabel: "Dom" },
] as const;
const ADMIN_ACTION_METADATA: Record<
  string,
  Pick<AdminAnalyticsActionBreakdown, "key" | "label" | "description">
> = {
  match_cancelled: {
    key: "match_cancelled",
    label: "Cancelamentos de partidas",
    description: "Partidas canceladas manualmente pelo admin.",
  },
  match_validated_by_admin: {
    key: "match_validated_by_admin",
    label: "Partidas validadas pelo admin",
    description: "Partidas pendentes aceitas diretamente pelo admin.",
  },
  match_auto_validated: {
    key: "match_auto_validated",
    label: "Partidas confirmadas automaticamente",
    description: "Partidas validadas pelo sistema ao fim do prazo configurado.",
  },
  match_corrected_without_recalculation: {
    key: "match_corrected_without_recalculation",
    label: "Correções sem recálculo",
    description:
      "Correções excepcionais que compensam só os dois jogadores e removem a partida do ranking sem recalcular a cadeia posterior.",
  },
  match_confirmation_overdue: {
    key: "match_confirmation_overdue",
    label: "Histórico do modelo anterior",
    description: "Registros herdados do fluxo antigo de pendências, mantidos só para histórico.",
  },
  match_confirmation_extension_granted: {
    key: "match_confirmation_extension_granted",
    label: "Prorrogações antigas",
    description: "Prorrogações registradas no modelo anterior de pendências, mantidas só para histórico.",
  },
  user_created: {
    key: "user_created",
    label: "Jogadores criados",
    description: "Novos jogadores cadastrados pelo admin.",
  },
  user_password_reset: {
    key: "user_password_reset",
    label: "Senhas resetadas",
    description: "Redefinições de senha feitas para jogadores.",
  },
  user_name_updated: {
    key: "user_name_updated",
    label: "Nomes alterados",
    description: "Correções ou mudanças de nome de jogador.",
  },
  user_rating_changed: {
    key: "user_rating_changed",
    label: "Ajustes de pontuação",
    description: "Alterações manuais de rating ou pontos.",
  },
  user_activated: {
    key: "user_status_changed",
    label: "Status de jogadores",
    description: "Jogadores ativados ou desativados pelo admin.",
  },
  user_deactivated: {
    key: "user_status_changed",
    label: "Status de jogadores",
    description: "Jogadores ativados ou desativados pelo admin.",
  },
  user_hidden_from_ranking: {
    key: "user_ranking_visibility",
    label: "Visibilidade no ranking",
    description: "Jogadores ocultados ou exibidos no ranking.",
  },
  user_shown_in_ranking: {
    key: "user_ranking_visibility",
    label: "Visibilidade no ranking",
    description: "Jogadores ocultados ou exibidos no ranking.",
  },
  user_stats_reset: {
    key: "user_stats_reset",
    label: "Estatísticas resetadas",
    description: "Zeragem de estatísticas e retorno ao rating inicial.",
  },
  user_role_changed: {
    key: "user_role_changed",
    label: "Permissões alteradas",
    description: "Mudanças de perfil entre jogador, moderador e admin.",
  },
  setting_changed: {
    key: "setting_changed",
    label: "Configurações alteradas",
    description: "Ajustes nas regras e parâmetros do sistema.",
  },
};

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
    typeof candidate.score_b !== "number" ||
    typeof candidate.achievements_revoked !== "number"
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
    player_a_delta:
      typeof candidate.player_a_delta === "number" ? candidate.player_a_delta : null,
    player_b_delta:
      typeof candidate.player_b_delta === "number" ? candidate.player_b_delta : null,
    achievements_revoked: candidate.achievements_revoked,
  };
}

function mapCancelMatchRpcErrorMessage(message: string | undefined): string {
  const normalized = (message || "").toLowerCase();

  if (normalized.includes("already_canceled")) {
    return "Partida já está cancelada";
  }

  if (normalized.includes("match_not_found")) {
    return "Partida não encontrada";
  }

  if (normalized.includes("missing_rating_delta")) {
    return "Partida validada sem variação de pontos para reverter";
  }

  if (normalized.includes("cannot_cancel_historical_validated_match")) {
    return "Não é possível cancelar esta partida porque já existem partidas validadas mais recentes envolvendo esses jogadores";
  }

  if (normalized.includes("match_already_processed")) {
    return "Esta partida já foi processada por outro usuário";
  }

  return "Erro ao cancelar partida";
}

function mapExceptionalCorrectionRpcErrorMessage(message: string | undefined): string {
  const normalized = (message || "").toLowerCase();

  if (normalized.includes("match_not_found")) {
    return "Partida não encontrada";
  }

  if (normalized.includes("match_not_validated")) {
    return "Só é possível corrigir partidas já validadas";
  }

  if (normalized.includes("match_already_corrected")) {
    return "Esta partida já recebeu uma correção sem recálculo";
  }

  if (normalized.includes("missing_rating_delta")) {
    return "A partida não tem variação de pontos suficiente para compensação";
  }

  if (normalized.includes("correction_reason_too_short")) {
    return "Explique o motivo com pelo menos 5 caracteres";
  }

  if (normalized.includes("match_already_processed")) {
    return "Esta partida já foi processada por outro usuário";
  }

  if (normalized.includes("safe_cancel_still_available")) {
    return "O cancelamento com reversão ainda é possível para esta partida. Use o cancelamento normal.";
  }

  return "Erro ao aplicar correção sem recálculo";
}

function mapExceptionalCorrectionPreviewErrorMessage(message: string | undefined): string {
  const normalized = (message || "").toLowerCase();

  if (normalized.includes("matches.correction_kind does not exist")) {
    return "A correção sem recálculo ainda não está disponível neste ambiente. A migration do banco precisa ser aplicada.";
  }

  if (normalized.includes("apply_exceptional_match_correction_v1")) {
    return "A correção sem recálculo ainda não está disponível neste ambiente. A migration do banco precisa ser aplicada.";
  }

  if (normalized.includes("match_not_found")) {
    return "Partida não encontrada";
  }

  return "Erro ao analisar a correção";
}

function parseExceptionalCorrectionRpcRow(
  payload: unknown
): ExceptionalCorrectionRpcRow | null {
  const candidate = Array.isArray(payload) ? payload[0] : payload;

  if (
    !candidate ||
    typeof candidate !== "object" ||
    typeof (candidate as Record<string, unknown>).match_id !== "string" ||
    typeof (candidate as Record<string, unknown>).old_status !== "string" ||
    typeof (candidate as Record<string, unknown>).correction_kind !== "string" ||
    typeof (candidate as Record<string, unknown>).player_a_id !== "string" ||
    typeof (candidate as Record<string, unknown>).player_b_id !== "string" ||
    typeof (candidate as Record<string, unknown>).player_a_name !== "string" ||
    typeof (candidate as Record<string, unknown>).player_b_name !== "string" ||
    typeof (candidate as Record<string, unknown>).score_a !== "number" ||
    typeof (candidate as Record<string, unknown>).score_b !== "number" ||
    typeof (candidate as Record<string, unknown>).compensation_a !== "number" ||
    typeof (candidate as Record<string, unknown>).compensation_b !== "number" ||
    typeof (candidate as Record<string, unknown>).achievements_revoked !== "number"
  ) {
    return null;
  }

  return candidate as ExceptionalCorrectionRpcRow;
}

function compareMatchPositionAt(
  left: { position_at: string; id: string },
  right: { position_at: string; id: string }
) {
  const positionDelta =
    new Date(left.position_at).getTime() - new Date(right.position_at).getTime();

  if (positionDelta !== 0) {
    return positionDelta;
  }

  return left.id.localeCompare(right.id);
}

type ExceptionalCorrectionPreviewMatchRow = {
  id: string;
  player_a_id: string;
  player_b_id: string;
  resultado_a: number;
  resultado_b: number;
  created_at: string;
  status: string;
  aprovado_por: string | null;
  correction_kind: string | null;
  player_a:
    | { id: string; name: string | null; full_name: string | null }
    | Array<{ id: string; name: string | null; full_name: string | null }>
    | null;
  player_b:
    | { id: string; name: string | null; full_name: string | null }
    | Array<{ id: string; name: string | null; full_name: string | null }>
    | null;
};

function getDisplayPlayerName(
  user:
    | { full_name: string | null; name: string | null }
    | Array<{ full_name: string | null; name: string | null }>
    | null,
  fallback: string
) {
  const normalized = Array.isArray(user) ? (user[0] ?? null) : user;
  return normalized?.full_name || normalized?.name || fallback;
}

async function getMatchPointsAppliedAt(
  supabase: ServerSupabaseClient,
  matchId: string,
  fallbackCreatedAt: string
) {
  const { data, error } = await supabase
    .from("rating_transactions")
    .select("created_at")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    throw new Error("Erro ao localizar quando os pontos foram aplicados");
  }

  return data?.[0]?.created_at || fallbackCreatedAt;
}

async function getMatchAppliedAtMap(
  supabase: ServerSupabaseClient,
  matches: MatchAppliedAtSource[]
) {
  const uniqueMatches = Array.from(
    new Map(matches.map((match) => [match.id, match])).values()
  );

  if (uniqueMatches.length === 0) {
    return new Map<string, string>();
  }

  const fallbackMap = new Map(uniqueMatches.map((match) => [match.id, match.created_at]));
  const { data, error } = await supabase
    .from("rating_transactions")
    .select("match_id, created_at")
    .in(
      "match_id",
      uniqueMatches.map((match) => match.id)
    )
    .in("motivo", ["vitoria", "derrota"])
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error("Erro ao localizar quando os pontos das partidas foram aplicados");
  }

  const appliedAtMap = new Map<string, string>();

  for (const row of ((data ?? []) as RatingTransactionAppliedAtRow[])) {
    if (!row.match_id || appliedAtMap.has(row.match_id)) continue;
    appliedAtMap.set(row.match_id, row.created_at);
  }

  for (const match of uniqueMatches) {
    if (!appliedAtMap.has(match.id)) {
      appliedAtMap.set(match.id, fallbackMap.get(match.id) || match.created_at);
    }
  }

  return appliedAtMap;
}

async function buildExceptionalCorrectionPreview(
  supabase: ServerSupabaseClient,
  matchId: string
): Promise<AdminExceptionalCorrectionPreview> {
  const { data, error } = await supabase
    .from("matches")
    .select(
      `
      id,
      player_a_id,
      player_b_id,
      resultado_a,
      resultado_b,
      created_at,
      status,
      aprovado_por,
      correction_kind,
      player_a:users!player_a_id(id, name, full_name),
      player_b:users!player_b_id(id, name, full_name)
    `
    )
    .eq("id", matchId)
    .single();

  if (error) {
    throw new Error(mapExceptionalCorrectionPreviewErrorMessage(error.message));
  }

  if (!data) {
    throw new Error("Partida não encontrada");
  }

  const match = data as ExceptionalCorrectionPreviewMatchRow;
  const playerAName = getDisplayPlayerName(match.player_a, "Jogador A");
  const playerBName = getDisplayPlayerName(match.player_b, "Jogador B");
  const appliedAt = await getMatchPointsAppliedAt(supabase, match.id, match.created_at);

  const { data: allValidatedMatches, error: allValidatedMatchesError } = await supabase
    .from("matches")
    .select("id, player_a_id, player_b_id, created_at")
    .eq("status", "validado")
    .order("created_at", { ascending: true });

  if (allValidatedMatchesError) {
    throw new Error("Erro ao medir o impacto da correção");
  }

  const validatedMatches =
    (allValidatedMatches as Array<{
      id: string;
      player_a_id: string;
      player_b_id: string;
      created_at: string;
    }> | null) ?? [];
  const appliedAtMap = await getMatchAppliedAtMap(supabase, validatedMatches);
  const laterMatches = validatedMatches.filter(
    (item) =>
      item.id !== match.id &&
      compareMatchPositionAt(
        {
          position_at: appliedAtMap.get(item.id) || item.created_at,
          id: item.id,
        },
        {
          position_at: appliedAt,
          id: match.id,
        }
      ) > 0
  );

  const directMatchCount = laterMatches.filter(
    (item) =>
      item.player_a_id === match.player_a_id ||
      item.player_b_id === match.player_a_id ||
      item.player_a_id === match.player_b_id ||
      item.player_b_id === match.player_b_id
  ).length;

  const impactedPlayers = new Set<string>([match.player_a_id, match.player_b_id]);
  const impactedMatchIds = new Set<string>();

  let changed = true;
  while (changed) {
    changed = false;

    for (const item of laterMatches) {
      if (impactedMatchIds.has(item.id)) continue;

      if (
        impactedPlayers.has(item.player_a_id) ||
        impactedPlayers.has(item.player_b_id)
      ) {
        impactedMatchIds.add(item.id);
        const previousSize = impactedPlayers.size;
        impactedPlayers.add(item.player_a_id);
        impactedPlayers.add(item.player_b_id);
        if (impactedPlayers.size !== previousSize) {
          changed = true;
        }
      }
    }
  }

  return {
    matchId: match.id,
    playerAName,
    playerBName,
    scoreLabel: `${match.resultado_a}x${match.resultado_b}`,
    appliedAt,
    isAutoValidated: match.aprovado_por === null,
    safeCancelStillAvailable: directMatchCount === 0,
    directMatchCount,
    cascadeMatchCount: impactedMatchIds.size,
    cascadePlayerCount: impactedPlayers.size,
  };
}

type AnalyticsMatchRow = {
  id: string;
  player_a_id: string;
  player_b_id: string;
  vencedor_id: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
  data_partida: string;
};

type AnalyticsUserRow = {
  id: string;
  name: string | null;
  full_name: string | null;
  email: string | null;
  created_at: string | null;
  is_active: boolean | null;
};

type AnalyticsLogRow = {
  id: string;
  action: string | null;
  admin_role: string | null;
  created_at: string | null;
};

type AnalyticsFirstMatchRow = {
  data_partida: string;
};

type AnalyticsRelationUser = {
  id?: string | null;
  name?: string | null;
  full_name?: string | null;
  email?: string | null;
};

type AnalyticsUserRelation = AnalyticsRelationUser | AnalyticsRelationUser[] | null;

type AnalyticsPendingMatchRow = {
  id: string;
  player_a_id: string;
  player_b_id: string;
  criado_por: string | null;
  resultado_a: number | null;
  resultado_b: number | null;
  status: "pendente" | "edited";
  created_at: string;
  data_partida: string;
  player_a: AnalyticsUserRelation;
  player_b: AnalyticsUserRelation;
  creator: AnalyticsUserRelation;
};

type AnalyticsPendingConfirmationStateRow = {
  match_id: string;
  responsible_user_id: string;
  current_deadline_at: string;
};

type AnalyticsNotificationRow = {
  created_at: string;
  payload: unknown;
};

function validatePage(page: number): number {
  if (typeof page !== "number" || isNaN(page)) return 0;
  if (page < 0) return 0;
  if (page > MAX_PAGE) return MAX_PAGE;
  return Math.floor(page);
}

function padTwoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

function normalizeMonthInput(month?: string): string {
  const fallback = getDateInTimezone(new Date(), BUSINESS_TIMEZONE).slice(0, 7);

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return fallback;
  }

  const [year, monthNumber] = month.split("-").map(Number);

  if (!year || monthNumber < 1 || monthNumber > 12) {
    return fallback;
  }

  return `${year}-${padTwoDigits(monthNumber)}`;
}

function shiftMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const shiftedDate = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return `${shiftedDate.getUTCFullYear()}-${padTwoDigits(shiftedDate.getUTCMonth() + 1)}`;
}

function getMonthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  return {
    startDate: `${month}-01`,
    endDate: `${month}-${padTwoDigits(lastDay)}`,
  };
}

function getMonthsBetween(startMonth: string, endMonth: string): string[] {
  const months: string[] = [];
  let cursor = startMonth;

  while (cursor <= endMonth) {
    months.push(cursor);
    cursor = shiftMonth(cursor, 1);
  }

  return months;
}

function getEarlierMonth(left: string, right: string): string {
  return left <= right ? left : right;
}

function getLaterMonth(left: string, right: string): string {
  return left >= right ? left : right;
}

function formatMonthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const referenceDate = new Date(Date.UTC(year, monthNumber - 1, 1));

  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(referenceDate);
}

function getMonthKeyFromTimestamp(dateInput: string | null): string | null {
  if (!dateInput) return null;
  return getDateInTimezone(dateInput, BUSINESS_TIMEZONE).slice(0, 7);
}

function getTodayDateKey(): string {
  return getDateInTimezone(new Date(), BUSINESS_TIMEZONE);
}

function getUtcWeekday(dateKey: string): number {
  const [year, monthNumber, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1, day)).getUTCDay();
}

function getDaysInMonth(month: string): string[] {
  const { endDate } = getMonthRange(month);
  const todayDateKey = getTodayDateKey();
  const currentMonthKey = todayDateKey.slice(0, 7);
  const totalDays =
    month === currentMonthKey
      ? Number(todayDateKey.slice(-2))
      : Number(endDate.slice(-2));
  const dates: string[] = [];

  for (let day = 1; day <= totalDays; day += 1) {
    dates.push(`${month}-${padTwoDigits(day)}`);
  }

  return dates;
}

function formatDayLabel(dateKey: string): string {
  const [year, monthNumber, day] = dateKey.split("-").map(Number);

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthNumber - 1, day)));
}

function formatDateRangeLabel(startDate: string, endDate: string): string {
  if (!startDate || !endDate) {
    return "";
  }

  if (startDate === endDate) {
    return formatDayLabel(startDate);
  }

  return `${formatDayLabel(startDate)} a ${formatDayLabel(endDate)}`;
}

function getUserDisplayName(user: Pick<AnalyticsUserRow, "full_name" | "name" | "email">) {
  return user.full_name || user.name || user.email?.split("@")[0] || "Jogador";
}

function normalizeAnalyticsUserRelation(
  user: AnalyticsUserRelation,
  fallbackId: string | null
) {
  const normalized = Array.isArray(user) ? (user[0] ?? null) : user;

  return {
    id: normalized?.id ?? fallbackId,
    name: normalized?.name ?? null,
    full_name: normalized?.full_name ?? null,
    email: normalized?.email ?? null,
  };
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

function getHoursSince(dateInput: string): number {
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(dateInput).getTime()) / (1000 * 60 * 60))
  );
}

function getDeadlineFromPendingSince(dateInput: string, deadlineHours: number): string {
  return new Date(
    new Date(dateInput).getTime() + deadlineHours * 60 * 60 * 1000
  ).toISOString();
}

function buildAnalyticsTopPlayers(
  matches: AnalyticsMatchRow[],
  userNames: Map<string, string>
): AdminAnalyticsPlayer[] {
  const playerAccumulator = new Map<
    string,
    {
      registrations: number;
      validated: number;
      wins: number;
      opponents: Set<string>;
    }
  >();

  for (const match of matches) {
    const playerAEntry = playerAccumulator.get(match.player_a_id) ?? {
      registrations: 0,
      validated: 0,
      wins: 0,
      opponents: new Set<string>(),
    };
    const playerBEntry = playerAccumulator.get(match.player_b_id) ?? {
      registrations: 0,
      validated: 0,
      wins: 0,
      opponents: new Set<string>(),
    };

    playerAEntry.registrations += 1;
    playerBEntry.registrations += 1;
    playerAEntry.opponents.add(match.player_b_id);
    playerBEntry.opponents.add(match.player_a_id);

    if (match.status === "validado") {
      playerAEntry.validated += 1;
      playerBEntry.validated += 1;
    }

    if (match.vencedor_id === match.player_a_id) {
      playerAEntry.wins += 1;
    }

    if (match.vencedor_id === match.player_b_id) {
      playerBEntry.wins += 1;
    }

    playerAccumulator.set(match.player_a_id, playerAEntry);
    playerAccumulator.set(match.player_b_id, playerBEntry);
  }

  return Array.from(playerAccumulator.entries())
    .map(([userId, entry]) => ({
      userId,
      userName: userNames.get(userId) || "Jogador",
      registrations: entry.registrations,
      validated: entry.validated,
      wins: entry.wins,
      uniqueOpponents: entry.opponents.size,
    }))
    .sort((left, right) => {
      if (right.registrations !== left.registrations) {
        return right.registrations - left.registrations;
      }

      if (right.validated !== left.validated) {
        return right.validated - left.validated;
      }

      if (right.wins !== left.wins) {
        return right.wins - left.wins;
      }

      return left.userName.localeCompare(right.userName, "pt-BR");
    })
    .slice(0, 5);
}

function mapPendingMatchRows(
  rows: AnalyticsPendingMatchRow[],
  timelineByMatchId: Map<
    string,
    {
      pendingSinceAt: string;
      timeline: {
        id: string;
        type: "registered" | "contested";
        actorName: string;
        occurredAt: string;
      }[];
    }
  >,
  stateByMatchId: Map<string, AnalyticsPendingConfirmationStateRow>,
  deadlineHours: number
): AdminAnalyticsPendingMatch[] {
  return rows
    .map((match) => {
      const playerA = normalizeAnalyticsUserRelation(match.player_a, match.player_a_id);
      const playerB = normalizeAnalyticsUserRelation(match.player_b, match.player_b_id);
      const creator = normalizeAnalyticsUserRelation(match.creator, match.criado_por);
      const playerAName = getUserDisplayName(playerA);
      const playerBName = getUserDisplayName(playerB);
      const scoreA = match.resultado_a ?? 0;
      const scoreB = match.resultado_b ?? 0;
      const timelineEntry = timelineByMatchId.get(match.id);
      const stateEntry = stateByMatchId.get(match.id);
      const waitingForUserId =
        stateEntry?.responsible_user_id ?? getPendingResponsibleUserId(match);
      const waitingForUserName =
        waitingForUserId === match.player_a_id
          ? playerAName
          : waitingForUserId === match.player_b_id
            ? playerBName
            : "Responsavel indefinido";
      const fallbackActorName = getUserDisplayName(creator);
      const timeline =
        timelineEntry?.timeline.length
          ? timelineEntry.timeline
          : [
              {
                id: `${match.id}-registered`,
                type: "registered" as const,
                actorName: fallbackActorName,
                occurredAt: match.created_at,
              },
            ];
      const pendingSinceAt = timelineEntry?.pendingSinceAt ?? match.created_at;
      const deadlineAt =
        stateEntry?.current_deadline_at ??
        getDeadlineFromPendingSince(pendingSinceAt, deadlineHours);
      const ageHours = getHoursSince(pendingSinceAt);

      return {
        id: match.id,
        status: match.status,
        playersLabel: `${playerAName} x ${playerBName}`,
        scoreLabel: `${scoreA}x${scoreB}`,
        playerAName,
        playerBName,
        scoreA,
        scoreB,
        waitingForUserId,
        waitingForUserName,
        pendingSinceAt,
        lastActorUserId: creator.id ?? match.criado_por,
        lastActorUserName: getUserDisplayName(creator),
        createdAt: match.created_at,
        matchDate: match.data_partida,
        ageHours,
        deadlineAt,
        timeline,
      };
    })
    .sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    );
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

function buildPendingTimelineByMatchId(
  matches: AnalyticsPendingMatchRow[],
  notifications: AnalyticsNotificationRow[]
) {
  const openMatchIds = new Set(matches.map((match) => match.id));
  const timelineByMatchId = new Map<
    string,
    {
      pendingSinceAt: string;
      timeline: {
        id: string;
        type: "registered" | "contested";
        actorName: string;
        occurredAt: string;
      }[];
    }
  >();

  for (const row of notifications) {
    const payload = parsePendingNotificationPayload(row.payload);
    if (!payload || !openMatchIds.has(payload.match_id)) {
      continue;
    }

    if (payload.event !== "pending_created" && payload.event !== "pending_transferred") {
      continue;
    }

    const current = timelineByMatchId.get(payload.match_id) ?? {
      pendingSinceAt: row.created_at,
      timeline: [],
    };

    current.timeline.push({
      id: `${payload.match_id}-${payload.event}-${row.created_at}`,
      type: payload.event === "pending_created" ? "registered" : "contested",
      actorName: payload.actor_name || "Jogador",
      occurredAt: row.created_at,
    });
    current.pendingSinceAt = row.created_at;

    timelineByMatchId.set(payload.match_id, current);
  }

  return timelineByMatchId;
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function getPercentage(count: number, total: number): number {
  if (total <= 0) return 0;
  return roundToOneDecimal((count / total) * 100);
}

async function createAdminLog(params: {
  action: string;
  action_description: string;
  target_type: string;
  target_id?: string;
  target_name?: string;
  old_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
  reason?: string;
}) {
  try {
    const supabase = createAdminClient();
    const admin = await getCurrentUser();

    if (!admin) {
      return; // Não falhar a operação principal por causa do log
    }

    const { error } = await supabase.from("admin_logs").insert({
      admin_id: admin.id,
      admin_role: admin.role,
      action: params.action,
      action_description: params.action_description,
      target_type: params.target_type,
      target_id: params.target_id || null,
      target_name: params.target_name || null,
      old_value: params.old_value || null,
      new_value: params.new_value || null,
      reason: params.reason || null,
    });

    if (error) return;
  } catch {
    return;
  }
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

  if (error) return;
}

function getDateInTimezone(dateInput: string | Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(dateInput));
  } catch {
    return new Date(dateInput).toISOString().split("T")[0];
  }
}

function normalizeUtcOffset(offsetValue: string): string {
  if (!offsetValue || offsetValue === "GMT") {
    return "+00:00";
  }

  const normalizedValue = offsetValue.replace("GMT", "");
  const match = normalizedValue.match(/^([+-])(\d{1,2})(?::?(\d{2}))?$/);

  if (!match) {
    return "+00:00";
  }

  const [, sign, hours, minutes = "00"] = match;
  return `${sign}${hours.padStart(2, "0")}:${minutes}`;
}

function getDateAtTimezoneBoundary(
  dateKey: string,
  timeZone: string,
  boundary: "start" | "end"
): Date {
  const time = boundary === "start" ? "00:00:00.000" : "23:59:59.999";

  try {
    const offsetValue =
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        timeZoneName: "longOffset",
      })
        .formatToParts(new Date(`${dateKey}T12:00:00Z`))
        .find((part) => part.type === "timeZoneName")?.value ?? "GMT";

    const offset = normalizeUtcOffset(offsetValue);
    return new Date(`${dateKey}T${time}${offset}`);
  } catch {
    return new Date(`${dateKey}T${time}Z`);
  }
}

function getHoursBetween(startDate: Date, endDate: Date): number {
  return roundToOneDecimal(
    Math.max(0, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60))
  );
}

function getLongestGapWithoutRegistrations(
  timestamps: string[],
  rangeStartAt: Date,
  rangeEndAt: Date
): number {
  if (timestamps.length === 0) {
    return getHoursBetween(rangeStartAt, rangeEndAt);
  }

  const sortedDates = timestamps
    .map((timestamp) => new Date(timestamp))
    .sort((left, right) => left.getTime() - right.getTime());

  let longestGap = getHoursBetween(rangeStartAt, sortedDates[0]);

  for (let index = 1; index < sortedDates.length; index += 1) {
    longestGap = Math.max(
      longestGap,
      getHoursBetween(sortedDates[index - 1], sortedDates[index])
    );
  }

  longestGap = Math.max(
    longestGap,
    getHoursBetween(sortedDates[sortedDates.length - 1], rangeEndAt)
  );

  return roundToOneDecimal(longestGap);
}

// ============================================================
// PARTIDAS (moderator + admin)
// ============================================================

const PAGE_SIZE = 20;

export async function adminGetAllMatches(
  filters?: { status?: string },
  page = 0
) {
  await requireModerator();
  const supabase = createAdminClient();

  const validPage = validatePage(page);
  const from = validPage * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("matches")
    .select(
      `
      *,
      player_a:users!player_a_id(id, name, full_name),
      player_b:users!player_b_id(id, name, full_name)
    `
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters?.status && filters.status !== "todas") {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  const matches: AdminMatch[] = ((data ?? []) as AdminMatch[]).map((match) => ({
    ...match,
    can_cancel_safely: true,
    cancel_unavailable_reason: null,
  }));

  const validatedMatches = matches.filter(
    (match) => match.status === "validado" && match.correction_kind == null
  );

  if (validatedMatches.length > 0) {
    const validatedAppliedAtMap = await getMatchAppliedAtMap(supabase, validatedMatches);
    const trackedPlayerIds = Array.from(
      new Set(
        validatedMatches.flatMap((match) => [match.player_a_id, match.player_b_id])
      )
    );

    const involvedPlayersFilter = trackedPlayerIds
      .flatMap((playerId) => [`player_a_id.eq.${playerId}`, `player_b_id.eq.${playerId}`])
      .join(",");

    const { data: relatedValidatedMatches, error: relatedValidatedMatchesError } =
      await supabase
        .from("matches")
        .select("id, player_a_id, player_b_id, created_at")
        .eq("status", "validado")
        .or(involvedPlayersFilter);

    if (relatedValidatedMatchesError) {
      throw new Error(relatedValidatedMatchesError.message);
    }

    const candidateValidatedMatches =
      (relatedValidatedMatches as Array<{
        id: string;
        player_a_id: string;
        player_b_id: string;
        created_at: string;
      }> | null) ?? [];
    const candidateAppliedAtMap = await getMatchAppliedAtMap(
      supabase,
      candidateValidatedMatches
    );

    for (const match of matches) {
      if (match.status !== "validado" || match.correction_kind != null) continue;

      const currentAppliedAt = validatedAppliedAtMap.get(match.id) || match.created_at;
      const hasLaterValidatedMatch = candidateValidatedMatches.some((candidate) => {
        if (candidate.id === match.id) return false;

        const involvesTrackedPlayers =
          candidate.player_a_id === match.player_a_id ||
          candidate.player_b_id === match.player_a_id ||
          candidate.player_a_id === match.player_b_id ||
          candidate.player_b_id === match.player_b_id;

        if (!involvesTrackedPlayers) return false;

        return (
          compareMatchPositionAt(
            {
              position_at:
                candidateAppliedAtMap.get(candidate.id) || candidate.created_at,
              id: candidate.id,
            },
            {
              position_at: currentAppliedAt,
              id: match.id,
            }
          ) > 0
        );
      });

      if (hasLaterValidatedMatch) {
        match.can_cancel_safely = false;
        match.cancel_unavailable_reason =
          "O cancelamento com reversão foi ocultado porque já existem partidas validadas mais recentes envolvendo esses jogadores. Reverter agora deixaria o ranking inconsistente.";
      }
    }
  }

  return {
    matches,
    hasMore: data && data.length === PAGE_SIZE,
  };
}

export async function adminCancelMatch(
  matchId: string,
  reason: string,
  source: AdminMatchActionSource = "partidas"
): Promise<AdminCancelMatchResult> {
  try {
    await requireModerator();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Acesso negado: requer permissao de moderator ou admin";
    return { success: false, error: message };
  }

  if (!reason || reason.trim().length < 3) {
    return { success: false, error: "Motivo obrigatorio (minimo 3 caracteres)" };
  }

  const supabase = createAdminClient();
  let adminActor: Awaited<ReturnType<typeof getCurrentUser>> = null;

  try {
    await enforcePendingConfirmationSla({ supabase });
    adminActor = await getCurrentUser();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao cancelar partida";
    return { success: false, error: message };
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc("cancel_match_v2", {
    p_match_id: matchId,
  });

  if (rpcError) {
    return { success: false, error: mapCancelMatchRpcErrorMessage(rpcError.message) };
  }

  const cancelledMatch = parseCancelMatchRpcRow(rpcData);

  if (!cancelledMatch) {
    return { success: false, error: "Erro ao cancelar partida" };
  }

  const oldStatus = cancelledMatch.old_status;
  const targetName = `${cancelledMatch.player_a_name} vs ${cancelledMatch.player_b_name} (${cancelledMatch.score_a}x${cancelledMatch.score_b})`;

  if (oldStatus === "pendente" || oldStatus === "edited") {
    const actorId =
      adminActor?.id ||
      cancelledMatch.created_by ||
      cancelledMatch.player_a_id;
    const resolvedPayload: PendingNotificationPayloadV1 = {
      event: "pending_resolved",
      match_id: matchId,
      status: "cancelado",
      actor_id: actorId,
      actor_name: adminActor?.full_name || adminActor?.name || null,
      created_by: cancelledMatch.created_by || actorId,
    };

    const recipients = Array.from(
      new Set([cancelledMatch.player_a_id, cancelledMatch.player_b_id])
    );
    try {
      await Promise.all(
        recipients.map((recipientId) =>
          emitPendingNotification(supabase, recipientId, resolvedPayload)
        )
      );
    } catch {
      // Nao interrompe o cancelamento se a notificacao falhar.
    }
  }

  // Registrar log
  const achievementsRevoked = cancelledMatch.achievements_revoked || 0;
  const sourceLabel = ADMIN_MATCH_ACTION_SOURCE_LABEL[source];
  const sourceText = ADMIN_MATCH_ACTION_SOURCE_TEXT[source];
  try {
    await createAdminLog({
      action: "match_cancelled",
      action_description:
        oldStatus === "validado"
          ? `Partida cancelada ${sourceText}, com pontos revertidos${achievementsRevoked > 0 ? ` e ${achievementsRevoked} conquista(s) revogada(s)` : ""}`
          : `Partida cancelada ${sourceText}`,
      target_type: "match",
      target_id: matchId,
      target_name: targetName,
      old_value: {
        status: oldStatus,
        origem: sourceLabel,
        player_a: cancelledMatch.player_a_name,
        player_b: cancelledMatch.player_b_name,
        resultado_a: cancelledMatch.score_a,
        resultado_b: cancelledMatch.score_b,
      },
      new_value: {
        status: "cancelado",
        origem: sourceLabel,
        player_a: cancelledMatch.player_a_name,
        player_b: cancelledMatch.player_b_name,
        resultado_a: cancelledMatch.score_a,
        resultado_b: cancelledMatch.score_b,
        pontos_revertidos_a: cancelledMatch.player_a_delta,
        pontos_revertidos_b: cancelledMatch.player_b_delta,
      },
      reason: reason.trim(),
    });
  } catch {
    // O cancelamento ja foi aplicado; falha no log nao deve quebrar a acao.
  }

  try {
    revalidatePath("/admin");
    revalidatePath("/admin/logs");
    revalidatePath("/admin/metricas");
    revalidatePath("/admin/pendencias");
    revalidatePath("/admin/partidas");
    revalidatePath("/partidas");
    revalidatePath("/ranking");
  } catch {
    // O cancelamento ja foi aplicado; falha de revalidacao nao muda o resultado.
  }

  return { success: true };
}

export async function adminGetExceptionalMatchCorrectionPreview(
  matchId: string
): Promise<AdminExceptionalCorrectionPreviewResult> {
  try {
    await requireAdminOnly();
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Acesso negado: requer permissao de admin",
    };
  }

  try {
    const supabase = createAdminClient();
    const preview = await buildExceptionalCorrectionPreview(supabase, matchId);
    if (preview.safeCancelStillAvailable) {
      return {
        success: false,
        error: "O cancelamento com reversão ainda é possível para esta partida. Use o cancelamento normal.",
      };
    }
    return { success: true, preview };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao analisar a correção",
    };
  }
}

export async function adminCorrectMatchWithoutRecalculation(
  matchId: string,
  reason: string
): Promise<AdminExceptionalCorrectionResult> {
  try {
    await requireAdminOnly();
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Acesso negado: requer permissao de admin",
    };
  }

  if (!reason || reason.trim().length < 5) {
    return {
      success: false,
      error: "Explique o motivo com pelo menos 5 caracteres",
    };
  }

  const supabase = createAdminClient();
  const adminActor = await getCurrentUser();

  if (!adminActor) {
    return { success: false, error: "Usuário não autenticado" };
  }

  let preview: AdminExceptionalCorrectionPreview;
  try {
    preview = await buildExceptionalCorrectionPreview(supabase, matchId);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao analisar a correção",
    };
  }

  if (preview.safeCancelStillAvailable) {
    return {
      success: false,
      error: "O cancelamento com reversão ainda é possível para esta partida. Use o cancelamento normal.",
    };
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "apply_exceptional_match_correction_v1",
    {
      p_match_id: matchId,
      p_admin_id: adminActor.id,
      p_reason: reason.trim(),
      p_impacted_match_count: preview.cascadeMatchCount,
      p_impacted_player_count: preview.cascadePlayerCount,
    }
  );

  if (rpcError) {
    return {
      success: false,
      error: mapExceptionalCorrectionRpcErrorMessage(rpcError.message),
    };
  }

  const correctedMatch = parseExceptionalCorrectionRpcRow(rpcData);

  if (!correctedMatch) {
    return { success: false, error: "Erro ao aplicar correção sem recálculo" };
  }

  try {
    await createAdminLog({
      action: "match_corrected_without_recalculation",
      action_description:
        "Partida corrigida sem recálculo, com compensação restrita aos dois jogadores",
      target_type: "match",
      target_id: matchId,
      target_name: `${correctedMatch.player_a_name} vs ${correctedMatch.player_b_name} (${correctedMatch.score_a}x${correctedMatch.score_b})`,
      old_value: {
        status: correctedMatch.old_status,
        player_a: correctedMatch.player_a_name,
        player_b: correctedMatch.player_b_name,
        resultado_a: correctedMatch.score_a,
        resultado_b: correctedMatch.score_b,
        pontos_aplicados_a: -correctedMatch.compensation_a,
        pontos_aplicados_b: -correctedMatch.compensation_b,
        validada_pelo_sistema: preview.isAutoValidated,
      },
      new_value: {
        status: "cancelado",
        correction_kind: correctedMatch.correction_kind,
        player_a: correctedMatch.player_a_name,
        player_b: correctedMatch.player_b_name,
        resultado_a: correctedMatch.score_a,
        resultado_b: correctedMatch.score_b,
        compensacao_a: correctedMatch.compensation_a,
        compensacao_b: correctedMatch.compensation_b,
        impacto_direto_partidas: preview.directMatchCount,
        impacto_em_cadeia_partidas: preview.cascadeMatchCount,
        impacto_em_cadeia_jogadores: preview.cascadePlayerCount,
        prazo_aplicado_em: preview.appliedAt,
      },
      reason: reason.trim(),
    });
  } catch {
    // A correção ja foi aplicada; falha no log nao deve quebrar a acao.
  }

  try {
    revalidatePath("/admin");
    revalidatePath("/admin/logs");
    revalidatePath("/admin/metricas");
    revalidatePath("/admin/partidas");
    revalidatePath("/partidas");
    revalidatePath("/ranking");
    revalidatePath("/");
    revalidatePath("/perfil");
  } catch {
    // A correção ja foi aplicada; falha de revalidacao nao muda o resultado.
  }

  return { success: true };
}

export async function adminValidatePendingMatch(
  matchId: string,
  source: AdminMatchActionSource = "pendencias"
) {
  await requireModerator();

  const supabase = createAdminClient();
  await enforcePendingConfirmationSla({ supabase });
  const adminActor = await getCurrentUser();

  if (!adminActor) {
    throw new Error("Usuário não autenticado");
  }

  const result = await validatePendingMatchByActor({
    matchId,
    actorUserId: adminActor.id,
    actorName: adminActor.full_name || adminActor.name || null,
    actorType: "admin",
  });

  if (!result.success) {
    throw new Error(result.error);
  }

  const sourceLabel = ADMIN_MATCH_ACTION_SOURCE_LABEL[source];
  const sourceText = ADMIN_MATCH_ACTION_SOURCE_TEXT[source];
  await createAdminLog({
    action: "match_validated_by_admin",
    action_description: `Partida aceita pelo admin ${sourceText}`,
    target_type: "match",
    target_id: matchId,
    target_name: result.targetName,
    old_value: {
      status: result.oldStatus,
      origem: sourceLabel,
      placar: result.scoreLabel,
      player_a: result.playerAName,
      player_b: result.playerBName,
    },
    new_value: {
      status: "validado",
      origem: sourceLabel,
      placar: result.scoreLabel,
      player_a: result.playerAName,
      player_b: result.playerBName,
      pontos_variacao_a: result.playerADelta,
      pontos_variacao_b: result.playerBDelta,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/logs");
  revalidatePath("/admin/metricas");
  revalidatePath("/admin/pendencias");
  revalidatePath("/admin/partidas");
  revalidatePath("/partidas");
  revalidatePath("/ranking");

  return { success: true };
}

// ============================================================
// JOGADORES - Moderator + Admin
// ============================================================

export async function adminGetAllUsers(
  filters?: { status?: string; role?: string },
  page = 0
) {
  await requireModerator();
  const supabase = createAdminClient();

  const validPage = validatePage(page);
  const from = validPage * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("users")
    .select(
      "id, name, full_name, email, role, is_active, hide_from_ranking, rating_atual, vitorias, derrotas, jogos_disputados"
    )
    .order("rating_atual", { ascending: false });

  // Filtro de status
  if (filters?.status === "ativos") {
    query = query.eq("is_active", true);
  } else if (filters?.status === "inativos") {
    query = query.eq("is_active", false);
  }

  // Filtro de role
  if (filters?.role && filters.role !== "todos") {
    query = query.eq("role", filters.role);
  }

  const { data, error } = await query.range(from, to);

  if (error) throw new Error(error.message);
  return {
    users: data as AdminUser[],
    hasMore: data && data.length === PAGE_SIZE,
  };
}

// Busca de usuários por texto (sem paginação - para busca completa)
export async function adminSearchUsers(
  search: string,
  filters?: { status?: string; role?: string }
): Promise<AdminUser[]> {
  await requireModerator();
  const supabase = createAdminClient();

  if (!search || search.trim().length < 2) {
    return [];
  }

  const searchTerm = `%${search.trim()}%`;

  let query = supabase
    .from("users")
    .select(
      "id, name, full_name, email, role, is_active, hide_from_ranking, rating_atual, vitorias, derrotas, jogos_disputados"
    )
    .or(`name.ilike.${searchTerm},full_name.ilike.${searchTerm},email.ilike.${searchTerm}`)
    .order("rating_atual", { ascending: false })
    .limit(50); // Limita a 50 resultados na busca

  // Filtro de status
  if (filters?.status === "ativos") {
    query = query.eq("is_active", true);
  } else if (filters?.status === "inativos") {
    query = query.eq("is_active", false);
  }

  // Filtro de role
  if (filters?.role && filters.role !== "todos") {
    query = query.eq("role", filters.role);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return data as AdminUser[];
}

export async function adminCreateUser(
  name: string,
  email: string,
  tempPassword: string
) {
  await requireModerator();

  if (!name || name.trim().length < 2) {
    throw new Error("Nome obrigatorio (minimo 2 caracteres)");
  }

  if (!email || !email.includes("@")) {
    throw new Error("Email invalido");
  }

  if (!tempPassword || tempPassword.length < 6) {
    throw new Error("Senha temporaria deve ter no minimo 6 caracteres");
  }

  const supabase = createAdminClient();
  const adminClient = createAdminClient();
  const normalizedEmail = email.toLowerCase().trim();

  // Verificar se email ja existe na tabela users
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("email", normalizedEmail)
    .single();

  if (existingUser) {
    throw new Error("Email ja cadastrado");
  }

  // Buscar rating inicial das configuracoes
  const { data: ratingConfig } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "rating_inicial")
    .single();

  const ratingInicial = parseInt(ratingConfig?.value || "250", 10);

  // Tentar criar usuario no Supabase Auth (requer service_role_key)
  let userId: string;

  const { data: authData, error: authError } =
    await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        name: name.trim(),
        full_name: name.trim(),
      },
    });

  if (authError) {
    // Se o erro for de email já existente, tentar obter o usuário existente
    if (authError.message.includes("already been registered") ||
        authError.message.includes("already exists")) {
      // Buscar usuário existente no Auth por email
      const { data: listData } = await adminClient.auth.admin.listUsers();
      const existingAuthUser = listData?.users?.find(
        (u) => u.email?.toLowerCase() === normalizedEmail
      );

      if (existingAuthUser) {
        userId = existingAuthUser.id;
        // Atualizar a senha do usuário existente
        await adminClient.auth.admin.updateUserById(userId, {
          password: tempPassword,
        });
      } else {
        throw new Error(`Erro ao criar usuario: ${authError.message}`);
      }
    } else {
      throw new Error(`Erro ao criar usuario: ${authError.message}`);
    }
  } else {
    userId = authData.user.id;
  }

  // Criar ou atualizar registro na tabela users (upsert)
  const { error: userError } = await supabase.from("users").upsert({
    id: userId,
    name: name.trim(),
    full_name: name.trim(),
    email: normalizedEmail,
    role: "player",
    is_active: true,
    rating_atual: ratingInicial,
    vitorias: 0,
    derrotas: 0,
    jogos_disputados: 0,
  }, { onConflict: "id" });

  if (userError) {
    // Tentar deletar o usuario do auth se falhar (requer service_role_key)
    await adminClient.auth.admin.deleteUser(userId);
    throw new Error(`Erro ao criar perfil: ${userError.message}`);
  }

  // Registrar log
  await createAdminLog({
    action: "user_created",
    action_description: "Novo jogador criado",
    target_type: "user",
    target_id: userId,
    target_name: name.trim(),
    new_value: { name: name.trim(), email: email.toLowerCase().trim() },
  });

  revalidatePath("/admin");
  revalidatePath("/ranking");

  return { success: true, userId };
}

export async function adminResetPassword(
  userId: string,
  newTempPassword: string
) {
  await requireModerator();

  if (!newTempPassword || newTempPassword.length < 6) {
    throw new Error("Senha temporaria deve ter no minimo 6 caracteres");
  }

  const supabase = createAdminClient();
  const adminClient = createAdminClient();

  // Buscar usuario
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, name, full_name, email")
    .eq("id", userId)
    .single();

  if (userError || !user) {
    throw new Error("Usuario nao encontrado");
  }

  // Resetar senha (requer service_role_key)
  const { error: authError } = await adminClient.auth.admin.updateUserById(
    userId,
    {
      password: newTempPassword,
    }
  );

  if (authError) {
    throw new Error(`Erro ao resetar senha: ${authError.message}`);
  }

  // Registrar log
  await createAdminLog({
    action: "user_password_reset",
    action_description: "Senha resetada",
    target_type: "user",
    target_id: userId,
    target_name: user.full_name || user.name,
  });

  revalidatePath("/admin");

  return { success: true };
}

// ============================================================
// JOGADORES - Apenas Admin
// ============================================================

export async function adminUpdateUserName({
  userId,
  name,
  reason,
}: AdminUpdateUserNameInput): Promise<AdminUpdateUserNameResult> {
  await requireAdminOnly();

  const normalizedName = name.trim();
  const normalizedReason = reason.trim();

  if (!userId) {
    throw new Error("Usuario invalido");
  }

  if (!normalizedName || normalizedName.length < 2) {
    throw new Error("Nome obrigatorio (minimo 2 caracteres)");
  }

  if (!normalizedReason || normalizedReason.length < 5) {
    throw new Error("Motivo obrigatorio (minimo 5 caracteres)");
  }

  const currentAdmin = await getCurrentUser();
  if (!currentAdmin) {
    throw new Error("Usuario administrador nao encontrado");
  }

  if (currentAdmin.id === userId) {
    throw new Error("Voce nao pode alterar seu proprio nome nesta tela");
  }

  const supabase = createAdminClient();

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, name, full_name, email")
    .eq("id", userId)
    .single();

  if (userError || !user) {
    throw new Error("Usuario nao encontrado");
  }

  const oldName = user.full_name || user.name || "Jogador";
  if (oldName === normalizedName) {
    throw new Error("Informe um nome diferente do atual");
  }

  const { error: updateError } = await supabase
    .from("users")
    .update({
      name: normalizedName,
      full_name: normalizedName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (updateError) {
    throw new Error("Erro ao atualizar nome do usuario");
  }

  await createAdminLog({
    action: "user_name_updated",
    action_description: "Nome do jogador alterado",
    target_type: "user",
    target_id: userId,
    target_name: oldName,
    old_value: {
      name: user.name,
      full_name: user.full_name,
      email: user.email,
    },
    new_value: {
      name: normalizedName,
      full_name: normalizedName,
      email: user.email,
    },
    reason: normalizedReason,
  });

  revalidatePath("/admin");
  revalidatePath("/ranking");
  revalidatePath("/perfil");

  return {
    success: true,
    updatedName: normalizedName,
  };
}

export async function adminUpdateUserRating(
  userId: string,
  newRating: number,
  reason: string
) {
  await requireAdminOnly();

  if (!reason || reason.trim().length < 3) {
    throw new Error("Motivo obrigatorio (minimo 3 caracteres)");
  }

  if (newRating < -9999 || newRating > 9999) {
    throw new Error("Rating deve estar entre -9999 e 9999");
  }

  const supabase = createAdminClient();

  // Buscar usuario
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, name, full_name, rating_atual")
    .eq("id", userId)
    .single();

  if (userError || !user) {
    throw new Error("Usuario nao encontrado");
  }

  const oldRating = user.rating_atual;

  // Atualizar rating
  const { error: updateError } = await supabase
    .from("users")
    .update({ rating_atual: newRating })
    .eq("id", userId);

  if (updateError) {
    throw new Error("Erro ao atualizar rating do usuário");
  }

  // Registrar transacao
  await supabase.from("rating_transactions").insert({
    user_id: userId,
    motivo: `ajuste_admin: ${reason.trim()}`,
    valor: newRating - oldRating,
    rating_antes: oldRating,
    rating_depois: newRating,
  });

  // Registrar log
  await createAdminLog({
    action: "user_rating_changed",
    action_description: "Pontos alterados manualmente",
    target_type: "user",
    target_id: userId,
    target_name: user.full_name || user.name,
    old_value: { rating_atual: oldRating },
    new_value: { rating_atual: newRating },
    reason: reason.trim(),
  });

  revalidatePath("/admin");
  revalidatePath("/ranking");

  return { success: true };
}

export async function adminToggleUserStatus(userId: string) {
  await requireAdminOnly();
  const supabase = createAdminClient();

  // Buscar usuario
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, name, full_name, is_active")
    .eq("id", userId)
    .single();

  if (userError || !user) {
    throw new Error("Usuario nao encontrado");
  }

  const newStatus = !user.is_active;

  // Atualizar status
  const { error: updateError } = await supabase
    .from("users")
    .update({ is_active: newStatus })
    .eq("id", userId);

  if (updateError) {
    throw new Error("Erro ao atualizar status do usuário");
  }

  // Registrar log
  await createAdminLog({
    action: newStatus ? "user_activated" : "user_deactivated",
    action_description: newStatus ? "Jogador ativado" : "Jogador desativado",
    target_type: "user",
    target_id: userId,
    target_name: user.full_name || user.name,
    old_value: { is_active: user.is_active },
    new_value: { is_active: newStatus },
  });

  revalidatePath("/admin");
  revalidatePath("/ranking");

  return { success: true, newStatus };
}

export async function adminToggleHideFromRanking(userId: string) {
  await requireAdminOnly();
  const supabase = createAdminClient();

  // Buscar usuario
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, name, full_name, hide_from_ranking")
    .eq("id", userId)
    .single();

  if (userError || !user) {
    throw new Error("Usuario nao encontrado");
  }

  const newStatus = !user.hide_from_ranking;

  // Se está tentando ocultar (newStatus = true), verificar se há partidas pendentes
  if (newStatus === true) {
    const { data: pendingMatches, error: matchesError } = await supabase
      .from("matches")
      .select("id")
      .or(`player_a_id.eq.${userId},player_b_id.eq.${userId}`)
      .in("status", ["pendente", "edited"])
      .limit(1);

    if (matchesError) {
      throw new Error("Erro ao verificar partidas pendentes");
    }

    if (pendingMatches && pendingMatches.length > 0) {
      throw new Error(
        "Nao e possivel ocultar do ranking enquanto houver partidas pendentes. Confirme ou cancele as partidas pendentes primeiro."
      );
    }
  }

  // Atualizar status
  const { error: updateError } = await supabase
    .from("users")
    .update({ hide_from_ranking: newStatus })
    .eq("id", userId);

  if (updateError) {
    throw new Error("Erro ao atualizar visibilidade no ranking");
  }

  // Registrar log
  await createAdminLog({
    action: newStatus ? "user_hidden_from_ranking" : "user_shown_in_ranking",
    action_description: newStatus ? "Jogador oculto do ranking" : "Jogador visível no ranking",
    target_type: "user",
    target_id: userId,
    target_name: user.full_name || user.name,
    old_value: { hide_from_ranking: user.hide_from_ranking },
    new_value: { hide_from_ranking: newStatus },
  });

  revalidatePath("/admin");
  revalidatePath("/ranking");

  return { success: true, newStatus };
}

export async function adminResetUserStats(userId: string) {
  await requireAdminOnly();
  const supabase = createAdminClient();

  // Buscar usuario
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, name, full_name, rating_atual, vitorias, derrotas, jogos_disputados")
    .eq("id", userId)
    .single();

  if (userError || !user) {
    throw new Error("Usuario nao encontrado");
  }

  // Buscar rating inicial
  const { data: ratingConfig } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "rating_inicial")
    .single();

  const ratingInicial = parseInt(ratingConfig?.value || "250", 10);

  // Resetar estatisticas
  const { error: resetError } = await supabase
    .from("users")
    .update({
      rating_atual: ratingInicial,
      vitorias: 0,
      derrotas: 0,
      jogos_disputados: 0,
      streak: 0,
    })
    .eq("id", userId);

  if (resetError) {
    throw new Error("Erro ao resetar estatísticas do usuário");
  }

  // Registrar log
  await createAdminLog({
    action: "user_stats_reset",
    action_description: "Estatisticas resetadas",
    target_type: "user",
    target_id: userId,
    target_name: user.full_name || user.name,
    old_value: {
      rating_atual: user.rating_atual,
      vitorias: user.vitorias,
      derrotas: user.derrotas,
      jogos_disputados: user.jogos_disputados,
    },
    new_value: {
      rating_atual: ratingInicial,
      vitorias: 0,
      derrotas: 0,
      jogos_disputados: 0,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/ranking");

  return { success: true };
}

export async function adminChangeUserRole(
  userId: string,
  newRole: "player" | "moderator" | "admin"
) {
  await requireAdminOnly();
  const supabase = createAdminClient();
  const currentAdmin = await getCurrentUser();

  // Impedir admin de alterar proprio role
  if (currentAdmin?.id === userId) {
    throw new Error("Voce nao pode alterar seu proprio role");
  }

  // Buscar usuario
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, name, full_name, role")
    .eq("id", userId)
    .single();

  if (userError || !user) {
    throw new Error("Usuario nao encontrado");
  }

  const oldRole = user.role;

  // Atualizar role
  const { error: updateError } = await supabase
    .from("users")
    .update({ role: newRole })
    .eq("id", userId);

  if (updateError) {
    throw new Error("Erro ao atualizar role do usuário");
  }

  // Registrar log
  await createAdminLog({
    action: "user_role_changed",
    action_description: `Role alterado de ${oldRole} para ${newRole}`,
    target_type: "user",
    target_id: userId,
    target_name: user.full_name || user.name,
    old_value: { role: oldRole },
    new_value: { role: newRole },
  });

  revalidatePath("/admin");

  return { success: true };
}

// ============================================================
// CONFIGURACOES - Apenas Admin
// ============================================================

export async function adminGetSettings() {
  await requireModerator();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .order("key");

  if (error) throw new Error(error.message);
  return data as AdminSetting[];
}

export async function adminUpdateSetting(key: string, value: string) {
  await requireAdminOnly();
  const supabase = createAdminClient();
  const admin = await getCurrentUser();
  const numericValue = Number.parseInt(value, 10);

  // Buscar configuracao atual
  const { data: oldSetting, error: settingError } = await supabase
    .from("settings")
    .select("*")
    .eq("key", key)
    .single();

  if (settingError || !oldSetting) {
    throw new Error("Configuracao nao encontrada");
  }

  if (!Number.isFinite(numericValue)) {
    throw new Error("Valor da configuracao precisa ser numerico");
  }

  if (key === "k_factor" && (numericValue < 1 || numericValue > 100)) {
    throw new Error("Fator K deve ficar entre 1 e 100");
  }

  if (key === "limite_jogos_diarios" && numericValue < 1) {
    throw new Error("Limite diario deve ser pelo menos 1");
  }

  if (
    key === "pending_confirmation_deadline_hours" &&
    (numericValue < 1 || numericValue > 168)
  ) {
    throw new Error("Prazo da confirmação automática deve ficar entre 1h e 168h");
  }

  // Atualizar configuracao
  const { error: updateError } = await supabase
    .from("settings")
    .update({
      value,
      updated_at: new Date().toISOString(),
      updated_by: admin?.id,
    })
    .eq("key", key);

  if (updateError) {
    throw new Error("Erro ao atualizar configuração");
  }

  if (key === "pending_confirmation_deadline_hours") {
    const previousDeadlineHours = Number.parseInt(oldSetting.value ?? "", 10);

    if (Number.isFinite(previousDeadlineHours)) {
      await shiftOpenPendingConfirmationDeadlines({
        previousDeadlineHours,
        nextDeadlineHours: numericValue,
        supabase,
      });
      await enforcePendingConfirmationSla({ supabase });
    }
  }

  // Registrar log
  await createAdminLog({
    action: "setting_changed",
    action_description: `Configuracao "${oldSetting.description || key}" alterada`,
    target_type: "setting",
    target_name: oldSetting.description || key,
    old_value: { value: oldSetting.value },
    new_value: { value },
  });

  revalidatePath("/admin");

  return { success: true };
}

// ============================================================
// LOGS
// ============================================================

export async function adminGetLogs(page = 0) {
  await requireModerator();
  const supabase = createAdminClient();

  const validPage = validatePage(page);
  const from = validPage * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error } = await supabase
    .from("admin_logs")
    .select(
      `
      *,
      admin:users!admin_id(name, full_name)
    `
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw new Error(error.message);
  return {
    logs: data as AdminLog[],
    hasMore: data && data.length === PAGE_SIZE,
  };
}

export async function adminGetAnalytics(
  month?: string
): Promise<AdminAnalyticsResponse> {
  await requireModerator();

  const supabase = createAdminClient();
  const requestedMonth = normalizeMonthInput(month);
  const todayMonth = getTodayDateKey().slice(0, 7);

  const [firstMatchResponse, firstUserResponse] = await Promise.all([
    supabase
      .from("matches")
      .select("data_partida")
      .order("data_partida", { ascending: true })
      .limit(1),
    supabase
      .from("users")
      .select("created_at")
      .order("created_at", { ascending: true })
      .limit(1),
  ]);

  if (firstMatchResponse.error || firstUserResponse.error) {
    throw new Error("Erro ao definir início do histórico");
  }

  const firstMatchMonth = (firstMatchResponse.data?.[0] as AnalyticsFirstMatchRow | undefined)
    ?.data_partida?.slice(0, 7);
  const firstUserMonth = getMonthKeyFromTimestamp(
    (firstUserResponse.data?.[0] as AnalyticsUserRow | undefined)?.created_at ?? null
  );
  const firstAvailableMonth = [firstMatchMonth, firstUserMonth]
    .filter((value): value is string => !!value)
    .reduce((earliest, value) => getEarlierMonth(earliest, value), requestedMonth);

  const selectedMonth = getLaterMonth(requestedMonth, firstAvailableMonth);
  const previousMonth = shiftMonth(selectedMonth, -1);
  const isCurrentMonth = selectedMonth === todayMonth;
  const isFirstAvailableMonth = selectedMonth === firstAvailableMonth;
  const trendStartMonth = getLaterMonth(shiftMonth(selectedMonth, -5), firstAvailableMonth);
  const trendMonths = getMonthsBetween(trendStartMonth, selectedMonth);
  const selectedRange = getMonthRange(selectedMonth);
  const trendStart = getMonthRange(trendMonths[0]).startDate;
  const monthDays = getDaysInMonth(selectedMonth);

  const [
    matchesResponse,
    usersResponse,
    logsResponse,
    openPendingResponse,
  ] = await Promise.all([
    supabase
      .from("matches")
      .select(
        "id, player_a_id, player_b_id, vencedor_id, status, created_at, updated_at, data_partida"
      )
      .gte("data_partida", trendStart)
      .lte("data_partida", selectedRange.endDate),
    supabase.from("users").select("id, name, full_name, email, created_at, is_active"),
    supabase.from("admin_logs").select("id, action, admin_role, created_at"),
    supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .in("status", ["pendente", "edited"]),
  ]);

  if (matchesResponse.error) {
    throw new Error("Erro ao buscar métricas de partidas");
  }

  if (usersResponse.error) {
    throw new Error("Erro ao buscar métricas de usuários");
  }

  if (logsResponse.error) {
    throw new Error("Erro ao buscar métricas administrativas");
  }

  if (openPendingResponse.error) {
    throw new Error("Erro ao buscar pendências abertas");
  }

  const matches = (matchesResponse.data ?? []) as AnalyticsMatchRow[];
  const users = (usersResponse.data ?? []) as AnalyticsUserRow[];
  const logRows = (logsResponse.data ?? []) as AnalyticsLogRow[];
  const activeAccounts = users.filter((user) => user.is_active !== false).length;
  const userNames = new Map(users.map((user) => [user.id, getUserDisplayName(user)]));

  const monthMatches = matches.filter((match) => match.data_partida.startsWith(selectedMonth));
  const previousMonthMatches = matches.filter((match) =>
    match.data_partida.startsWith(previousMonth)
  );
  const activityMatches = monthMatches.filter((match) => match.status !== "cancelado");
  const previousActivityMatches = previousMonthMatches.filter(
    (match) => match.status !== "cancelado"
  );
  const validatedMatches = monthMatches.filter((match) => match.status === "validado");
  const monthRangeStartAt = getDateAtTimezoneBoundary(
    selectedRange.startDate,
    BUSINESS_TIMEZONE,
    "start"
  );
  const monthRangeEndAt = isCurrentMonth
    ? new Date()
    : getDateAtTimezoneBoundary(selectedRange.endDate, BUSINESS_TIMEZONE, "end");
  const recentDayWindow = monthDays.slice(-7);
  const last7DaysStartDate = recentDayWindow[0] ?? monthDays[0] ?? selectedRange.startDate;
  const last7DaysEndDate =
    recentDayWindow[recentDayWindow.length - 1] ??
    monthDays[monthDays.length - 1] ??
    selectedRange.startDate;
  const recentActivityMatches = activityMatches.filter(
    (match) =>
      match.data_partida >= last7DaysStartDate && match.data_partida <= last7DaysEndDate
  );

  const selectedPlayerIds = new Set<string>();
  const previousPlayerIds = new Set<string>();

  for (const match of activityMatches) {
    selectedPlayerIds.add(match.player_a_id);
    selectedPlayerIds.add(match.player_b_id);
  }

  for (const match of previousActivityMatches) {
    previousPlayerIds.add(match.player_a_id);
    previousPlayerIds.add(match.player_b_id);
  }

  const trendAccumulator = new Map<
    string,
    {
      registrations: number;
      validated: number;
      activePlayerIds: Set<string>;
      newUsers: number;
    }
  >();

  for (const trendMonth of trendMonths) {
    trendAccumulator.set(trendMonth, {
      registrations: 0,
      validated: 0,
      activePlayerIds: new Set<string>(),
      newUsers: 0,
    });
  }

  for (const match of matches) {
    const monthKey = match.data_partida.slice(0, 7);
    const entry = trendAccumulator.get(monthKey);

    if (!entry) continue;

    entry.registrations += 1;

    if (match.status === "validado") {
      entry.validated += 1;
    }

    if (match.status !== "cancelado") {
      entry.activePlayerIds.add(match.player_a_id);
      entry.activePlayerIds.add(match.player_b_id);
    }
  }

  for (const user of users) {
    const monthKey = getMonthKeyFromTimestamp(user.created_at);
    if (!monthKey) continue;

    const entry = trendAccumulator.get(monthKey);
    if (!entry) continue;

    entry.newUsers += 1;
  }

  const trend = trendMonths.map((trendMonth) => {
    const entry = trendAccumulator.get(trendMonth);

    return {
      month: trendMonth,
      label: formatMonthLabel(trendMonth),
      registrations: entry?.registrations ?? 0,
      validated: entry?.validated ?? 0,
      activePlayers: entry?.activePlayerIds.size ?? 0,
      newUsers: entry?.newUsers ?? 0,
    };
  });

  const dayAccumulator = new Map<
    string,
    {
      registrations: number;
      validated: number;
      pending: number;
      edited: number;
      canceled: number;
      playerIds: Set<string>;
    }
  >();

  for (const dateKey of monthDays) {
    dayAccumulator.set(dateKey, {
      registrations: 0,
      validated: 0,
      pending: 0,
      edited: 0,
      canceled: 0,
      playerIds: new Set<string>(),
    });
  }

  const weekdayAccumulator = new Map<
    AdminAnalyticsWeekday["key"],
    {
      registrations: number;
      validated: number;
      pending: number;
      edited: number;
      canceled: number;
      playerIds: Set<string>;
    }
  >();

  for (const weekday of WEEKDAY_METADATA) {
    weekdayAccumulator.set(weekday.key, {
      registrations: 0,
      validated: 0,
      pending: 0,
      edited: 0,
      canceled: 0,
      playerIds: new Set<string>(),
    });
  }

  for (const match of monthMatches) {
    const dayEntry = dayAccumulator.get(match.data_partida);
    const weekdayNumber = getUtcWeekday(match.data_partida);
    const weekdayMeta = WEEKDAY_METADATA.find((weekday) => weekday.day === weekdayNumber);
    const weekdayEntry = weekdayMeta ? weekdayAccumulator.get(weekdayMeta.key) : null;

    if (dayEntry) {
      dayEntry.registrations += 1;

      if (match.status === "validado") {
        dayEntry.validated += 1;
      } else if (match.status === "pendente") {
        dayEntry.pending += 1;
      } else if (match.status === "edited") {
        dayEntry.edited += 1;
      } else if (match.status === "cancelado") {
        dayEntry.canceled += 1;
      }

      if (match.status !== "cancelado") {
        dayEntry.playerIds.add(match.player_a_id);
        dayEntry.playerIds.add(match.player_b_id);
      }
    }

    if (weekdayEntry) {
      weekdayEntry.registrations += 1;

      if (match.status === "validado") {
        weekdayEntry.validated += 1;
      } else if (match.status === "pendente") {
        weekdayEntry.pending += 1;
      } else if (match.status === "edited") {
        weekdayEntry.edited += 1;
      } else if (match.status === "cancelado") {
        weekdayEntry.canceled += 1;
      }

      if (match.status !== "cancelado") {
        weekdayEntry.playerIds.add(match.player_a_id);
        weekdayEntry.playerIds.add(match.player_b_id);
      }
    }
  }

  const dayStats = monthDays.map((dateKey) => {
    const entry = dayAccumulator.get(dateKey);
    const weekdayMeta = WEEKDAY_METADATA.find((weekday) => weekday.day === getUtcWeekday(dateKey));

    return {
      date: dateKey,
      label: formatDayLabel(dateKey),
      weekday: weekdayMeta?.shortLabel || "",
      registrations: entry?.registrations ?? 0,
      validated: entry?.validated ?? 0,
      pending: entry?.pending ?? 0,
      edited: entry?.edited ?? 0,
      canceled: entry?.canceled ?? 0,
      uniquePlayers: entry?.playerIds.size ?? 0,
    };
  });

  const weekdayStats = WEEKDAY_METADATA.map((weekday) => {
    const entry = weekdayAccumulator.get(weekday.key);

    return {
      key: weekday.key,
      label: weekday.label,
      shortLabel: weekday.shortLabel,
      registrations: entry?.registrations ?? 0,
      validated: entry?.validated ?? 0,
      pending: entry?.pending ?? 0,
      edited: entry?.edited ?? 0,
      canceled: entry?.canceled ?? 0,
      uniquePlayers: entry?.playerIds.size ?? 0,
    };
  });

  const topPlayersMonth = buildAnalyticsTopPlayers(activityMatches, userNames);
  const topPlayersLast7Days = buildAnalyticsTopPlayers(recentActivityMatches, userNames);

  const rivalryAccumulator = new Map<
    string,
    { playerAId: string; playerBId: string; registrations: number; validated: number }
  >();

  for (const match of activityMatches) {
    const [playerAId, playerBId] = [match.player_a_id, match.player_b_id].sort();
    const key = `${playerAId}:${playerBId}`;
    const rivalry = rivalryAccumulator.get(key) ?? {
      playerAId,
      playerBId,
      registrations: 0,
      validated: 0,
    };

    rivalry.registrations += 1;

    if (match.status === "validado") {
      rivalry.validated += 1;
    }

    rivalryAccumulator.set(key, rivalry);
  }

  const topRivalries = Array.from(rivalryAccumulator.entries())
    .map(([id, rivalry]) => ({
      id,
      playersLabel: `${userNames.get(rivalry.playerAId) || "Jogador"} x ${
        userNames.get(rivalry.playerBId) || "Jogador"
      }`,
      registrations: rivalry.registrations,
      validated: rivalry.validated,
    }))
    .sort((left, right) => {
      if (right.registrations !== left.registrations) {
        return right.registrations - left.registrations;
      }

      if (right.validated !== left.validated) {
        return right.validated - left.validated;
      }

      return left.playersLabel.localeCompare(right.playersLabel, "pt-BR");
    })
    .slice(0, 5);

  const statusCounts: Record<AdminAnalyticsStatus["key"], number> = {
    pendente: 0,
    edited: 0,
    validado: 0,
    cancelado: 0,
  };

  for (const match of monthMatches) {
    if (match.status in statusCounts) {
      statusCounts[match.status as AdminAnalyticsStatus["key"]] += 1;
    }
  }

  const statusMetadata: Array<Pick<AdminAnalyticsStatus, "key" | "label">> = [
    { key: "pendente", label: "Pendentes" },
    { key: "edited", label: "Contestadas" },
    { key: "validado", label: "Validadas" },
    { key: "cancelado", label: "Canceladas" },
  ];

  const statusBreakdown: AdminAnalyticsStatus[] = statusMetadata.map((status) => ({
    ...status,
    count: statusCounts[status.key],
    percentage: getPercentage(statusCounts[status.key], monthMatches.length),
  }));

  const newUsers = users.filter(
    (user) => getMonthKeyFromTimestamp(user.created_at) === selectedMonth
  ).length;
  const previousNewUsers = users.filter(
    (user) => getMonthKeyFromTimestamp(user.created_at) === previousMonth
  ).length;
  const monthAdminLogs = logRows.filter(
    (row) =>
      getMonthKeyFromTimestamp(row.created_at) === selectedMonth &&
      row.admin_role !== "system"
  );
  const adminActions = monthAdminLogs.length;
  const adminActionAccumulator = new Map<string, AdminAnalyticsActionBreakdown>();
  for (const row of monthAdminLogs) {
    const metadata = row.action ? ADMIN_ACTION_METADATA[row.action] : null;
    const breakdownKey = metadata?.key ?? "other_admin_actions";
    const breakdownLabel = metadata?.label ?? "Outras ações";
    const breakdownDescription =
      metadata?.description ?? "Outras intervenções administrativas registradas no período.";
    const current = adminActionAccumulator.get(breakdownKey) ?? {
      key: breakdownKey,
      label: breakdownLabel,
      description: breakdownDescription,
      count: 0,
    };

    current.count += 1;
    adminActionAccumulator.set(breakdownKey, current);
  }
  const adminActionBreakdown = Array.from(adminActionAccumulator.values()).sort(
    (left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.label.localeCompare(right.label, "pt-BR");
    }
  );
  const dayRegistrations = dayStats.reduce((total, day) => total + day.registrations, 0);
  const latestMonthRegistration = [...monthMatches].sort((left, right) =>
    right.created_at.localeCompare(left.created_at)
  )[0];
  const hoursSinceLastRegistration = latestMonthRegistration
    ? getHoursBetween(new Date(latestMonthRegistration.created_at), new Date())
    : getHoursBetween(monthRangeStartAt, new Date());
  const longestGapWithoutRegistrations = getLongestGapWithoutRegistrations(
    monthMatches.map((match) => match.created_at),
    monthRangeStartAt,
    monthRangeEndAt
  );

  const summary: AdminAnalyticsSummary = {
    registrations: monthMatches.length,
    registrationsDelta: monthMatches.length - previousMonthMatches.length,
    validated: validatedMatches.length,
    validationRate: getPercentage(validatedMatches.length, monthMatches.length),
    activePlayers: selectedPlayerIds.size,
    activePlayersDelta: selectedPlayerIds.size - previousPlayerIds.size,
    activeAccounts,
    participationRate: getPercentage(selectedPlayerIds.size, activeAccounts),
    averagePerDay:
      monthDays.length > 0
        ? roundToOneDecimal(dayRegistrations / monthDays.length)
        : 0,
    hoursSinceLastRegistration,
    longestGapWithoutRegistrations,
    newUsers,
    newUsersDelta: newUsers - previousNewUsers,
    openPending: openPendingResponse.count ?? 0,
    adminActions,
  };

  const busiestDay = [...dayStats].sort((left, right) => {
    if (right.registrations !== left.registrations) {
      return right.registrations - left.registrations;
    }

    return right.validated - left.validated;
  })[0];

  const insights = [
    busiestDay && busiestDay.registrations > 0
      ? `${busiestDay.label} foi o dia com mais registros no período, com ${busiestDay.registrations} registro(s).`
      : `Ainda não houve registros em ${formatMonthLabel(selectedMonth)}.`,
    summary.participationRate > 0
      ? `${summary.participationRate}% da base ativa participou de pelo menos uma partida no mês.`
      : `Nenhum jogador ativo apareceu em partidas neste mês.`,
    summary.openPending > 0
      ? `${summary.openPending} pendência(s) abertas pedem acompanhamento do admin.`
      : `Não há pendências abertas agora, sinal de operação em dia.`,
    statusCounts.edited > 0
      ? `${statusCounts.edited} partida(s) contestada(s) passaram por revisão no período.`
      : `Não houve partidas contestadas no período.`,
    `${summary.longestGapWithoutRegistrations} h foi o maior intervalo sem registros no período.`,
  ].slice(0, 4);

  return {
    selectedMonth,
    selectedMonthLabel: formatMonthLabel(selectedMonth),
    previousMonthLabel: formatMonthLabel(previousMonth),
    firstAvailableMonth,
    firstAvailableMonthLabel: formatMonthLabel(firstAvailableMonth),
    isFirstAvailableMonth,
    isCurrentMonth,
    last7DaysRangeLabel: formatDateRangeLabel(last7DaysStartDate, last7DaysEndDate),
    summary,
    weekdayStats,
    dayStats,
    trend,
    topPlayersMonth,
    topPlayersLast7Days,
    topRivalries,
    statusBreakdown,
    adminActionBreakdown,
    insights,
  };
}

export async function adminGetPendingMatches(): Promise<AdminPendingMatchesResponse> {
  await requireModerator();

  const supabase = createAdminClient();
  const deadlineHours = await getPendingConfirmationDeadlineHours(supabase);
  await enforcePendingConfirmationSla({ supabase });
  const { data, error } = await supabase
    .from("matches")
    .select(
      `
      id,
      player_a_id,
      player_b_id,
      criado_por,
      resultado_a,
      resultado_b,
      status,
      created_at,
      data_partida,
      player_a:users!player_a_id(id, name, full_name, email),
      player_b:users!player_b_id(id, name, full_name, email),
      creator:users!criado_por(id, name, full_name, email)
    `
    )
    .in("status", ["pendente", "edited"])
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error("Erro ao carregar pendencias");
  }

  const pendingRows = (data ?? []) as AnalyticsPendingMatchRow[];
  if (pendingRows.length === 0) {
    return {
      deadlineHours,
      openCount: 0,
      pendingCount: 0,
      editedCount: 0,
      items: [],
    };
  }

  const oldestCreatedAt = pendingRows[0]?.created_at;
  const { data: notificationRows, error: notificationsError } = await supabase
    .from("notifications")
    .select("created_at, payload")
    .eq("tipo", "confirmacao")
    .gte("created_at", oldestCreatedAt)
    .order("created_at", { ascending: true });

  if (notificationsError) {
    throw new Error("Erro ao carregar o histórico das pendências");
  }

  const timelineByMatchId = buildPendingTimelineByMatchId(
    pendingRows,
    (notificationRows ?? []) as AnalyticsNotificationRow[]
  );
  const items = mapPendingMatchRows(
    pendingRows,
    timelineByMatchId,
    new Map<string, AnalyticsPendingConfirmationStateRow>(),
    deadlineHours
  );

  return {
    deadlineHours,
    openCount: items.length,
    pendingCount: items.filter((item) => item.status === "pendente").length,
    editedCount: items.filter((item) => item.status === "edited").length,
    items,
  };
}
