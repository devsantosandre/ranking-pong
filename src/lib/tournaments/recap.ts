import type { TournamentDetail, TournamentMatch, TournamentParticipant } from "./types";

/** Nome de exibição de um participante (mesma regra usada nas telas de torneio). */
export function participantName(p: TournamentParticipant | undefined | null): string {
  if (!p) return "—";
  return p.guestName ?? (p.seed != null ? `Jogador #${p.seed}` : `Jogador ${p.id.slice(0, 4)}`);
}

export interface RecapPlayer {
  participantId: string;
  name: string;
  userId: string | null;
  flag: string | null;
  seed: number | null;
}

/** Uma partida da campanha do campeão, já resolvida para exibição. */
export interface RecapPathStep {
  matchId: string;
  roundLabel: string;
  opponentName: string;
  championScore: number;
  opponentScore: number;
  sets: Array<[number, number]> | null;
  /** sets já orientados com o campeão à esquerda */
  championSets: Array<[number, number]> | null;
}

export interface TournamentRecap {
  champion: RecapPlayer | null;
  runnerUp: RecapPlayer | null;
  /** terceiros colocados (perdedores das semifinais) — usado quando NÃO há disputa de 3º */
  semifinalists: RecapPlayer[];
  /** disputa de 3º lugar (quando habilitada e jogada): 3º = vencedor, 4º = perdedor */
  thirdPlace: RecapPlayer | null;
  fourthPlace: RecapPlayer | null;
  /** placar da final, orientado com o campeão à esquerda */
  finalChampionScore: number | null;
  finalOpponentScore: number | null;
  finalSets: Array<[number, number]> | null;
  participantCount: number;
  matchesPlayed: number;
  finishedAt: string | null;
  /** campanha do campeão, da primeira partida até a final */
  championPath: RecapPathStep[];
}

/**
 * Rótulo da rodada para chave de eliminação, onde round=1 é a final
 * (numeração decrescente em direção ao título, igual à engine do mock).
 */
function roundLabel(round: number, maxRound: number): string {
  if (round === 1) return "Final";
  if (round === 2) return "Semifinal";
  if (round === 3) return "Quartas";
  if (round === 4) return "Oitavas";
  // fallback genérico para chaves grandes
  const fromTop = maxRound - round + 1;
  return `${fromTop}ª rodada`;
}

/** Deriva um resumo amigável de um torneio (idealmente finalizado). */
export function getTournamentRecap(detail: TournamentDetail): TournamentRecap {
  const byId = new Map(detail.participants.map((p) => [p.id, p]));
  const toPlayer = (id: string | null): RecapPlayer | null => {
    if (!id) return null;
    const p = byId.get(id);
    if (!p) return null;
    return { participantId: p.id, name: participantName(p), userId: p.userId, flag: p.flag, seed: p.seed };
  };

  const confirmed = detail.participants.filter((p) => p.signupStatus === "confirmed");
  const finishedMatches = detail.matches.filter((m) => m.status === "finished");
  // A disputa de 3º (bracket "placement") NÃO entra na detecção da final/campanha.
  const placementMatch = detail.matches.find((m) => m.bracket === "placement") ?? null;
  const knockout = detail.matches.filter((m) => m.bracket !== "group" && m.bracket !== "placement");

  // Final = partida do bracket principal concluída sem próxima partida.
  // Fallback: última partida concluída por finishedAt (fora a disputa de 3º).
  const finalMatch: TournamentMatch | null =
    knockout.find((m) => m.bracket === "winners" && m.status === "finished" && m.nextMatchId == null) ??
    [...finishedMatches]
      .filter((m) => m.bracket !== "placement")
      .sort((a, b) => new Date(b.finishedAt ?? 0).getTime() - new Date(a.finishedAt ?? 0).getTime())[0] ??
    null;

  // Campeão: prioriza o registrado no torneio; senão o vencedor da final.
  let champion: RecapPlayer | null = null;
  if (detail.championUserId || detail.championName) {
    const p = confirmed.find(
      (c) =>
        (detail.championUserId && c.userId === detail.championUserId) ||
        (detail.championName && participantName(c) === detail.championName),
    );
    champion = p
      ? { participantId: p.id, name: participantName(p), userId: p.userId, flag: p.flag, seed: p.seed }
      : { participantId: "", name: detail.championName ?? "Campeão", userId: detail.championUserId, flag: null, seed: null };
  } else if (finalMatch?.winnerParticipantId) {
    champion = toPlayer(finalMatch.winnerParticipantId);
  }

  // Vice e placar da final, orientados com o campeão à esquerda.
  let runnerUp: RecapPlayer | null = null;
  let finalChampionScore: number | null = null;
  let finalOpponentScore: number | null = null;
  let finalSets: Array<[number, number]> | null = null;
  if (finalMatch && champion) {
    const champIsA = finalMatch.participantAId === champion.participantId;
    const loserId = champIsA ? finalMatch.participantBId : finalMatch.participantAId;
    runnerUp = toPlayer(loserId);
    finalChampionScore = champIsA ? finalMatch.scoreA : finalMatch.scoreB;
    finalOpponentScore = champIsA ? finalMatch.scoreB : finalMatch.scoreA;
    finalSets = finalMatch.sets
      ? finalMatch.sets.map((s) => (champIsA ? s : ([s[1], s[0]] as [number, number])))
      : null;
  }

  // Semifinalistas = perdedores das partidas que alimentam a final.
  const semifinalists: RecapPlayer[] = [];
  if (finalMatch) {
    for (const m of knockout) {
      if (m.nextMatchId === finalMatch.id && m.status === "finished" && m.winnerParticipantId) {
        const loserId =
          m.participantAId === m.winnerParticipantId ? m.participantBId : m.participantAId;
        const pl = toPlayer(loserId);
        if (pl) semifinalists.push(pl);
      }
    }
  }

  // Disputa de 3º lugar: 3º = vencedor, 4º = perdedor (quando jogada).
  let thirdPlace: RecapPlayer | null = null;
  let fourthPlace: RecapPlayer | null = null;
  if (placementMatch?.status === "finished" && placementMatch.winnerParticipantId) {
    thirdPlace = toPlayer(placementMatch.winnerParticipantId);
    const loserId =
      placementMatch.participantAId === placementMatch.winnerParticipantId
        ? placementMatch.participantBId
        : placementMatch.participantAId;
    fourthPlace = toPlayer(loserId);
  }

  // Campanha do campeão: todas as partidas concluídas em que jogou, da 1ª à final.
  const championPath: RecapPathStep[] = [];
  if (champion?.participantId) {
    const maxRound = knockout.reduce((mx, m) => Math.max(mx, m.round), 1);
    const mine = knockout
      .filter(
        (m) =>
          m.status === "finished" &&
          (m.participantAId === champion!.participantId ||
            m.participantBId === champion!.participantId),
      )
      .sort((a, b) => b.round - a.round); // round alto = início; round 1 = final
    for (const m of mine) {
      const isA = m.participantAId === champion.participantId;
      const opponentId = isA ? m.participantBId : m.participantAId;
      championPath.push({
        matchId: m.id,
        roundLabel: roundLabel(m.round, maxRound),
        opponentName: participantName(byId.get(opponentId ?? "")),
        championScore: (isA ? m.scoreA : m.scoreB) ?? 0,
        opponentScore: (isA ? m.scoreB : m.scoreA) ?? 0,
        sets: m.sets,
        championSets: m.sets
          ? m.sets.map((s) => (isA ? s : ([s[1], s[0]] as [number, number])))
          : null,
      });
    }
  }

  return {
    champion,
    runnerUp,
    semifinalists,
    thirdPlace,
    fourthPlace,
    finalChampionScore,
    finalOpponentScore,
    finalSets,
    participantCount: confirmed.length,
    matchesPlayed: finishedMatches.length,
    finishedAt: detail.finishedAt,
    championPath,
  };
}
