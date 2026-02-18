"use server";

import { createClient } from "@/utils/supabase/server";
import { calculateElo, applyMinRating } from "@/lib/elo";
import { checkAndUnlockAchievements, type Achievement } from "@/lib/achievements";
import { sendPushToUsers } from "@/lib/push";
import type { PendingNotificationPayloadV1 } from "@/lib/types/notifications";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;
const BUSINESS_TIMEZONE = process.env.APP_TIMEZONE || "America/Sao_Paulo";

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

function getUserDisplayName(user: {
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
}): string | null {
  return user.full_name || user.name || user.email?.split("@")[0] || null;
}

function getCurrentDateInTimezone(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    // Fallback para UTC caso a timezone não seja suportada no runtime
    return new Date().toISOString().split("T")[0];
  }
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

  if (error) return;
}

async function emitPendingNotifications(
  supabase: ServerSupabaseClient,
  userIds: string[],
  payload: PendingNotificationPayloadV1
) {
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

  if (error) return;
}

export async function confirmMatchAction(
  matchId: string,
  userId: string
): Promise<{ success: boolean; error?: string; unlockedAchievements?: Achievement[] }> {
  const supabase = await createClient();
  const telemetry = createConfirmMatchTelemetry();
  const fail = (errorMessage: string, reason: string) => {
    telemetry.finish("error", reason);
    return { success: false, error: errorMessage };
  };

  // 1. Buscar a partida COM VERIFICAÇÃO DE STATUS para evitar race condition
  // Usamos uma query que já filtra por status válido
  const { data: match, error: matchFetchError } = await supabase
    .from("matches")
    .select("id, player_a_id, player_b_id, vencedor_id, resultado_a, resultado_b, criado_por, status")
    .eq("id", matchId)
    .in("status", ["pendente", "edited"]) // Só permite confirmar se estiver nesses status
    .single();
  telemetry.step("fetch_match");

  if (matchFetchError || !match) {
    // Se não encontrou, pode ser que já foi confirmada ou não existe
    const { data: existingMatch } = await supabase
      .from("matches")
      .select("status")
      .eq("id", matchId)
      .single();
    telemetry.step("fetch_existing_status");

    if (existingMatch?.status === "validado") {
      return fail("Esta partida já foi confirmada", "already_validated");
    }
    if (existingMatch?.status === "cancelado") {
      return fail("Esta partida foi cancelada", "already_canceled");
    }
    return fail("Partida não encontrada", "match_not_found");
  }

  // 2. Calcular pontuação
  const euSouPlayerA = match.player_a_id === userId;
  const isWinner = match.vencedor_id === userId;
  const opponentId = euSouPlayerA ? match.player_b_id : match.player_a_id;

  // 3. Buscar dados atuais dos usuários e settings em paralelo
  const [
    { data: usersData, error: usersError },
    { data: settings },
  ] = await Promise.all([
    supabase
      .from("users")
      .select("id, full_name, name, email, rating_atual, vitorias, derrotas, jogos_disputados")
      .in("id", [userId, opponentId]),
    supabase
      .from("settings")
      .select("key, value")
      .in("key", ["k_factor"]),
  ]);
  telemetry.step("fetch_users_and_settings");

  if (usersError || !usersData || usersData.length !== 2) {
    return fail("Erro ao buscar dados dos jogadores", "users_query_failed");
  }

  const myData = usersData.find((u) => u.id === userId);
  const opponentData = usersData.find((u) => u.id === opponentId);

  if (!myData || !opponentData) {
    return fail("Dados dos jogadores não encontrados", "users_missing");
  }

  const myRating = myData.rating_atual ?? 250;
  const opponentRating = opponentData.rating_atual ?? 250;

  const kFactorStr = settings?.find((s) => s.key === "k_factor")?.value;
  const kFactor = kFactorStr ? parseInt(kFactorStr, 10) : 24;

  // Validar que o K factor é válido
  if (isNaN(kFactor) || kFactor < 1 || kFactor > 100) {
    return fail("Configuração de K factor inválida", "invalid_k_factor");
  }

  // 5. Calcular ELO baseado nos ratings atuais
  const winnerRating = isWinner ? myRating : opponentRating;
  const loserRating = isWinner ? opponentRating : myRating;
  const { winnerDelta, loserDelta } = calculateElo(winnerRating, loserRating, kFactor);

  // myDelta e opponentDelta baseados em quem venceu
  const myDelta = isWinner ? winnerDelta : loserDelta;
  const opponentDelta = isWinner ? loserDelta : winnerDelta;

  // 5. Determinar quem é o vencedor da partida
  const winnerId = match.vencedor_id;
  const loserId = winnerId === match.player_a_id ? match.player_b_id : match.player_a_id;
  const winnerData = usersData.find((u) => u.id === winnerId);
  const loserData = usersData.find((u) => u.id === loserId);

  if (!winnerData || !loserData) {
    return fail("Dados do vencedor/perdedor não encontrados", "winner_or_loser_data_missing");
  }

  // 6. Calcular ratings finais com proteção de mínimo
  const playerARating = euSouPlayerA ? myRating : opponentRating;
  const playerBRating = euSouPlayerA ? opponentRating : myRating;
  const playerADelta = euSouPlayerA ? myDelta : opponentDelta;
  const playerBDelta = euSouPlayerA ? opponentDelta : myDelta;

  // 7. Atualizar match para validado COM CONDIÇÃO DE STATUS
  // Isso previne race condition - só atualiza se ainda estiver pendente/edited
  const { data: validatedMatch, error: matchError } = await supabase
    .from("matches")
    .update({
      status: "validado",
      aprovado_por: userId,
      pontos_variacao_a: playerADelta,
      pontos_variacao_b: playerBDelta,
      rating_final_a: applyMinRating(playerARating + playerADelta),
      rating_final_b: applyMinRating(playerBRating + playerBDelta),
      k_factor_used: kFactor, // Armazena o K factor usado para auditoria e reversão
    })
    .eq("id", matchId)
    .in("status", ["pendente", "edited"]) // Só atualiza se status ainda for válido
    .select("id")
    .single();
  telemetry.step("validate_and_update_match");

  if (matchError || !validatedMatch) {
    // Se falhou, provavelmente outro request já confirmou.
    return fail("Esta partida já foi processada por outro usuário", "match_already_processed");
  }

  // 8. Atualizar stats dos jogadores em paralelo
  const newWinnerRating = applyMinRating((winnerData.rating_atual ?? 1000) + winnerDelta);
  const newLoserRating = applyMinRating((loserData.rating_atual ?? 1000) + loserDelta);

  const [winnerUpdateResult, loserUpdateResult] = await Promise.all([
    supabase
      .from("users")
      .update({
        rating_atual: newWinnerRating,
        vitorias: (winnerData.vitorias ?? 0) + 1,
        jogos_disputados: (winnerData.jogos_disputados ?? 0) + 1,
      })
      .eq("id", winnerId),
    supabase
      .from("users")
      .update({
        rating_atual: newLoserRating,
        derrotas: (loserData.derrotas ?? 0) + 1,
        jogos_disputados: (loserData.jogos_disputados ?? 0) + 1,
      })
      .eq("id", loserId),
  ]);
  telemetry.step("update_players");

  if (winnerUpdateResult.error || loserUpdateResult.error) {
    // Reverte para estado anterior (best effort)
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
      supabase.from("matches").update({ status: "pendente" }).eq("id", matchId),
    ]);
    telemetry.step("rollback_after_player_update_error");

    return fail("Erro ao atualizar estatísticas dos jogadores", "player_update_failed");
  }

  // 10. Registrar transações (não crítico) - inicia em paralelo
  const myNewRating = isWinner ? newWinnerRating : newLoserRating;
  const opponentNewRating = isWinner ? newLoserRating : newWinnerRating;
  const transactionPromise = supabase.from("rating_transactions").insert([
    {
      match_id: matchId,
      user_id: userId,
      motivo: isWinner ? "vitoria" : "derrota",
      valor: myDelta,
      rating_antes: myRating,
      rating_depois: myNewRating,
    },
    {
      match_id: matchId,
      user_id: opponentId,
      motivo: isWinner ? "derrota" : "vitoria",
      valor: opponentDelta,
      rating_antes: opponentRating,
      rating_depois: opponentNewRating,
    },
  ]);

  // 11. Operações não críticas em paralelo (transações, conquistas e notificações)
  const actorNamePromise = Promise.resolve(getUserDisplayName(myData));
  const recentWinnerMatchesPromise = supabase
    .from("matches")
    .select("vencedor_id")
    .or(`player_a_id.eq.${winnerId},player_b_id.eq.${winnerId}`)
    .eq("status", "validado")
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: recentWinnerMatches } = await recentWinnerMatchesPromise;
  telemetry.step("fetch_winner_streak_history");

  let winnerStreak = 0;
  if (recentWinnerMatches) {
    for (const m of recentWinnerMatches) {
      if (m.vencedor_id === winnerId) winnerStreak++;
      else break;
    }
  }

  const winnerContext = {
    userId: winnerId,
    matchId,
    vitorias: (winnerData.vitorias ?? 0) + 1,
    derrotas: winnerData.derrotas ?? 0,
    jogos: (winnerData.jogos_disputados ?? 0) + 1,
    rating: newWinnerRating,
    streak: winnerStreak,
    isWinner: true,
    opponentRating: loserData.rating_atual ?? 1000,
    resultado: `${match.resultado_a}x${match.resultado_b}`,
  };

  const loserContext = {
    userId: loserId,
    matchId,
    vitorias: loserData.vitorias ?? 0,
    derrotas: (loserData.derrotas ?? 0) + 1,
    jogos: (loserData.jogos_disputados ?? 0) + 1,
    rating: newLoserRating,
    streak: 0, // Perdedor perde o streak
    isWinner: false,
    opponentRating: winnerData.rating_atual ?? 1000,
    resultado: `${match.resultado_a}x${match.resultado_b}`,
  };

  const myContext = userId === winnerId ? winnerContext : loserContext;
  const opponentContext = userId === winnerId ? loserContext : winnerContext;

  // Conquistas do adversário são best-effort em background para reduzir latência da confirmação.
  void checkAndUnlockAchievements(opponentContext).catch(() => undefined);

  const [myUnlockedResult, , actorNameResult] = await Promise.allSettled([
    checkAndUnlockAchievements(myContext),
    transactionPromise,
    actorNamePromise,
  ]);
  telemetry.step("run_async_post_processing");

  const myUnlocked = myUnlockedResult.status === "fulfilled" ? myUnlockedResult.value : [];
  const actorName =
    actorNameResult.status === "fulfilled" ? actorNameResult.value : null;

  const resolvedPayload: PendingNotificationPayloadV1 = {
    event: "pending_resolved",
    match_id: matchId,
    status: "validado",
    actor_id: userId,
    actor_name: actorName,
    created_by: match.criado_por || userId,
  };

  await emitPendingNotifications(
    supabase,
    [match.player_a_id, match.player_b_id],
    resolvedPayload
  );
  telemetry.step("emit_resolved_notifications");
  telemetry.finish("success");

  return { success: true, unlockedAchievements: myUnlocked };
}

export async function contestMatchAction(
  matchId: string,
  userId: string,
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
}): Promise<{ success: boolean; error?: string }> {
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

  const supabase = await createClient();

  // Buscar limite diário das configurações
  const { data: limiteSetting } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "limite_jogos_diarios")
    .single();
  telemetry.step("fetch_daily_limit_setting");

  const limiteStr = limiteSetting?.value;
  const limiteJogosDiarios = limiteStr ? parseInt(limiteStr, 10) : 2;

  if (isNaN(limiteJogosDiarios) || limiteJogosDiarios < 1) {
    return fail("Configuração de limite diário inválida", "invalid_daily_limit_setting");
  }

  const today = getCurrentDateInTimezone(BUSINESS_TIMEZONE);

  // Verificar limite diário para ambas as direções (A vs B e B vs A)
  const { data: limitData } = await supabase
    .from("daily_limits")
    .select("jogos_registrados")
    .or(
      `and(user_id.eq.${input.playerId},opponent_id.eq.${input.opponentId}),and(user_id.eq.${input.opponentId},opponent_id.eq.${input.playerId})`
    )
    .eq("data", today)
    .limit(1)
    .single();
  telemetry.step("check_daily_limit");

  if (limitData && limitData.jogos_registrados >= limiteJogosDiarios) {
    return fail(
      `Limite de ${limiteJogosDiarios} jogos/dia contra este adversário atingido!`,
      "daily_limit_reached"
    );
  }

  // Determinar vencedor
  const vencedorId = score.a > score.b ? input.playerId : input.opponentId;

  // Criar a partida
  const { data: createdMatch, error: matchError } = await supabase
    .from("matches")
    .insert({
      player_a_id: input.playerId,
      player_b_id: input.opponentId,
      vencedor_id: vencedorId,
      resultado_a: score.a,
      resultado_b: score.b,
      status: "pendente",
      criado_por: input.playerId,
      tipo_resultado: score.a > score.b ? "win" : "loss",
    })
    .select("id, criado_por")
    .single();
  telemetry.step("insert_match");

  if (matchError || !createdMatch) {
    return fail("Erro ao registrar partida", "insert_match_failed");
  }

  // Atualizar limite diário usando upsert para evitar race condition
  // Usamos uma abordagem de incremento atômico
  if (limitData) {
    // Já existe registro, incrementar
    await supabase
      .from("daily_limits")
      .update({ jogos_registrados: limitData.jogos_registrados + 1 })
      .eq("user_id", input.playerId)
      .eq("opponent_id", input.opponentId)
      .eq("data", today);

    // Atualizar também o registro inverso se existir
    await supabase
      .from("daily_limits")
      .update({ jogos_registrados: limitData.jogos_registrados + 1 })
      .eq("user_id", input.opponentId)
      .eq("opponent_id", input.playerId)
      .eq("data", today);
  } else {
    // Não existe, criar para ambas as direções
    const { error: insertError } = await supabase.from("daily_limits").insert([
      {
        user_id: input.playerId,
        opponent_id: input.opponentId,
        data: today,
        jogos_registrados: 1,
      },
      {
        user_id: input.opponentId,
        opponent_id: input.playerId,
        data: today,
        jogos_registrados: 1,
      },
    ]);

    if (insertError) {
      // Se falhou por conflito (race condition), tentar update
      if (insertError.code === "23505") {
        // Unique violation - outro request já inseriu, fazer update
        await supabase
          .from("daily_limits")
          .update({ jogos_registrados: 1 })
          .eq("user_id", input.playerId)
          .eq("opponent_id", input.opponentId)
          .eq("data", today);
      }
    }
  }
  telemetry.step("update_daily_limit_counters");

  const actorName = await getActorName(supabase, input.playerId);
  const createdPayload: PendingNotificationPayloadV1 = {
    event: "pending_created",
    match_id: createdMatch.id,
    status: "pendente",
    actor_id: input.playerId,
    actor_name: actorName,
    created_by: createdMatch.criado_por || input.playerId,
  };

  await emitPendingNotification(supabase, input.opponentId, createdPayload);
  telemetry.step("emit_pending_notification");

  await sendPushToUsers([input.opponentId], {
    title: "Nova partida para confirmar",
    body: `${actorName || "Seu adversário"} registrou ${score.a}x${score.b}. Toque para revisar.`,
    url: "/partidas",
    tag: `pending-match-${createdMatch.id}`,
    data: {
      matchId: createdMatch.id,
      event: "pending_created",
    },
  });
  telemetry.step("emit_pending_push");
  telemetry.finish("success");

  return { success: true };
}
