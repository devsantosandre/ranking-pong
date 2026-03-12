import { createAdminClient } from "@/utils/supabase/admin";
import { calculateElo, applyMinRating } from "@/lib/elo";
import { checkAndUnlockAchievements, type Achievement } from "@/lib/achievements";
import type { PendingNotificationPayloadV1 } from "@/lib/types/notifications";

type ValidationActorType = "player" | "admin";

type ValidationMatchRow = {
  id: string;
  player_a_id: string;
  player_b_id: string;
  vencedor_id: string | null;
  resultado_a: number;
  resultado_b: number;
  criado_por: string | null;
  k_factor_used: number | null;
  status: "pendente" | "edited" | "validado" | "cancelado";
};

type ValidationUserRow = {
  id: string;
  full_name: string | null;
  name: string | null;
  email: string | null;
  rating_atual: number | null;
  vitorias: number | null;
  derrotas: number | null;
  jogos_disputados: number | null;
};

type ValidationSettingsRow = {
  key: string;
  value: string | null;
};

export type ValidatePendingMatchParams = {
  matchId: string;
  actorUserId: string;
  actorName?: string | null;
  actorType: ValidationActorType;
};

export type ValidatePendingMatchSuccess = {
  success: true;
  unlockedAchievementsByUserId: Record<string, Achievement[]>;
  oldStatus: "pendente" | "edited";
  targetName: string;
  playerADelta: number;
  playerBDelta: number;
  scoreLabel: string;
  playerAName: string;
  playerBName: string;
};

export type ValidatePendingMatchFailure = {
  success: false;
  error: string;
  reason: string;
};

export type ValidatePendingMatchResult =
  | ValidatePendingMatchSuccess
  | ValidatePendingMatchFailure;

function getUserDisplayName(user: {
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
}) {
  return user.full_name || user.name || user.email?.split("@")[0] || "Jogador";
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

async function emitPendingNotifications(
  userIds: string[],
  payload: PendingNotificationPayloadV1
) {
  const supabase = createAdminClient();
  const uniqueUserIds = Array.from(new Set(userIds));
  if (uniqueUserIds.length === 0) return;

  const { error } = await supabase.from("notifications").insert(
    uniqueUserIds.map((userId) => ({
      user_id: userId,
      tipo: "confirmacao",
      payload,
      lida: false,
    }))
  );

  if (error) {
    console.error("pending_notifications_insert_failed", {
      recipients: uniqueUserIds,
      matchId: payload.match_id,
      event: payload.event,
      actorId: payload.actor_id,
      reason: error.message,
      code: error.code,
    });
  }
}

export async function validatePendingMatchByActor(
  params: ValidatePendingMatchParams
): Promise<ValidatePendingMatchResult> {
  const supabase = createAdminClient();

  const fail = (error: string, reason: string): ValidatePendingMatchFailure => ({
    success: false,
    error,
    reason,
  });

  const { data: match, error: matchFetchError } = await supabase
    .from("matches")
    .select(
      "id, player_a_id, player_b_id, vencedor_id, resultado_a, resultado_b, criado_por, k_factor_used, status"
    )
    .eq("id", params.matchId)
    .in("status", ["pendente", "edited"])
    .single<ValidationMatchRow>();

  if (matchFetchError || !match) {
    const { data: existingMatch } = await supabase
      .from("matches")
      .select("status")
      .eq("id", params.matchId)
      .single<{ status: ValidationMatchRow["status"] }>();

    if (existingMatch?.status === "validado") {
      return fail("Esta partida já foi confirmada", "already_validated");
    }

    if (existingMatch?.status === "cancelado") {
      return fail("Esta partida foi cancelada", "already_canceled");
    }

    return fail("Partida não encontrada", "match_not_found");
  }

  const oldStatus = match.status as "pendente" | "edited";

  if (!match.vencedor_id) {
    return fail("Partida pendente sem vencedor definido", "missing_winner");
  }

  if (
    match.vencedor_id !== match.player_a_id &&
    match.vencedor_id !== match.player_b_id
  ) {
    return fail("Vencedor da partida é inválido", "invalid_winner");
  }

  if (params.actorType === "player") {
    const waitingUserId = getPendingResponsibleUserId(match);

    if (!waitingUserId || params.actorUserId !== waitingUserId) {
      return fail(
        "Esta partida não está aguardando sua confirmação",
        "actor_not_waiting_user"
      );
    }
  }

  const [
    { data: usersData, error: usersError },
    { data: settingsData },
  ] = await Promise.all([
    supabase
      .from("users")
      .select("id, full_name, name, email, rating_atual, vitorias, derrotas, jogos_disputados")
      .in("id", [match.player_a_id, match.player_b_id]),
    supabase.from("settings").select("key, value").in("key", ["k_factor"]),
  ]);

  if (usersError || !usersData || usersData.length !== 2) {
    return fail("Erro ao buscar dados dos jogadores", "users_query_failed");
  }

  const playerAData = usersData.find(
    (user): user is ValidationUserRow => user.id === match.player_a_id
  );
  const playerBData = usersData.find(
    (user): user is ValidationUserRow => user.id === match.player_b_id
  );

  if (!playerAData || !playerBData) {
    return fail("Dados dos jogadores não encontrados", "users_missing");
  }

  const storedKFactor = match.k_factor_used;

  if (typeof storedKFactor === "number") {
    if (isNaN(storedKFactor) || storedKFactor < 1 || storedKFactor > 100) {
      return fail("K factor salvo na partida é inválido", "invalid_stored_k_factor");
    }
  }

  const kFactorStr = (settingsData as ValidationSettingsRow[] | null)?.find(
    (setting) => setting.key === "k_factor"
  )?.value;
  const currentKFactor = kFactorStr ? parseInt(kFactorStr, 10) : 24;

  if (
    storedKFactor === null &&
    (isNaN(currentKFactor) || currentKFactor < 1 || currentKFactor > 100)
  ) {
    return fail("Configuração de K factor inválida", "invalid_k_factor");
  }

  const kFactor = storedKFactor ?? currentKFactor;

  const winnerId = match.vencedor_id;
  const loserId =
    winnerId === match.player_a_id ? match.player_b_id : match.player_a_id;
  const winnerData = winnerId === match.player_a_id ? playerAData : playerBData;
  const loserData = loserId === match.player_a_id ? playerAData : playerBData;

  const winnerRating = winnerData.rating_atual ?? 250;
  const loserRating = loserData.rating_atual ?? 250;
  const { winnerDelta, loserDelta } = calculateElo(winnerRating, loserRating, kFactor);

  const playerADelta = winnerId === match.player_a_id ? winnerDelta : loserDelta;
  const playerBDelta = winnerId === match.player_b_id ? winnerDelta : loserDelta;
  const playerANewRating = applyMinRating(
    (playerAData.rating_atual ?? 250) + playerADelta
  );
  const playerBNewRating = applyMinRating(
    (playerBData.rating_atual ?? 250) + playerBDelta
  );

  const { data: validatedMatch, error: validateError } = await supabase
    .from("matches")
    .update({
      status: "validado",
      aprovado_por: params.actorUserId,
      pontos_variacao_a: playerADelta,
      pontos_variacao_b: playerBDelta,
      rating_final_a: playerANewRating,
      rating_final_b: playerBNewRating,
      k_factor_used: kFactor,
    })
    .eq("id", params.matchId)
    .in("status", ["pendente", "edited"])
    .select("id")
    .single<{ id: string }>();

  if (validateError || !validatedMatch) {
    return fail(
      "Esta partida já foi processada por outro usuário",
      "match_already_processed"
    );
  }

  const [winnerUpdateResult, loserUpdateResult] = await Promise.all([
    supabase
      .from("users")
      .update({
        rating_atual: applyMinRating((winnerData.rating_atual ?? 250) + winnerDelta),
        vitorias: (winnerData.vitorias ?? 0) + 1,
        jogos_disputados: (winnerData.jogos_disputados ?? 0) + 1,
      })
      .eq("id", winnerId),
    supabase
      .from("users")
      .update({
        rating_atual: applyMinRating((loserData.rating_atual ?? 250) + loserDelta),
        derrotas: (loserData.derrotas ?? 0) + 1,
        jogos_disputados: (loserData.jogos_disputados ?? 0) + 1,
      })
      .eq("id", loserId),
  ]);

  if (winnerUpdateResult.error || loserUpdateResult.error) {
    await Promise.allSettled([
      supabase
        .from("users")
        .update({
          rating_atual: winnerData.rating_atual,
          vitorias: winnerData.vitorias,
          jogos_disputados: winnerData.jogos_disputados,
        })
        .eq("id", winnerId),
      supabase
        .from("users")
        .update({
          rating_atual: loserData.rating_atual,
          derrotas: loserData.derrotas,
          jogos_disputados: loserData.jogos_disputados,
        })
        .eq("id", loserId),
      supabase
        .from("matches")
        .update({ status: oldStatus })
        .eq("id", params.matchId),
    ]);

    return fail("Erro ao atualizar estatísticas dos jogadores", "player_update_failed");
  }

  const transactionPromise = supabase.from("rating_transactions").insert([
    {
      match_id: params.matchId,
      user_id: winnerId,
      motivo: "vitoria",
      valor: winnerDelta,
      rating_antes: winnerRating,
      rating_depois: applyMinRating(winnerRating + winnerDelta),
    },
    {
      match_id: params.matchId,
      user_id: loserId,
      motivo: "derrota",
      valor: loserDelta,
      rating_antes: loserRating,
      rating_depois: applyMinRating(loserRating + loserDelta),
    },
  ]);

  const { data: recentWinnerMatches } = await supabase
    .from("matches")
    .select("vencedor_id")
    .or(`player_a_id.eq.${winnerId},player_b_id.eq.${winnerId}`)
    .eq("status", "validado")
    .order("created_at", { ascending: false })
    .limit(20);

  let winnerStreak = 0;
  if (recentWinnerMatches) {
    for (const recentMatch of recentWinnerMatches) {
      if (recentMatch.vencedor_id === winnerId) {
        winnerStreak += 1;
      } else {
        break;
      }
    }
  }

  const winnerContext = {
    userId: winnerId,
    matchId: params.matchId,
    vitorias: (winnerData.vitorias ?? 0) + 1,
    derrotas: winnerData.derrotas ?? 0,
    jogos: (winnerData.jogos_disputados ?? 0) + 1,
    rating: applyMinRating(winnerRating + winnerDelta),
    streak: winnerStreak,
    isWinner: true,
    opponentRating: loserRating,
    resultado: `${match.resultado_a}x${match.resultado_b}`,
  };

  const loserContext = {
    userId: loserId,
    matchId: params.matchId,
    vitorias: loserData.vitorias ?? 0,
    derrotas: (loserData.derrotas ?? 0) + 1,
    jogos: (loserData.jogos_disputados ?? 0) + 1,
    rating: applyMinRating(loserRating + loserDelta),
    streak: 0,
    isWinner: false,
    opponentRating: winnerRating,
    resultado: `${match.resultado_a}x${match.resultado_b}`,
  };

  const [winnerAchievementsResult, loserAchievementsResult] = await Promise.allSettled([
    checkAndUnlockAchievements(winnerContext),
    checkAndUnlockAchievements(loserContext),
    transactionPromise,
  ]);

  const actorDisplayName =
    params.actorName ??
    getUserDisplayName(
      params.actorUserId === playerAData.id ? playerAData : playerBData
    );

  const resolvedPayload: PendingNotificationPayloadV1 = {
    event: "pending_resolved",
    match_id: params.matchId,
    status: "validado",
    actor_id: params.actorUserId,
    actor_name: actorDisplayName,
    created_by: match.criado_por || params.actorUserId,
  };

  await emitPendingNotifications(
    [match.player_a_id, match.player_b_id],
    resolvedPayload
  );

  const playerAName = getUserDisplayName(playerAData);
  const playerBName = getUserDisplayName(playerBData);

  return {
    success: true,
    unlockedAchievementsByUserId: {
      [winnerId]:
        winnerAchievementsResult.status === "fulfilled"
          ? winnerAchievementsResult.value
          : [],
      [loserId]:
        loserAchievementsResult.status === "fulfilled"
          ? loserAchievementsResult.value
          : [],
    },
    oldStatus,
    targetName: `${playerAName} vs ${playerBName} (${match.resultado_a}x${match.resultado_b})`,
    playerADelta,
    playerBDelta,
    scoreLabel: `${match.resultado_a}x${match.resultado_b}`,
    playerAName,
    playerBName,
  };
}
