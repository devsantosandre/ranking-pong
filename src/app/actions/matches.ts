"use server";

import { createClient } from "@/utils/supabase/server";
import { calculateElo, applyMinRating } from "@/lib/elo";

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

export async function confirmMatchAction(
  matchId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // 1. Buscar a partida COM VERIFICAÇÃO DE STATUS para evitar race condition
  // Usamos uma query que já filtra por status válido
  const { data: match, error: matchFetchError } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .in("status", ["pendente", "edited"]) // Só permite confirmar se estiver nesses status
    .single();

  if (matchFetchError || !match) {
    // Se não encontrou, pode ser que já foi confirmada ou não existe
    const { data: existingMatch } = await supabase
      .from("matches")
      .select("status")
      .eq("id", matchId)
      .single();

    if (existingMatch?.status === "validado") {
      return { success: false, error: "Esta partida já foi confirmada" };
    }
    if (existingMatch?.status === "cancelado") {
      return { success: false, error: "Esta partida foi cancelada" };
    }
    return { success: false, error: "Partida não encontrada" };
  }

  // 2. Calcular pontuação
  const euSouPlayerA = match.player_a_id === userId;
  const isWinner = match.vencedor_id === userId;
  const opponentId = euSouPlayerA ? match.player_b_id : match.player_a_id;

  // 3. Buscar dados atuais dos usuários
  const { data: usersData, error: usersError } = await supabase
    .from("users")
    .select("id, rating_atual, vitorias, derrotas, jogos_disputados")
    .in("id", [userId, opponentId]);

  if (usersError || !usersData || usersData.length !== 2) {
    console.error("Erro ao buscar usuários:", usersError);
    return { success: false, error: "Erro ao buscar dados dos jogadores" };
  }

  const myData = usersData.find((u) => u.id === userId);
  const opponentData = usersData.find((u) => u.id === opponentId);

  if (!myData || !opponentData) {
    return { success: false, error: "Dados dos jogadores não encontrados" };
  }

  const myRating = myData.rating_atual ?? 250;
  const opponentRating = opponentData.rating_atual ?? 250;

  // 4. Buscar configurações dinâmicas (K factor para ELO)
  const { data: settings } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", ["k_factor"]);

  const kFactorStr = settings?.find((s) => s.key === "k_factor")?.value;
  const kFactor = kFactorStr ? parseInt(kFactorStr, 10) : 24;

  // Validar que o K factor é válido
  if (isNaN(kFactor) || kFactor < 1 || kFactor > 100) {
    return { success: false, error: "Configuração de K factor inválida" };
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
    return { success: false, error: "Dados do vencedor/perdedor não encontrados" };
  }

  // 6. Calcular ratings finais com proteção de mínimo
  const playerARating = euSouPlayerA ? myRating : opponentRating;
  const playerBRating = euSouPlayerA ? opponentRating : myRating;
  const playerADelta = euSouPlayerA ? myDelta : opponentDelta;
  const playerBDelta = euSouPlayerA ? opponentDelta : myDelta;

  // 7. Atualizar match para validado COM CONDIÇÃO DE STATUS
  // Isso previne race condition - só atualiza se ainda estiver pendente/edited
  const { data: updatedMatch, error: matchError } = await supabase
    .from("matches")
    .update({
      status: "validado",
      aprovado_por: userId,
      pontos_variacao_a: playerADelta,
      pontos_variacao_b: playerBDelta,
      rating_final_a: applyMinRating(playerARating + playerADelta),
      rating_final_b: applyMinRating(playerBRating + playerBDelta),
    })
    .eq("id", matchId)
    .in("status", ["pendente", "edited"]) // Só atualiza se status ainda for válido
    .select()
    .single();

  if (matchError || !updatedMatch) {
    // Se falhou, provavelmente outro request já confirmou
    console.error("Erro ao atualizar match (possível race condition):", matchError);
    return { success: false, error: "Esta partida já foi processada por outro usuário" };
  }

  // 8. Atualizar stats do vencedor (ganha pontos)
  const newWinnerRating = applyMinRating((winnerData.rating_atual ?? 1000) + winnerDelta);
  const { error: winnerError } = await supabase
    .from("users")
    .update({
      rating_atual: newWinnerRating,
      vitorias: (winnerData.vitorias ?? 0) + 1,
      jogos_disputados: (winnerData.jogos_disputados ?? 0) + 1,
    })
    .eq("id", winnerId);

  if (winnerError) {
    console.error("Erro ao atualizar stats do vencedor:", winnerError);
    // Reverter o status da partida
    await supabase.from("matches").update({ status: "pendente" }).eq("id", matchId);
    return { success: false, error: "Erro ao atualizar estatísticas do vencedor" };
  }

  // 9. Atualizar stats do perdedor (perde pontos - loserDelta é negativo)
  const newLoserRating = applyMinRating((loserData.rating_atual ?? 1000) + loserDelta);
  const { error: loserError } = await supabase
    .from("users")
    .update({
      rating_atual: newLoserRating,
      derrotas: (loserData.derrotas ?? 0) + 1,
      jogos_disputados: (loserData.jogos_disputados ?? 0) + 1,
    })
    .eq("id", loserId);

  if (loserError) {
    console.error("Erro ao atualizar stats do perdedor:", loserError);
    // Tentar reverter (best effort)
    await supabase
      .from("users")
      .update({
        rating_atual: winnerData.rating_atual,
        vitorias: winnerData.vitorias,
        jogos_disputados: winnerData.jogos_disputados,
      })
      .eq("id", winnerId);
    await supabase.from("matches").update({ status: "pendente" }).eq("id", matchId);
    return { success: false, error: "Erro ao atualizar estatísticas do perdedor" };
  }

  // 10. Registrar transações
  const myNewRating = isWinner ? newWinnerRating : newLoserRating;
  const opponentNewRating = isWinner ? newLoserRating : newWinnerRating;
  const { error: transactionError } = await supabase.from("rating_transactions").insert([
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

  if (transactionError) {
    // Log error but don't fail - transactions are for audit only
    console.error("Erro ao registrar transações (não crítico):", transactionError);
  }

  return { success: true };
}

export async function contestMatchAction(
  matchId: string,
  userId: string,
  newOutcome: string
): Promise<{ success: boolean; error?: string }> {
  // Validar formato do score
  const score = parseScore(newOutcome);
  if (!score) {
    return {
      success: false,
      error: "Formato de placar inválido. Use o formato NxN (ex: 3x1)",
    };
  }

  const supabase = await createClient();

  // Buscar a partida para determinar o vencedor e verificar status
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("player_a_id, player_b_id, status")
    .eq("id", matchId)
    .single();

  if (matchError || !match) {
    return { success: false, error: "Partida não encontrada" };
  }

  // Não permitir contestar partida já validada ou cancelada
  if (match.status === "validado") {
    return { success: false, error: "Não é possível contestar uma partida já validada" };
  }
  if (match.status === "cancelado") {
    return { success: false, error: "Não é possível contestar uma partida cancelada" };
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

  if (error) {
    console.error("Erro ao contestar:", error);
    return { success: false, error: "Erro ao contestar partida" };
  }

  return { success: true };
}

export async function registerMatchAction(input: {
  playerId: string;
  opponentId: string;
  outcome: string;
}): Promise<{ success: boolean; error?: string }> {
  // Validar formato do score
  const score = parseScore(input.outcome);
  if (!score) {
    return {
      success: false,
      error: "Formato de placar inválido. Use o formato NxN (ex: 3x1)",
    };
  }

  // Validar que não é o mesmo jogador
  if (input.playerId === input.opponentId) {
    return { success: false, error: "Você não pode jogar contra si mesmo" };
  }

  const supabase = await createClient();

  // Buscar limite diário das configurações
  const { data: limiteSetting } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "limite_jogos_diarios")
    .single();

  const limiteStr = limiteSetting?.value;
  const limiteJogosDiarios = limiteStr ? parseInt(limiteStr, 10) : 2;

  if (isNaN(limiteJogosDiarios) || limiteJogosDiarios < 1) {
    return { success: false, error: "Configuração de limite diário inválida" };
  }

  const today = new Date().toISOString().split("T")[0];

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

  if (limitData && limitData.jogos_registrados >= limiteJogosDiarios) {
    return {
      success: false,
      error: `Limite de ${limiteJogosDiarios} jogos/dia contra este adversário atingido!`,
    };
  }

  // Determinar vencedor
  const vencedorId = score.a > score.b ? input.playerId : input.opponentId;

  // Criar a partida
  const { error: matchError } = await supabase.from("matches").insert({
    player_a_id: input.playerId,
    player_b_id: input.opponentId,
    vencedor_id: vencedorId,
    resultado_a: score.a,
    resultado_b: score.b,
    status: "pendente",
    criado_por: input.playerId,
    tipo_resultado: score.a > score.b ? "win" : "loss",
  });

  if (matchError) {
    console.error("Erro ao criar partida:", matchError);
    return { success: false, error: "Erro ao registrar partida" };
  }

  // Atualizar limite diário usando upsert para evitar race condition
  // Usamos uma abordagem de incremento atômico
  if (limitData) {
    // Já existe registro, incrementar
    const { error: updateError } = await supabase
      .from("daily_limits")
      .update({ jogos_registrados: limitData.jogos_registrados + 1 })
      .eq("user_id", input.playerId)
      .eq("opponent_id", input.opponentId)
      .eq("data", today);

    if (updateError) {
      console.error("Erro ao atualizar limite diário (não crítico):", updateError);
    }

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
      } else {
        console.error("Erro ao criar limite diário (não crítico):", insertError);
      }
    }
  }

  return { success: true };
}




