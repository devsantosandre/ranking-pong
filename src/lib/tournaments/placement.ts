import type { TournamentMatch } from "./types";

/**
 * Disputa de 3º lugar (bracket "placement").
 *
 * Em eliminatória, os perdedores das duas semifinais se enfrentam: vencedor = 3º,
 * perdedor = 4º (padrão ITTF/tênis de mesa). A partida não usa o ponteiro de
 * vencedor (`nextMatchId`) — em vez disso, derivamos seus participantes dos
 * PERDEDORES das semis sempre que ambas terminam. Assim não precisamos de coluna
 * de "loser pointer" e a correção de uma semi recalcula o 3º automaticamente.
 */

/** A final = winners sem `nextMatchId`, de menor round. */
export function findFinalMatch(matches: TournamentMatch[]): TournamentMatch | null {
  const finals = matches.filter((m) => m.bracket === "winners" && m.nextMatchId === null);
  if (finals.length === 0) return null;
  return finals.reduce((a, b) => (a.round <= b.round ? a : b));
}

/** Semifinais = winners cujo `nextMatchId` aponta para a final. */
export function findSemifinals(matches: TournamentMatch[]): TournamentMatch[] {
  const final = findFinalMatch(matches);
  if (!final) return [];
  return matches
    .filter((m) => m.bracket === "winners" && m.nextMatchId === final.id)
    .sort((a, b) => a.slot - b.slot);
}

export function findPlacementMatch(matches: TournamentMatch[]): TournamentMatch | null {
  return matches.find((m) => m.bracket === "placement") ?? null;
}

/** Quantas semis já terminaram — usado para travar o toggle ("até as semis acabarem"). */
export function finishedSemisCount(matches: TournamentMatch[]): number {
  return findSemifinals(matches).filter((s) => s.status === "finished").length;
}

function loserOf(m: TournamentMatch): string | null {
  if (m.status !== "finished" || !m.winnerParticipantId) return null;
  if (!m.participantAId || !m.participantBId) return null;
  return m.winnerParticipantId === m.participantAId ? m.participantBId : m.participantAId;
}

/** Registro vazio da disputa de 3º lugar (round 1, junto da final). */
export function buildPlacementMatch(tournamentId: string, id: string): TournamentMatch {
  return {
    id, tournamentId, round: 1, bracket: "placement", slot: 1,
    groupId: null, participantAId: null, participantBId: null,
    scoreA: null, scoreB: null, sets: null, winnerParticipantId: null,
    nextMatchId: null, nextMatchSlot: null, status: "pending",
    deadlineAt: null, scheduledAt: null, tableNo: null, startedAt: null, finishedAt: null,
  };
}

function resetPlacement(p: TournamentMatch, a: string | null, b: string | null) {
  p.participantAId = a;
  p.participantBId = b;
  p.scoreA = null;
  p.scoreB = null;
  p.sets = null;
  p.winnerParticipantId = null;
  p.finishedAt = null;
  p.status = a && b ? "scheduled" : "pending";
}

/**
 * Preenche a disputa de 3º com os perdedores das semis. Muta a lista in-place.
 * Idempotente: só mexe quando algo de fato mudou (evita apagar resultado já lançado).
 */
export function syncPlacementMatch(matches: TournamentMatch[]): void {
  const placement = findPlacementMatch(matches);
  if (!placement) return;
  const semis = findSemifinals(matches);
  if (semis.length !== 2) return;

  const bothDone = semis.every((s) => s.status === "finished" && s.winnerParticipantId);
  if (!bothDone) {
    // Ainda não dá pra saber os 2 perdedores — zera se havia algo.
    if (placement.participantAId || placement.participantBId || placement.winnerParticipantId) {
      resetPlacement(placement, null, null);
    }
    return;
  }

  const [la, lb] = semis.map(loserOf);
  // Perdedores mudaram (correção de semi) → recompõe e descarta resultado antigo.
  if (placement.participantAId !== la || placement.participantBId !== lb) {
    resetPlacement(placement, la ?? null, lb ?? null);
  }
}
