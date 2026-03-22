"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  enforcePendingConfirmationSla,
  getPendingConfirmationDeadlineHours,
  getOpenPendingConfirmationSnapshots,
} from "@/lib/matches/confirmation-sla";

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
  await enforcePendingConfirmationSla({ supabase: adminSupabase });

  const [deadlineHours, pendingCountResult, pendingSnapshotsResult] =
    await Promise.all([
      getPendingConfirmationDeadlineHours(adminSupabase),
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

  const nextDeadlineAt =
    pendingSnapshotsResult.items
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
  await enforcePendingConfirmationSla({ supabase: adminSupabase });

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
    player_a: normalizePendingUserRelation(match.player_a, match.player_a_id),
    player_b: normalizePendingUserRelation(match.player_b, match.player_b_id),
  }));
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
  await enforcePendingConfirmationSla({ supabase: adminSupabase });

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
