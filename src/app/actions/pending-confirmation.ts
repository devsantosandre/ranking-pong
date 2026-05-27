"use server";

import { after } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import type { PendingNotificationPayloadV1 } from "@/lib/types/notifications";
import {
  enforcePendingConfirmationSla,
  getOpenPendingConfirmationSnapshots,
} from "@/lib/matches/confirmation-sla";

const RECENT_MATCHES_PAGE_SIZE = 20;

type RankingVisibleUser = {
  id: string;
  name: string | null;
  full_name: string | null;
  email: string | null;
  rating_atual: number | null;
  jogos_disputados: number | null;
};

type HighlightMatchRow = {
  player_a_id: string;
  player_b_id: string;
  vencedor_id: string | null;
  created_at: string;
};

type WeeklyHighlightMatchRow = Pick<HighlightMatchRow, "player_a_id" | "player_b_id">;

type PendingUserRelation =
  | {
      id: string | null;
      name: string | null;
      full_name: string | null;
      email: string | null;
    }
  | Array<{
      id: string | null;
      name: string | null;
      full_name: string | null;
      email: string | null;
    }>
  | null;

type CurrentUserPendingMatchRow = {
  id: string;
  player_a_id: string;
  player_b_id: string;
  vencedor_id: string | null;
  resultado_a: number;
  resultado_b: number;
  status: string;
  criado_por: string;
  aprovado_por: string | null;
  created_at: string;
  pontos_variacao_a: number | null;
  pontos_variacao_b: number | null;
  player_a: PendingUserRelation;
  player_b: PendingUserRelation;
};

type CurrentUserRecentMatchRow = CurrentUserPendingMatchRow;

type RecentNotificationRow = {
  created_at: string;
  payload: unknown;
};

type RecentAdminLogRow = {
  target_id: string | null;
  action: string | null;
  admin_role: string | null;
  created_at: string | null;
};

export type CurrentUserPendingMatch = {
  id: string;
  player_a_id: string;
  player_b_id: string;
  vencedor_id: string | null;
  resultado_a: number;
  resultado_b: number;
  status: string;
  criado_por: string;
  aprovado_por: string | null;
  created_at: string;
  pontos_variacao_a: number | null;
  pontos_variacao_b: number | null;
  confirmation_deadline_at: string | null;
  pending_kind: "score" | "nonexistent";
  pending_context: "default" | "nonexistent_rejected";
  pending_context_actor_id: string | null;
  player_a: {
    id: string;
    name: string | null;
    full_name: string | null;
    email: string | null;
  };
  player_b: {
    id: string;
    name: string | null;
    full_name: string | null;
    email: string | null;
  };
};

export type MatchCancellationReason = "nonexistent" | null;
export type MatchCancellationActor = "system" | "player" | "admin" | null;

export type CurrentUserRecentMatch = {
  id: string;
  player_a_id: string;
  player_b_id: string;
  vencedor_id: string | null;
  resultado_a: number;
  resultado_b: number;
  status: string;
  criado_por: string;
  aprovado_por: string | null;
  created_at: string;
  pontos_variacao_a: number | null;
  pontos_variacao_b: number | null;
  cancellation_reason: MatchCancellationReason;
  cancellation_actor: MatchCancellationActor;
  cancellation_actor_name: string | null;
  cancellation_resolved_at: string | null;
  player_a: {
    id: string;
    name: string | null;
    full_name: string | null;
    email: string | null;
  };
  player_b: {
    id: string;
    name: string | null;
    full_name: string | null;
    email: string | null;
  };
};

export type CurrentUserRecentMatchesPage = {
  matches: CurrentUserRecentMatch[];
  nextPage: number | undefined;
};

export type CurrentUserMatchCounts = {
  pendentes: number;
  recentes: number;
};

export type HomeStreakHighlightResult = {
  userId: string;
  userName: string;
  streak: number;
};

export type HomeWeeklyActivityHighlightResult = {
  userId: string;
  userName: string;
  matches: number;
  uniqueOpponents: number;
};

export type HomeHighlightsActionResult = {
  streakLeader: HomeStreakHighlightResult | null;
  weeklyActivityLeader: HomeWeeklyActivityHighlightResult | null;
};

export type CurrentUserPendingConfirmationStatus = {
  pendingActionsCount: number;
  nextDeadlineAt: string | null;
  deadlineHours: number;
};

function getDisplayName(user: {
  full_name: string | null;
  name: string | null;
  email: string | null;
}) {
  return user.full_name || user.name || user.email?.split("@")[0] || "Jogador";
}

function normalizePendingUserRelation(
  relation: PendingUserRelation,
  fallbackId: string
) {
  const normalized = Array.isArray(relation) ? (relation[0] ?? null) : relation;

  return {
    id: normalized?.id || fallbackId,
    name: normalized?.name ?? null,
    full_name: normalized?.full_name ?? null,
    email: normalized?.email ?? null,
  };
}

function parseRecentPendingNotificationPayload(
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

async function getCancellationInfoByMatchId(
  supabase: ReturnType<typeof createAdminClient>,
  canceledMatchIds: string[]
) {
  const cancellationInfoByMatchId = new Map<
    string,
    {
      reason: MatchCancellationReason;
      actor: MatchCancellationActor;
      actorName: string | null;
      resolvedAt: string | null;
    }
  >();

  if (canceledMatchIds.length === 0) {
    return cancellationInfoByMatchId;
  }

  const [notificationsResult, adminLogsResult] = await Promise.all([
    supabase
      .from("notifications")
      .select("created_at, payload")
      .eq("tipo", "confirmacao")
      .in("payload->>match_id", canceledMatchIds)
      .order("created_at", { ascending: true })
      .returns<RecentNotificationRow[]>(),
    supabase
      .from("admin_logs")
      .select("target_id, action, admin_role, created_at")
      .eq("target_type", "match")
      .in("target_id", canceledMatchIds)
      .in("action", ["match_auto_cancelled_nonexistent"])
      .order("created_at", { ascending: true })
      .returns<RecentAdminLogRow[]>(),
  ]);

  if (notificationsResult.error) {
    throw new Error("Erro ao carregar histórico de cancelamento");
  }

  if (adminLogsResult.error) {
    throw new Error("Erro ao carregar logs de cancelamento");
  }

  const latestPendingKindByMatchId = new Map<string, "score" | "nonexistent">();
  const latestCancelledResolutionByMatchId = new Map<
    string,
    {
      actor: MatchCancellationActor;
      actorName: string | null;
      resolvedAt: string;
    }
  >();

  for (const row of notificationsResult.data ?? []) {
    const payload = parseRecentPendingNotificationPayload(row.payload);
    if (!payload || !canceledMatchIds.includes(payload.match_id)) {
      continue;
    }

    if (
      payload.event === "pending_created" ||
      payload.event === "pending_transferred" ||
      payload.event === "nonexistent_claimed" ||
      payload.event === "nonexistent_rejected"
    ) {
      latestPendingKindByMatchId.set(
        payload.match_id,
        payload.event === "nonexistent_claimed" ? "nonexistent" : "score"
      );
      continue;
    }

    if (payload.event === "pending_resolved" && payload.status === "cancelado") {
      latestCancelledResolutionByMatchId.set(payload.match_id, {
        actor: payload.actor_id === "system" ? "system" : "player",
        actorName: payload.actor_name,
        resolvedAt: row.created_at,
      });

      if (latestPendingKindByMatchId.get(payload.match_id) === "nonexistent") {
        cancellationInfoByMatchId.set(payload.match_id, {
          reason: "nonexistent",
          actor: payload.actor_id === "system" ? "system" : "player",
          actorName: payload.actor_name,
          resolvedAt: row.created_at,
        });
      }
    }
  }

  for (const log of adminLogsResult.data ?? []) {
    if (log.action !== "match_auto_cancelled_nonexistent" || !log.target_id) {
      continue;
    }

    const resolved = latestCancelledResolutionByMatchId.get(log.target_id);
    cancellationInfoByMatchId.set(log.target_id, {
      reason: "nonexistent",
      actor: log.admin_role === "system" ? "system" : "admin",
      actorName: resolved?.actorName ?? "Cancelamento automático",
      resolvedAt: resolved?.resolvedAt ?? log.created_at,
    });
  }

  return cancellationInfoByMatchId;
}

export async function getCurrentUserPendingConfirmationStatusAction(): Promise<CurrentUserPendingConfirmationStatus> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      pendingActionsCount: 0,
      nextDeadlineAt: null,
      deadlineHours: 6,
    };
  }

  const adminSupabase = createAdminClient();

  // SLA enforcement em background — não bloqueia a resposta de status
  after(async () => {
    try {
      await enforcePendingConfirmationSla({ supabase: createAdminClient() });
    } catch (e) {
      console.error("[after/getPendingConfirmationStatus/sla]", e);
    }
  });

  // deadlineHours vem de getOpenPendingConfirmationSnapshots (evita chamada dupla)
  const [pendingCountResult, pendingSnapshotsResult] = await Promise.all([
    adminSupabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .in("status", ["pendente", "edited"])
      .or(`player_a_id.eq.${user.id},player_b_id.eq.${user.id}`)
      .neq("criado_por", user.id),
    getOpenPendingConfirmationSnapshots({
      responsibleUserId: user.id,
      supabase: adminSupabase,
    }),
  ]);

  if (pendingCountResult.error) {
    throw new Error("Erro ao verificar pendências do jogador");
  }

  const { deadlineHours, items: snapshots } = pendingSnapshotsResult;
  const nextDeadlineAt =
    snapshots
      .map((item) => item.currentDeadlineAt)
      .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0] ??
    null;

  return {
    pendingActionsCount: pendingCountResult.count ?? 0,
    nextDeadlineAt,
    deadlineHours,
  };
}

export async function getCurrentUserPendingMatchesAction(): Promise<
  CurrentUserPendingMatch[]
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const adminSupabase = createAdminClient();

  // SLA em background — não bloqueia carregamento das partidas pendentes
  after(async () => {
    try {
      await enforcePendingConfirmationSla({ supabase: createAdminClient() });
    } catch (e) {
      console.error("[after/getPendingMatches/sla]", e);
    }
  });

  const [{ items: snapshots }, matchesResult] = await Promise.all([
    getOpenPendingConfirmationSnapshots({ supabase: adminSupabase }),
    adminSupabase
      .from("matches")
      .select(
        `
        id,
        player_a_id,
        player_b_id,
        vencedor_id,
        resultado_a,
        resultado_b,
        status,
        criado_por,
        aprovado_por,
        created_at,
        pontos_variacao_a,
        pontos_variacao_b,
        player_a:users!player_a_id(id, name, full_name, email),
        player_b:users!player_b_id(id, name, full_name, email)
      `
      )
      .or(`player_a_id.eq.${user.id},player_b_id.eq.${user.id}`)
      .in("status", ["pendente", "edited"])
      .order("created_at", { ascending: false }),
  ]);

  if (matchesResult.error) {
    throw new Error("Erro ao carregar partidas pendentes");
  }

  const deadlineByMatchId = new Map(
    snapshots.map((snapshot) => [snapshot.matchId, snapshot.currentDeadlineAt])
  );
  const pendingKindByMatchId = new Map(
    snapshots.map((snapshot) => [snapshot.matchId, snapshot.pendingKind])
  );
  const pendingContextByMatchId = new Map(
    snapshots.map((snapshot) => [snapshot.matchId, snapshot.pendingContext])
  );
  const pendingContextActorByMatchId = new Map(
    snapshots.map((snapshot) => [snapshot.matchId, snapshot.pendingContextActorId])
  );

  return ((matchesResult.data ?? []) as CurrentUserPendingMatchRow[]).map((match) => ({
    id: match.id,
    player_a_id: match.player_a_id,
    player_b_id: match.player_b_id,
    vencedor_id: match.vencedor_id,
    resultado_a: match.resultado_a,
    resultado_b: match.resultado_b,
    status: match.status,
    criado_por: match.criado_por,
    aprovado_por: match.aprovado_por,
    created_at: match.created_at,
    pontos_variacao_a: match.pontos_variacao_a,
    pontos_variacao_b: match.pontos_variacao_b,
    confirmation_deadline_at: deadlineByMatchId.get(match.id) ?? null,
    pending_kind: pendingKindByMatchId.get(match.id) ?? "score",
    pending_context: pendingContextByMatchId.get(match.id) ?? "default",
    pending_context_actor_id: pendingContextActorByMatchId.get(match.id) ?? null,
    player_a: normalizePendingUserRelation(match.player_a, match.player_a_id),
    player_b: normalizePendingUserRelation(match.player_b, match.player_b_id),
  }));
}

export async function getCurrentUserRecentMatchesAction(
  page = 0
): Promise<CurrentUserRecentMatchesPage> {
  const safePage = Number.isFinite(page) && page > 0 ? Math.trunc(page) : 0;
  const from = safePage * RECENT_MATCHES_PAGE_SIZE;
  const to = from + RECENT_MATCHES_PAGE_SIZE - 1;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      matches: [],
      nextPage: undefined,
    };
  }

  const adminSupabase = createAdminClient();

  // SLA em background — não bloqueia carregamento do histórico
  after(async () => {
    try {
      await enforcePendingConfirmationSla({ supabase: createAdminClient() });
    } catch (e) {
      console.error("[after/getRecentMatches/sla]", e);
    }
  });

  const { data, error } = await adminSupabase
    .from("matches")
    .select(
      `
      id,
      player_a_id,
      player_b_id,
      vencedor_id,
      resultado_a,
      resultado_b,
      status,
      criado_por,
      aprovado_por,
      created_at,
      pontos_variacao_a,
      pontos_variacao_b,
      player_a:users!player_a_id(id, name, full_name, email),
      player_b:users!player_b_id(id, name, full_name, email)
    `
    )
    .or(`player_a_id.eq.${user.id},player_b_id.eq.${user.id}`)
    .in("status", ["validado", "cancelado"])
    .order("created_at", { ascending: false })
    .range(from, to)
    .returns<CurrentUserRecentMatchRow[]>();

  if (error) {
    throw new Error("Erro ao carregar partidas recentes");
  }

  const rows = data ?? [];
  const canceledMatchIds = rows
    .filter((match) => match.status === "cancelado")
    .map((match) => match.id);
  const cancellationInfoByMatchId = await getCancellationInfoByMatchId(
    adminSupabase,
    canceledMatchIds
  );

  return {
    matches: rows.map((match) => {
      const cancellationInfo = cancellationInfoByMatchId.get(match.id);

      return {
        id: match.id,
        player_a_id: match.player_a_id,
        player_b_id: match.player_b_id,
        vencedor_id: match.vencedor_id,
        resultado_a: match.resultado_a,
        resultado_b: match.resultado_b,
        status: match.status,
        criado_por: match.criado_por,
        aprovado_por: match.aprovado_por,
        created_at: match.created_at,
        pontos_variacao_a: match.pontos_variacao_a,
        pontos_variacao_b: match.pontos_variacao_b,
        cancellation_reason: cancellationInfo?.reason ?? null,
        cancellation_actor: cancellationInfo?.actor ?? null,
        cancellation_actor_name: cancellationInfo?.actorName ?? null,
        cancellation_resolved_at: cancellationInfo?.resolvedAt ?? null,
        player_a: normalizePendingUserRelation(match.player_a, match.player_a_id),
        player_b: normalizePendingUserRelation(match.player_b, match.player_b_id),
      };
    }),
    nextPage: rows.length === RECENT_MATCHES_PAGE_SIZE ? safePage + 1 : undefined,
  };
}

export async function getCurrentUserMatchCountsAction(): Promise<CurrentUserMatchCounts> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      pendentes: 0,
      recentes: 0,
    };
  }

  const adminSupabase = createAdminClient();

  // SLA em background — não bloqueia contadores
  after(async () => {
    try {
      await enforcePendingConfirmationSla({ supabase: createAdminClient() });
    } catch (e) {
      console.error("[after/getMatchCounts/sla]", e);
    }
  });

  const baseFilter = `player_a_id.eq.${user.id},player_b_id.eq.${user.id}`;
  const [pendingResult, recentResult] = await Promise.all([
    adminSupabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .or(baseFilter)
      .in("status", ["pendente", "edited"]),
    adminSupabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .or(baseFilter)
      .in("status", ["validado", "cancelado"]),
  ]);

  if (pendingResult.error || recentResult.error) {
    throw new Error("Erro ao carregar contadores de partidas");
  }

  return {
    pendentes: pendingResult.count ?? 0,
    recentes: recentResult.count ?? 0,
  };
}

export async function getHomeHighlightsAction(): Promise<HomeHighlightsActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      streakLeader: null,
      weeklyActivityLeader: null,
    };
  }

  const adminSupabase = createAdminClient();

  // SLA em background — não bloqueia carregamento dos highlights
  after(async () => {
    try {
      await enforcePendingConfirmationSla({ supabase: createAdminClient() });
    } catch (e) {
      console.error("[after/getHomeHighlights/sla]", e);
    }
  });

  const weekAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [usersResult, validatedMatchesResult, weeklyMatchesResult] = await Promise.all([
    adminSupabase
      .from("users")
      .select("id, name, full_name, email, rating_atual, jogos_disputados")
      .eq("is_active", true)
      .eq("hide_from_ranking", false)
      .gt("jogos_disputados", 0),
    adminSupabase
      .from("matches")
      .select("player_a_id, player_b_id, vencedor_id, created_at")
      .eq("status", "validado")
      .order("created_at", { ascending: false })
      .limit(2000),
    adminSupabase
      .from("matches")
      .select("player_a_id, player_b_id")
      .eq("status", "validado")
      .gte("created_at", weekAgoIso),
  ]);

  if (usersResult.error) throw usersResult.error;
  if (validatedMatchesResult.error) throw validatedMatchesResult.error;
  if (weeklyMatchesResult.error) throw weeklyMatchesResult.error;

  const users = (usersResult.data ?? []) as RankingVisibleUser[];
  const validatedMatches = (validatedMatchesResult.data ?? []) as HighlightMatchRow[];
  const weeklyMatches = (weeklyMatchesResult.data ?? []) as WeeklyHighlightMatchRow[];

  if (users.length === 0) {
    return {
      streakLeader: null,
      weeklyActivityLeader: null,
    };
  }

  const usersById = new Map<string, RankingVisibleUser>(users.map((entry) => [entry.id, entry]));
  const eligibleUserIds = new Set(users.map((entry) => entry.id));

  const streakState = new Map<string, { streak: number; finished: boolean }>();
  users.forEach((entry) => {
    streakState.set(entry.id, { streak: 0, finished: false });
  });

  for (const match of validatedMatches) {
    if (!match.vencedor_id) continue;

    const participants = [
      {
        userId: match.player_a_id,
        won: match.vencedor_id === match.player_a_id,
      },
      {
        userId: match.player_b_id,
        won: match.vencedor_id === match.player_b_id,
      },
    ];

    for (const participant of participants) {
      if (!eligibleUserIds.has(participant.userId)) continue;

      const state = streakState.get(participant.userId);
      if (!state || state.finished) continue;

      if (participant.won) {
        state.streak += 1;
      } else {
        state.finished = true;
      }
    }
  }

  let streakLeader: HomeStreakHighlightResult | null = null;

  for (const [userId, state] of streakState.entries()) {
    if (state.streak <= 0 || !eligibleUserIds.has(userId)) continue;

    const player = usersById.get(userId);
    if (!player) continue;

    if (!streakLeader) {
      streakLeader = {
        userId,
        userName: getDisplayName(player),
        streak: state.streak,
      };
      continue;
    }

    const leaderUser = usersById.get(streakLeader.userId);
    const candidateRating = player.rating_atual ?? 0;
    const leaderRating = leaderUser?.rating_atual ?? 0;
    const candidateName = getDisplayName(player);

    if (
      state.streak > streakLeader.streak ||
      (state.streak === streakLeader.streak && candidateRating > leaderRating) ||
      (state.streak === streakLeader.streak &&
        candidateRating === leaderRating &&
        candidateName.localeCompare(streakLeader.userName, "pt-BR") < 0)
    ) {
      streakLeader = {
        userId,
        userName: candidateName,
        streak: state.streak,
      };
    }
  }

  const weeklyState = new Map<string, { matches: number; opponents: Set<string> }>();

  for (const match of weeklyMatches) {
    const sides = [
      { userId: match.player_a_id, opponentId: match.player_b_id },
      { userId: match.player_b_id, opponentId: match.player_a_id },
    ];

    for (const side of sides) {
      if (!eligibleUserIds.has(side.userId)) continue;

      const current =
        weeklyState.get(side.userId) ?? { matches: 0, opponents: new Set<string>() };
      current.matches += 1;
      current.opponents.add(side.opponentId);
      weeklyState.set(side.userId, current);
    }
  }

  let weeklyActivityLeader: HomeWeeklyActivityHighlightResult | null = null;

  for (const [userId, state] of weeklyState.entries()) {
    if (state.matches <= 0 || !eligibleUserIds.has(userId)) continue;

    const player = usersById.get(userId);
    if (!player) continue;

    const candidate = {
      userId,
      userName: getDisplayName(player),
      matches: state.matches,
      uniqueOpponents: state.opponents.size,
    };

    if (!weeklyActivityLeader) {
      weeklyActivityLeader = candidate;
      continue;
    }

    const leaderUser = usersById.get(weeklyActivityLeader.userId);
    const candidateRating = player.rating_atual ?? 0;
    const leaderRating = leaderUser?.rating_atual ?? 0;

    if (
      candidate.matches > weeklyActivityLeader.matches ||
      (candidate.matches === weeklyActivityLeader.matches &&
        candidate.uniqueOpponents > weeklyActivityLeader.uniqueOpponents) ||
      (candidate.matches === weeklyActivityLeader.matches &&
        candidate.uniqueOpponents === weeklyActivityLeader.uniqueOpponents &&
        candidateRating > leaderRating) ||
      (candidate.matches === weeklyActivityLeader.matches &&
        candidate.uniqueOpponents === weeklyActivityLeader.uniqueOpponents &&
        candidateRating === leaderRating &&
        candidate.userName.localeCompare(weeklyActivityLeader.userName, "pt-BR") < 0)
    ) {
      weeklyActivityLeader = candidate;
    }
  }

  return {
    streakLeader,
    weeklyActivityLeader,
  };
}
