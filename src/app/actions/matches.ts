"use server";

import { createClient } from "@/utils/supabase/server";

export async function confirmMatchAction(
  matchId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Buscar a partida
  const { data: match, error: matchFetchError } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single();

  if (matchFetchError || !match) {
    return { success: false, error: "Partida não encontrada" };
  }

  // Calcular pontuação
  const euSouPlayerA = match.player_a_id === userId;
  const isWinner = match.vencedor_id === userId;
  const opponentId = euSouPlayerA ? match.player_b_id : match.player_a_id;

  // Buscar dados atuais dos usuários
  const { data: usersData } = await supabase
    .from("users")
    .select("id, rating_atual, vitorias, derrotas, jogos_disputados")
    .in("id", [userId, opponentId]);

  const myData = usersData?.find((u) => u.id === userId);
  const opponentData = usersData?.find((u) => u.id === opponentId);

  const myRating = myData?.rating_atual ?? 250;
  const opponentRating = opponentData?.rating_atual ?? 250;

  const myDelta = isWinner ? 20 : 8;
  const opponentDelta = isWinner ? 8 : 20;

  // Determinar quem é o vencedor da partida
  const winnerId = match.vencedor_id;
  const loserId = winnerId === match.player_a_id ? match.player_b_id : match.player_a_id;

  // 1. Atualizar match para validado
  const { error: matchError } = await supabase
    .from("matches")
    .update({
      status: "validado",
      aprovado_por: userId,
      pontos_variacao_a: euSouPlayerA ? myDelta : opponentDelta,
      pontos_variacao_b: euSouPlayerA ? opponentDelta : myDelta,
      rating_final_a: euSouPlayerA ? myRating + myDelta : opponentRating + opponentDelta,
      rating_final_b: euSouPlayerA ? opponentRating + opponentDelta : myRating + myDelta,
    })
    .eq("id", matchId);

  if (matchError) {
    console.error("Erro ao atualizar match:", matchError);
    return { success: false, error: "Erro ao atualizar partida" };
  }

  // 2. Atualizar stats do vencedor
  const winnerData = usersData?.find((u) => u.id === winnerId);
  await supabase
    .from("users")
    .update({
      rating_atual: (winnerData?.rating_atual ?? 250) + 20,
      vitorias: (winnerData?.vitorias ?? 0) + 1,
      jogos_disputados: (winnerData?.jogos_disputados ?? 0) + 1,
    })
    .eq("id", winnerId);

  // 3. Atualizar stats do perdedor
  const loserData = usersData?.find((u) => u.id === loserId);
  await supabase
    .from("users")
    .update({
      rating_atual: (loserData?.rating_atual ?? 250) + 8,
      derrotas: (loserData?.derrotas ?? 0) + 1,
      jogos_disputados: (loserData?.jogos_disputados ?? 0) + 1,
    })
    .eq("id", loserId);

  // 4. Registrar transações
  await supabase.from("rating_transactions").insert([
    {
      match_id: matchId,
      user_id: userId,
      motivo: isWinner ? "vitoria" : "derrota",
      valor: myDelta,
      rating_antes: myRating,
      rating_depois: myRating + myDelta,
    },
    {
      match_id: matchId,
      user_id: opponentId,
      motivo: isWinner ? "derrota" : "vitoria",
      valor: opponentDelta,
      rating_antes: opponentRating,
      rating_depois: opponentRating + opponentDelta,
    },
  ]);

  return { success: true };
}

export async function contestMatchAction(
  matchId: string,
  userId: string,
  newOutcome: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const [aStr, bStr] = newOutcome.split("x");
  const resultadoA = parseInt(aStr, 10);
  const resultadoB = parseInt(bStr, 10);

  // Buscar a partida para determinar o vencedor
  const { data: match } = await supabase
    .from("matches")
    .select("player_a_id, player_b_id")
    .eq("id", matchId)
    .single();

  if (!match) {
    return { success: false, error: "Partida não encontrada" };
  }

  const vencedorId = resultadoA > resultadoB ? match.player_a_id : match.player_b_id;

  const { error } = await supabase
    .from("matches")
    .update({
      resultado_a: resultadoA,
      resultado_b: resultadoB,
      vencedor_id: vencedorId,
      status: "edited",
      criado_por: userId,
    })
    .eq("id", matchId);

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
  const supabase = await createClient();

  const [aStr, bStr] = input.outcome.split("x");
  const resultadoA = parseInt(aStr, 10);
  const resultadoB = parseInt(bStr, 10);

  // Verificar limite diário
  const today = new Date().toISOString().split("T")[0];
  const { data: limitData } = await supabase
    .from("daily_limits")
    .select("jogos_registrados")
    .eq("user_id", input.playerId)
    .eq("opponent_id", input.opponentId)
    .eq("data", today)
    .single();

  if (limitData && limitData.jogos_registrados >= 2) {
    return { success: false, error: "Limite de 2 jogos/dia contra este adversário atingido!" };
  }

  // Determinar vencedor
  const vencedorId = resultadoA > resultadoB ? input.playerId : input.opponentId;

  // Criar a partida
  const { error: matchError } = await supabase
    .from("matches")
    .insert({
      player_a_id: input.playerId,
      player_b_id: input.opponentId,
      vencedor_id: vencedorId,
      resultado_a: resultadoA,
      resultado_b: resultadoB,
      status: "pendente",
      criado_por: input.playerId,
      tipo_resultado: resultadoA > resultadoB ? "win" : "loss",
    });

  if (matchError) {
    console.error("Erro ao criar partida:", matchError);
    return { success: false, error: "Erro ao registrar partida" };
  }

  // Atualizar ou criar limite diário
  if (limitData) {
    await supabase
      .from("daily_limits")
      .update({ jogos_registrados: limitData.jogos_registrados + 1 })
      .eq("user_id", input.playerId)
      .eq("opponent_id", input.opponentId)
      .eq("data", today);
  } else {
    await supabase.from("daily_limits").insert([
      { user_id: input.playerId, opponent_id: input.opponentId, data: today, jogos_registrados: 1 },
      { user_id: input.opponentId, opponent_id: input.playerId, data: today, jogos_registrados: 1 },
    ]);
  }

  return { success: true };
}





