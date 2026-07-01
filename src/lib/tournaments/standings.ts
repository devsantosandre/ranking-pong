import type { TournamentMatch, TournamentParticipant, GroupStanding } from "./types";

type Stats = {
  participantId: string;
  groupId: string;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  gamePointsWon: number;
  gamePointsLost: number;
  points: number;
};

/** Razão ITTF: 0/0 → 0 (neutro); w/0 (w>0) → Infinity; senão w/l. */
function ratio(won: number, lost: number): number {
  if (lost === 0) return won === 0 ? 0 : Infinity;
  return won / lost;
}

/** Métricas de um jogador considerando APENAS as partidas de `matches`
 * (mini-tabela entre os empatados). */
function miniMetrics(id: string, matches: TournamentMatch[]) {
  let points = 0, setsWon = 0, setsLost = 0, gameWon = 0, gameLost = 0;
  for (const m of matches) {
    const isA = m.participantAId === id;
    const isB = m.participantBId === id;
    if (!isA && !isB) continue;
    setsWon += isA ? (m.scoreA ?? 0) : (m.scoreB ?? 0);
    setsLost += isA ? (m.scoreB ?? 0) : (m.scoreA ?? 0);
    if (m.winnerParticipantId === id) points += 3;
    for (const [a, b] of m.sets ?? []) {
      gameWon += isA ? a : b;
      gameLost += isA ? b : a;
    }
  }
  return { points, setsWon, setsLost, gameWon, gameLost };
}

/** Desempate oficial ITTF/CBTM entre os empatados (`tied`), progressivo:
 * (1) pontos de vitória → (2) razão de sets → (3) razão de pontos de game,
 * calculados SÓ nas partidas entre os empatados. Assim que um subconjunto se
 * distingue, ele é fixado e o critério recomeça entre os que seguem iguais. */
function breakTies(tied: Stats[], groupMatches: TournamentMatch[]): Stats[] {
  if (tied.length <= 1) return tied;

  const ids = new Set(tied.map((t) => t.participantId));
  const mini = groupMatches.filter(
    (m) => m.participantAId && m.participantBId && ids.has(m.participantAId) && ids.has(m.participantBId),
  );
  const metric = new Map(tied.map((t) => [t.participantId, miniMetrics(t.participantId, mini)]));

  const key = (id: string) => {
    const m = metric.get(id)!;
    return [m.points, ratio(m.setsWon, m.setsLost), ratio(m.gameWon, m.gameLost)] as const;
  };

  const sorted = [...tied].sort((a, b) => {
    const [pa, sa, ga] = key(a.participantId);
    const [pb, sb, gb] = key(b.participantId);
    return pb - pa || sb - sa || gb - ga;
  });

  const sameRank = (a: string, b: string) => {
    const [pa, sa, ga] = key(a);
    const [pb, sb, gb] = key(b);
    return pa === pb && sa === sb && ga === gb;
  };

  // Aplicação progressiva: agrupa quem ficou idêntico nos 3 critérios e recursa,
  // recomputando a mini-tabela só entre eles. Se o bloco inteiro é indistinguível
  // (run === tied), mantém a ordem estável para evitar recursão infinita.
  const result: Stats[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && sameRank(sorted[i]!.participantId, sorted[j]!.participantId)) j++;
    const run = sorted.slice(i, j);
    if (run.length === 1 || run.length === tied.length) {
      result.push(...run);
    } else {
      result.push(...breakTies(run, groupMatches));
    }
    i = j;
  }
  return result;
}

/**
 * Computa a classificação dos grupos a partir das partidas e participantes.
 * Ordena por pontos de vitória e aplica o desempate oficial ITTF entre empatados.
 * Função pura — sem efeitos colaterais, testável.
 */
export function computeGroupStandings(
  allMatches: TournamentMatch[],
  allParticipants: TournamentParticipant[],
): GroupStanding[] {
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
        gamePointsWon: 0,
        gamePointsLost: 0,
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

    for (const [ga, gb] of m.sets ?? []) {
      a.gamePointsWon += ga;
      a.gamePointsLost += gb;
      b.gamePointsWon += gb;
      b.gamePointsLost += ga;
    }

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

  const byGroup = new Map<string, Stats[]>();
  for (const s of stats.values()) {
    const list = byGroup.get(s.groupId) ?? [];
    list.push(s);
    byGroup.set(s.groupId, list);
  }

  const result: GroupStanding[] = [];
  for (const [groupId, list] of byGroup) {
    const gMatches = groupMatches.filter((m) => m.groupId === groupId);

    // Ordena por pontos desc e desempata cada bloco de pontos iguais (ITTF).
    const byPoints = [...list].sort((a, b) => b.points - a.points);
    const ordered: Stats[] = [];
    let i = 0;
    while (i < byPoints.length) {
      let j = i + 1;
      while (j < byPoints.length && byPoints[j]!.points === byPoints[i]!.points) j++;
      const block = byPoints.slice(i, j);
      ordered.push(...(block.length > 1 ? breakTies(block, gMatches) : block));
      i = j;
    }

    ordered.forEach((s, idx) => {
      result.push({
        participantId: s.participantId,
        groupId: s.groupId,
        wins: s.wins,
        losses: s.losses,
        setsWon: s.setsWon,
        setsLost: s.setsLost,
        gamePointsWon: s.gamePointsWon,
        gamePointsLost: s.gamePointsLost,
        points: s.points,
        position: idx + 1,
        tiebreak: null,
      });
    });
  }

  return result;
}
