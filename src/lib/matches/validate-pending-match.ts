import { createAdminClient } from "@/utils/supabase/admin";
import { checkAndUnlockAchievements, type Achievement } from "@/lib/achievements";

type ValidationActorType = "player" | "admin" | "system";

type ValidationRpcRow = {
  match_id: string;
  old_status: "pendente" | "edited";
  player_a_id: string;
  player_b_id: string;
  winner_id: string;
  loser_id: string;
  player_a_name: string;
  player_b_name: string;
  score_label: string;
  player_a_delta: number;
  player_b_delta: number;
  winner_rating_before: number;
  loser_rating_before: number;
  winner_rating_after: number;
  loser_rating_after: number;
};

type ValidationCurrentUserRow = {
  id: string;
  full_name: string | null;
  name: string | null;
  email: string | null;
  rating_atual: number | null;
  vitorias: number | null;
  derrotas: number | null;
  jogos_disputados: number | null;
};

export type ValidatePendingMatchParams = {
  matchId: string;
  actorUserId?: string | null;
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

function parseValidatePendingRpcRow(data: unknown): ValidationRpcRow | null {
  const row = Array.isArray(data) ? data[0] : data;

  if (!row || typeof row !== "object") return null;

  const candidate = row as Partial<ValidationRpcRow>;
  if (
    typeof candidate.match_id !== "string" ||
    (candidate.old_status !== "pendente" && candidate.old_status !== "edited") ||
    typeof candidate.player_a_id !== "string" ||
    typeof candidate.player_b_id !== "string" ||
    typeof candidate.winner_id !== "string" ||
    typeof candidate.loser_id !== "string" ||
    typeof candidate.player_a_name !== "string" ||
    typeof candidate.player_b_name !== "string" ||
    typeof candidate.score_label !== "string" ||
    typeof candidate.player_a_delta !== "number" ||
    typeof candidate.player_b_delta !== "number" ||
    typeof candidate.winner_rating_before !== "number" ||
    typeof candidate.loser_rating_before !== "number" ||
    typeof candidate.winner_rating_after !== "number" ||
    typeof candidate.loser_rating_after !== "number"
  ) {
    return null;
  }

  return {
    match_id: candidate.match_id,
    old_status: candidate.old_status,
    player_a_id: candidate.player_a_id,
    player_b_id: candidate.player_b_id,
    winner_id: candidate.winner_id,
    loser_id: candidate.loser_id,
    player_a_name: candidate.player_a_name,
    player_b_name: candidate.player_b_name,
    score_label: candidate.score_label,
    player_a_delta: candidate.player_a_delta,
    player_b_delta: candidate.player_b_delta,
    winner_rating_before: candidate.winner_rating_before,
    loser_rating_before: candidate.loser_rating_before,
    winner_rating_after: candidate.winner_rating_after,
    loser_rating_after: candidate.loser_rating_after,
  };
}

function mapValidatePendingRpcErrorMessage(message: string | undefined): {
  error: string;
  reason: string;
} {
  const normalized = (message || "").toLowerCase();

  if (normalized.includes("already_validated")) {
    return { error: "Esta partida já foi confirmada", reason: "already_validated" };
  }

  if (normalized.includes("already_canceled")) {
    return { error: "Esta partida foi cancelada", reason: "already_canceled" };
  }

  if (normalized.includes("match_already_processed")) {
    return {
      error: "Esta partida já foi processada por outro usuário",
      reason: "match_already_processed",
    };
  }

  if (normalized.includes("match_not_found")) {
    return { error: "Partida não encontrada", reason: "match_not_found" };
  }

  if (normalized.includes("missing_winner")) {
    return {
      error: "Partida pendente sem vencedor definido",
      reason: "missing_winner",
    };
  }

  if (normalized.includes("invalid_winner")) {
    return { error: "Vencedor da partida é inválido", reason: "invalid_winner" };
  }

  if (normalized.includes("actor_not_waiting_user")) {
    return {
      error: "Esta partida não está aguardando sua confirmação",
      reason: "actor_not_waiting_user",
    };
  }

  if (normalized.includes("invalid_stored_k_factor")) {
    return {
      error: "K factor salvo na partida é inválido",
      reason: "invalid_stored_k_factor",
    };
  }

  if (normalized.includes("invalid_k_factor")) {
    return {
      error: "Configuração de K factor inválida",
      reason: "invalid_k_factor",
    };
  }

  return {
    error: "Erro ao validar a partida pendente",
    reason: "validate_pending_match_rpc_failed",
  };
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

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "validate_pending_match_v2",
    {
      p_match_id: params.matchId,
      p_actor_user_id: params.actorUserId ?? null,
      p_actor_name: params.actorName ?? null,
      p_actor_type: params.actorType,
    }
  );

  if (rpcError) {
    const mappedError = mapValidatePendingRpcErrorMessage(rpcError.message);
    return fail(mappedError.error, mappedError.reason);
  }

  const validation = parseValidatePendingRpcRow(rpcData);
  if (!validation) {
    return fail("Erro ao validar a partida pendente", "validate_pending_match_rpc_invalid");
  }

  const { data: usersData, error: usersError } = await supabase
    .from("users")
    .select("id, full_name, name, email, rating_atual, vitorias, derrotas, jogos_disputados")
    .in("id", [validation.player_a_id, validation.player_b_id]);

  if (usersError || !usersData || usersData.length !== 2) {
    return fail("Erro ao buscar dados atualizados dos jogadores", "users_query_failed");
  }

  const playerAData = usersData.find(
    (user): user is ValidationCurrentUserRow => user.id === validation.player_a_id
  );
  const playerBData = usersData.find(
    (user): user is ValidationCurrentUserRow => user.id === validation.player_b_id
  );

  if (!playerAData || !playerBData) {
    return fail("Dados atualizados dos jogadores não encontrados", "users_missing");
  }

  const winnerId = validation.winner_id;
  const loserId = validation.loser_id;
  const winnerData = winnerId === validation.player_a_id ? playerAData : playerBData;
  const loserData = loserId === validation.player_a_id ? playerAData : playerBData;
  const playerADelta = validation.player_a_delta;
  const playerBDelta = validation.player_b_delta;

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
    vitorias: winnerData.vitorias ?? 0,
    derrotas: winnerData.derrotas ?? 0,
    jogos: winnerData.jogos_disputados ?? 0,
    rating: winnerData.rating_atual ?? validation.winner_rating_after,
    streak: winnerStreak,
    isWinner: true,
    opponentRating: validation.loser_rating_before,
    resultado: validation.score_label,
  };

  const loserContext = {
    userId: loserId,
    matchId: params.matchId,
    vitorias: loserData.vitorias ?? 0,
    derrotas: loserData.derrotas ?? 0,
    jogos: loserData.jogos_disputados ?? 0,
    rating: loserData.rating_atual ?? validation.loser_rating_after,
    streak: 0,
    isWinner: false,
    opponentRating: validation.winner_rating_before,
    resultado: validation.score_label,
  };

  const [winnerAchievementsResult, loserAchievementsResult] = await Promise.allSettled([
    checkAndUnlockAchievements(winnerContext),
    checkAndUnlockAchievements(loserContext),
  ]);

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
    oldStatus: validation.old_status,
    targetName: `${validation.player_a_name} vs ${validation.player_b_name} (${validation.score_label})`,
    playerADelta,
    playerBDelta,
    scoreLabel: validation.score_label,
    playerAName: validation.player_a_name,
    playerBName: validation.player_b_name,
  };
}
