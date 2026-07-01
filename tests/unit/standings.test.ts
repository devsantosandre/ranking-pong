import { describe, it, expect } from "vitest";
import { computeGroupStandings } from "@/lib/tournaments/standings";
import type { TournamentMatch, TournamentParticipant, GroupStanding } from "@/lib/tournaments/types";

function makeParticipant(id: string, groupId: string): TournamentParticipant {
  return {
    id,
    tournamentId: "t1",
    userId: null,
    guestName: id,
    seed: null,
    groupId,
    pot: null,
    flag: null,
    avatarUrl: null,
    color: null,
    signupStatus: "confirmed",
    partnerParticipantId: null,
  };
}

function makeGroupMatch(
  id: string,
  aId: string,
  bId: string,
  scoreA: number,
  scoreB: number,
  winnerId: string,
): TournamentMatch {
  return {
    id,
    tournamentId: "t1",
    round: 100,
    bracket: "group",
    slot: 0,
    groupId: "A",
    participantAId: aId,
    participantBId: bId,
    scoreA,
    scoreB,
    sets: null,
    winnerParticipantId: winnerId,
    nextMatchId: null,
    nextMatchSlot: null,
    status: "finished",
    deadlineAt: null,
    scheduledAt: null,
    tableNo: null,
    startedAt: null,
    finishedAt: "2026-01-01T00:00:00Z",
  };
}

const P_A = makeParticipant("pA", "A");
const P_B = makeParticipant("pB", "A");
const P_C = makeParticipant("pC", "A");

describe("computeGroupStandings", () => {
  it("retorna lista vazia para sem partidas e sem participantes", () => {
    expect(computeGroupStandings([], [])).toHaveLength(0);
  });

  it("participantes sem groupId não aparecem", () => {
    const p = { ...P_A, groupId: null };
    expect(computeGroupStandings([], [p])).toHaveLength(0);
  });

  it("com participantes mas sem partidas: todos com 0 pontos", () => {
    const result = computeGroupStandings([], [P_A, P_B]);
    expect(result).toHaveLength(2);
    expect(result.every((s) => s.points === 0 && s.wins === 0 && s.losses === 0)).toBe(true);
  });

  it("vencedor recebe 3 pontos, perdedor fica com 0", () => {
    const m = makeGroupMatch("m1", "pA", "pB", 2, 0, "pA");
    const result = computeGroupStandings([m], [P_A, P_B]);
    const sA = result.find((s) => s.participantId === "pA")!;
    const sB = result.find((s) => s.participantId === "pB")!;
    expect(sA.points).toBe(3);
    expect(sB.points).toBe(0);
    expect(sA.wins).toBe(1);
    expect(sB.losses).toBe(1);
  });

  it("setsWon e setsLost são computados corretamente", () => {
    const m = makeGroupMatch("m1", "pA", "pB", 2, 1, "pA");
    const result = computeGroupStandings([m], [P_A, P_B]);
    const sA = result.find((s) => s.participantId === "pA")!;
    const sB = result.find((s) => s.participantId === "pB")!;
    expect(sA.setsWon).toBe(2);
    expect(sA.setsLost).toBe(1);
    expect(sB.setsWon).toBe(1);
    expect(sB.setsLost).toBe(2);
  });

  it("ordena por pontos decrescentes", () => {
    const m1 = makeGroupMatch("m1", "pA", "pB", 2, 0, "pA");
    const m2 = makeGroupMatch("m2", "pA", "pC", 2, 0, "pA");
    const m3 = makeGroupMatch("m3", "pB", "pC", 2, 0, "pB");
    const result = computeGroupStandings([m1, m2, m3], [P_A, P_B, P_C]);
    const ids = result.map((s) => s.participantId);
    // pA=6pts, pB=3pts, pC=0pts
    expect(ids[0]).toBe("pA");
    expect(ids[1]).toBe("pB");
    expect(ids[2]).toBe("pC");
  });

  it("position começa em 1", () => {
    const result = computeGroupStandings([], [P_A, P_B]);
    const positions = result.map((s) => s.position).sort((a, b) => a - b);
    expect(positions[0]).toBe(1);
    expect(positions[1]).toBe(2);
  });

  it("empate de pontos: confronto direto (mini-tabela) decide — ITTF critério 1", () => {
    // pA vence pC; pC vence pB. pA e pC empatam em 3 pts. Entre eles, pA venceu → pA 1º.
    const m1 = makeGroupMatch("m1", "pA", "pC", 2, 1, "pA"); // pA 3pts (venceu o confronto direto)
    const m2 = makeGroupMatch("m2", "pB", "pC", 0, 2, "pC"); // pC 3pts, pB 0pts
    const result = computeGroupStandings([m1, m2], [P_A, P_B, P_C]);
    const byId = Object.fromEntries(result.map((s) => [s.participantId, s]));
    expect(byId["pA"].position).toBe(1); // venceu pC no confronto direto
    expect(byId["pC"].position).toBe(2);
    expect(byId["pB"].position).toBe(3);
  });

  it("ignora partidas não finalizadas", () => {
    const m: TournamentMatch = {
      ...makeGroupMatch("m1", "pA", "pB", 2, 0, "pA"),
      status: "pending",
      winnerParticipantId: null,
      scoreA: null,
      scoreB: null,
    };
    const result = computeGroupStandings([m], [P_A, P_B]);
    expect(result.every((s) => s.wins === 0 && s.points === 0)).toBe(true);
  });

  it("ignora partidas que não são de grupo (bracket !== group)", () => {
    const m: TournamentMatch = {
      ...makeGroupMatch("m1", "pA", "pB", 2, 0, "pA"),
      bracket: "winners",
      round: 1,
    };
    const result = computeGroupStandings([m], [P_A, P_B]);
    expect(result.every((s) => s.points === 0)).toBe(true);
  });

  it("dois grupos independentes: posição começa em 1 em cada", () => {
    const pX = makeParticipant("pX", "B");
    const pY = makeParticipant("pY", "B");
    const mB = { ...makeGroupMatch("m2", "pX", "pY", 2, 0, "pX"), groupId: "B" };
    const mA = makeGroupMatch("m1", "pA", "pB", 2, 0, "pA");
    const result = computeGroupStandings([mA, mB], [P_A, P_B, pX, pY]);
    const byGroup = Object.groupBy(result, (s) => s.groupId);
    expect(byGroup["A"]?.map((s) => s.position).sort()).toEqual([1, 2]);
    expect(byGroup["B"]?.map((s) => s.position).sort()).toEqual([1, 2]);
  });
});

// ── Desempate oficial ITTF/CBTM (Bloco B) ──
function setsMatch(id: string, aId: string, bId: string, sets: Array<[number, number]>): TournamentMatch {
  const scoreA = sets.filter(([a, b]) => a > b).length;
  const scoreB = sets.filter(([a, b]) => b > a).length;
  const winnerId = scoreA > scoreB ? aId : bId;
  return { ...makeGroupMatch(id, aId, bId, scoreA, scoreB, winnerId), sets };
}

const posOf = (r: GroupStanding[]) => Object.fromEntries(r.map((s) => [s.participantId, s.position]));

describe("desempate ITTF — pontos de game e razões", () => {
  it("gamePointsWon/Lost derivados de match.sets", () => {
    const m = setsMatch("m1", "pA", "pB", [[11, 7], [9, 11], [11, 8]]); // pA 2-1
    const r = computeGroupStandings([m], [P_A, P_B]);
    const sA = r.find((s) => s.participantId === "pA")!;
    const sB = r.find((s) => s.participantId === "pB")!;
    expect(sA.gamePointsWon).toBe(31); // 11+9+11
    expect(sA.gamePointsLost).toBe(26); // 7+11+8
    expect(sB.gamePointsWon).toBe(26);
    expect(sB.gamePointsLost).toBe(31);
  });

  it("empate duplo em dois pares: cada par decidido pelo confronto direto", () => {
    const pD = makeParticipant("pD", "A");
    const ms = [
      makeGroupMatch("m1", "pB", "pA", 2, 0, "pB"), // pB vence pA (confronto direto do par de cima)
      makeGroupMatch("m2", "pA", "pC", 2, 0, "pA"),
      makeGroupMatch("m3", "pA", "pD", 2, 0, "pA"),
      makeGroupMatch("m4", "pB", "pC", 2, 0, "pB"),
      makeGroupMatch("m5", "pD", "pB", 2, 0, "pD"),
      makeGroupMatch("m6", "pC", "pD", 2, 0, "pC"), // pC vence pD (par de baixo)
    ];
    // pA=6, pB=6 (empate topo); pC=3, pD=3 (empate baixo)
    const pos = posOf(computeGroupStandings(ms, [P_A, P_B, P_C, pD]));
    expect(pos["pB"]).toBe(1); // venceu pA
    expect(pos["pA"]).toBe(2);
    expect(pos["pC"]).toBe(3); // venceu pD
    expect(pos["pD"]).toBe(4);
  });

  it("empate triplo (ciclo) resolvido por razão de sets — aplicação progressiva", () => {
    const ms = [
      makeGroupMatch("m1", "pA", "pB", 2, 0, "pA"), // pA sets 3-2 → 1.5
      makeGroupMatch("m2", "pB", "pC", 2, 0, "pB"), // pB sets 2-2 → 1.0
      makeGroupMatch("m3", "pC", "pA", 2, 1, "pC"), // pC sets 2-3 → 0.67
    ];
    const pos = posOf(computeGroupStandings(ms, [P_A, P_B, P_C]));
    expect(pos["pA"]).toBe(1);
    expect(pos["pB"]).toBe(2);
    expect(pos["pC"]).toBe(3);
  });

  it("empate triplo com razão de sets igual → decide razão de pontos de game", () => {
    // Ciclo com todos 2-1 (razão de sets = 1.0 para todos); pontos de game diferem.
    const ms = [
      setsMatch("m1", "pA", "pB", [[11, 0], [0, 11], [11, 0]]), // pA vence grande (game 22-11)
      setsMatch("m2", "pB", "pC", [[11, 9], [9, 11], [11, 9]]), // pB vence apertado
      setsMatch("m3", "pC", "pA", [[11, 9], [9, 11], [11, 9]]), // pC vence pA apertado
    ];
    const pos = posOf(computeGroupStandings(ms, [P_A, P_B, P_C]));
    // razão de game: pA ~1.21 > pC ~1.0 > pB ~0.82
    expect(pos["pA"]).toBe(1);
    expect(pos["pC"]).toBe(2);
    expect(pos["pB"]).toBe(3);
  });

  it("bordas: sets nulos não quebram (razão de game neutra)", () => {
    // Empate por sets sem placar detalhado: cai em razão de game 0/0 → neutro, ordem estável.
    const ms = [
      makeGroupMatch("m1", "pA", "pB", 2, 1, "pA"),
      makeGroupMatch("m2", "pB", "pC", 2, 1, "pB"),
      makeGroupMatch("m3", "pC", "pA", 2, 1, "pC"),
    ];
    // ciclo simétrico 2-1: pontos e razão de sets iguais; sem sets → não deve lançar erro
    const r = computeGroupStandings(ms, [P_A, P_B, P_C]);
    expect(r).toHaveLength(3);
    expect(new Set(r.map((s) => s.position))).toEqual(new Set([1, 2, 3]));
  });
});
