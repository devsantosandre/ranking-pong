import type { TournamentMatch, TournamentParticipant, GroupStanding } from "./types";

/**
 * Computa a classificação dos grupos a partir das partidas e participantes.
 * Função pura — sem efeitos colaterais, testável.
 */
export function computeGroupStandings(
  allMatches: TournamentMatch[],
  allParticipants: TournamentParticipant[],
): GroupStanding[] {
  type Stats = {
    participantId: string;
    groupId: string;
    wins: number;
    losses: number;
    setsWon: number;
    setsLost: number;
    points: number;
  };

  const stats = new Map<string, Stats>();
  for (const p of allParticipants) {
    if (p.groupId) {
      stats.set(p.id, {
        participantId: p.id,
        groupId: p.groupId,
        wins: 0,
        losses: 0,
        setsWon: 0,
        setsLost: 0,
        points: 0,
      });
    }
  }

  const groupMatches = allMatches.filter(
    (m) => m.bracket === "group" && m.status === "finished" && m.participantAId && m.participantBId,
  );

  for (const m of groupMatches) {
    const a = stats.get(m.participantAId!);
    const b = stats.get(m.participantBId!);
    if (!a || !b) continue;

    a.setsWon += m.scoreA ?? 0;
    a.setsLost += m.scoreB ?? 0;
    b.setsWon += m.scoreB ?? 0;
    b.setsLost += m.scoreA ?? 0;

    if (m.winnerParticipantId === m.participantAId) {
      a.wins++;
      a.points += 3;
      b.losses++;
    } else {
      b.wins++;
      b.points += 3;
      a.losses++;
    }
  }

  const byGroup = new Map<string, GroupStanding[]>();
  for (const s of stats.values()) {
    const list = byGroup.get(s.groupId) ?? [];
    list.push({ ...s, position: 0 });
    byGroup.set(s.groupId, list);
  }

  const result: GroupStanding[] = [];
  for (const list of byGroup.values()) {
    // Ordem: pontos desc → saldo de sets desc → setsWon desc
    list.sort(
      (a, b) =>
        b.points - a.points ||
        (b.setsWon - b.setsLost) - (a.setsWon - a.setsLost) ||
        b.setsWon - a.setsWon,
    );
    list.forEach((s, i) => {
      s.position = i + 1;
    });
    result.push(...list);
  }

  return result;
}
