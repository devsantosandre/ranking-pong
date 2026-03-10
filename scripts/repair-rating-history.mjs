import { createClient } from "@supabase/supabase-js";

const APPLY_CHANGES = process.argv.includes("--apply");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase environment variables.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function getDisplayName(user) {
  return user.full_name || user.name || user.email || user.id;
}

function expectedScore(myRating, opponentRating) {
  return 1 / (1 + Math.pow(10, (opponentRating - myRating) / 400));
}

function calculateElo(winnerRating, loserRating, kFactor = 24) {
  const expectedWinner = expectedScore(winnerRating, loserRating);
  const expectedLoser = expectedScore(loserRating, winnerRating);

  return {
    winnerDelta: Math.round(kFactor * (1 - expectedWinner)),
    loserDelta: Math.round(kFactor * (0 - expectedLoser)),
  };
}

function formatUserDiff(item) {
  return {
    player: item.player,
    current: item.current,
    corrected: item.corrected,
    diff: item.diff,
  };
}

async function applyRowUpdates(table, rows) {
  for (const row of rows) {
    const { id, ...payload } = row;
    const { error } = await supabase.from(table).update(payload).eq("id", id);

    if (error) {
      throw error;
    }
  }
}

async function main() {
  const [usersRes, matchesRes, transactionsRes] = await Promise.all([
    supabase
      .from("users")
      .select(
        "id, full_name, name, email, rating_atual, vitorias, derrotas, jogos_disputados, hide_from_ranking, is_active"
      ),
    supabase
      .from("matches")
      .select(
        "id, player_a_id, player_b_id, vencedor_id, status, created_at, pontos_variacao_a, pontos_variacao_b, rating_final_a, rating_final_b, k_factor_used"
      )
      .eq("status", "validado"),
    supabase
      .from("rating_transactions")
      .select("id, match_id, user_id, motivo, valor, rating_antes, rating_depois, created_at")
      .in("motivo", ["vitoria", "derrota"])
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
  ]);

  for (const result of [usersRes, matchesRes, transactionsRes]) {
    if (result.error) throw result.error;
  }

  const users = usersRes.data;
  const validatedMatches = matchesRes.data;
  const transactions = transactionsRes.data;

  const validatedMatchIds = new Set(validatedMatches.map((match) => match.id));
  const matchTransactions = transactions.filter((row) => row.match_id && validatedMatchIds.has(row.match_id));
  const transactionsByMatchId = new Map();
  const initialRatings = new Map();
  const appliedAtByMatchId = new Map();

  for (const row of transactions) {
    if (!initialRatings.has(row.user_id)) {
      initialRatings.set(row.user_id, row.rating_antes);
    }
  }

  for (const row of matchTransactions) {
    const rows = transactionsByMatchId.get(row.match_id) ?? [];
    rows.push(row);
    transactionsByMatchId.set(row.match_id, rows);

    if (!appliedAtByMatchId.has(row.match_id)) {
      appliedAtByMatchId.set(row.match_id, row.created_at);
    }
  }

  for (const user of users) {
    if (!initialRatings.has(user.id)) {
      initialRatings.set(user.id, user.rating_atual);
    }
  }

  const orderedMatches = [...validatedMatches].sort((left, right) => {
    const leftAppliedAt = appliedAtByMatchId.get(left.id) ?? left.created_at;
    const rightAppliedAt = appliedAtByMatchId.get(right.id) ?? right.created_at;

    if (leftAppliedAt < rightAppliedAt) return -1;
    if (leftAppliedAt > rightAppliedAt) return 1;
    return left.id.localeCompare(right.id);
  });

  const correctedRatings = new Map(initialRatings);
  const correctedStats = new Map(
    users.map((user) => [user.id, { wins: 0, losses: 0, games: 0 }])
  );
  const matchUpdates = [];
  const transactionUpdates = [];

  for (const match of orderedMatches) {
    const ratingA = correctedRatings.get(match.player_a_id);
    const ratingB = correctedRatings.get(match.player_b_id);

    if (typeof ratingA !== "number" || typeof ratingB !== "number") {
      throw new Error(`Missing rating state for match ${match.id}`);
    }

    const winnerId = match.vencedor_id;
    const loserId = winnerId === match.player_a_id ? match.player_b_id : match.player_a_id;
    const winnerRating = winnerId === match.player_a_id ? ratingA : ratingB;
    const loserRating = loserId === match.player_a_id ? ratingA : ratingB;
    const { winnerDelta, loserDelta } = calculateElo(
      winnerRating,
      loserRating,
      match.k_factor_used ?? 24
    );

    const correctedDeltaA = winnerId === match.player_a_id ? winnerDelta : loserDelta;
    const correctedDeltaB = winnerId === match.player_b_id ? winnerDelta : loserDelta;
    const correctedFinalA = ratingA + correctedDeltaA;
    const correctedFinalB = ratingB + correctedDeltaB;

    if (
      correctedDeltaA !== match.pontos_variacao_a ||
      correctedDeltaB !== match.pontos_variacao_b ||
      correctedFinalA !== match.rating_final_a ||
      correctedFinalB !== match.rating_final_b
    ) {
      matchUpdates.push({
        id: match.id,
        pontos_variacao_a: correctedDeltaA,
        pontos_variacao_b: correctedDeltaB,
        rating_final_a: correctedFinalA,
        rating_final_b: correctedFinalB,
      });
    }

    const txRows = transactionsByMatchId.get(match.id) ?? [];

    if (txRows.length !== 2) {
      throw new Error(`Expected 2 rating transactions for validated match ${match.id}`);
    }

    for (const row of txRows) {
      const isPlayerA = row.user_id === match.player_a_id;
      const correctedDelta = isPlayerA ? correctedDeltaA : correctedDeltaB;
      const correctedBefore = isPlayerA ? ratingA : ratingB;
      const correctedAfter = isPlayerA ? correctedFinalA : correctedFinalB;

      if (
        row.valor !== correctedDelta ||
        row.rating_antes !== correctedBefore ||
        row.rating_depois !== correctedAfter
      ) {
        transactionUpdates.push({
          id: row.id,
          valor: correctedDelta,
          rating_antes: correctedBefore,
          rating_depois: correctedAfter,
        });
      }
    }

    correctedRatings.set(match.player_a_id, correctedFinalA);
    correctedRatings.set(match.player_b_id, correctedFinalB);

    const winnerStats = correctedStats.get(winnerId) ?? { wins: 0, losses: 0, games: 0 };
    winnerStats.wins += 1;
    winnerStats.games += 1;
    correctedStats.set(winnerId, winnerStats);

    const loserStats = correctedStats.get(loserId) ?? { wins: 0, losses: 0, games: 0 };
    loserStats.losses += 1;
    loserStats.games += 1;
    correctedStats.set(loserId, loserStats);
  }

  const incorrectUsers = users
    .map((user) => {
      const corrected = correctedRatings.get(user.id);
      const stats = correctedStats.get(user.id) ?? { wins: 0, losses: 0, games: 0 };

      return {
        id: user.id,
        player: getDisplayName(user),
        current: user.rating_atual,
        corrected,
        diff: corrected - user.rating_atual,
        statsMatch:
          user.vitorias === stats.wins &&
          user.derrotas === stats.losses &&
          user.jogos_disputados === stats.games,
      };
    })
    .filter((user) => user.current !== user.corrected)
    .sort((left, right) => {
      const byDiff = Math.abs(right.diff) - Math.abs(left.diff);
      if (byDiff !== 0) return byDiff;
      return left.player.localeCompare(right.player, "pt-BR");
    });

  const userUpdates = incorrectUsers.map((user) => ({
    id: user.id,
    rating_atual: user.corrected,
  }));

  const summary = {
    projectUrl: supabaseUrl,
    mode: APPLY_CHANGES ? "apply" : "dry-run",
    validatedMatches: validatedMatches.length,
    matchUpdates: matchUpdates.length,
    transactionUpdates: transactionUpdates.length,
    userUpdates: userUpdates.length,
    incorrectUsers: incorrectUsers.map(formatUserDiff),
  };

  if (!APPLY_CHANGES) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  await applyRowUpdates("matches", matchUpdates);
  await applyRowUpdates("rating_transactions", transactionUpdates);
  await applyRowUpdates("users", userUpdates);

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
