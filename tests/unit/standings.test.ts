import { describe, it, expect } from "vitest";
import { computeGroupStandings } from "@/lib/tournaments/standings";
import type { TournamentMatch, TournamentParticipant } from "@/lib/tournaments/types";

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

  it("desempate por saldo de sets quando pontos iguais", () => {
    // pA e pB ambos com 0 partidas ganhas. pA tem saldo positivo, pB negativo
    const m1 = makeGroupMatch("m1", "pA", "pC", 2, 1, "pA"); // pA: 3pts, saldo +1
    const m2 = makeGroupMatch("m2", "pB", "pC", 0, 2, "pC"); // pB: 0pts, saldo -2; pC: 6pts
    // pC=6pts, pA=3pts, pB=0pts
    const result = computeGroupStandings([m1, m2], [P_A, P_B, P_C]);
    const byId = Object.fromEntries(result.map((s) => [s.participantId, s]));
    expect(byId["pC"].position).toBe(1);
    expect(byId["pA"].position).toBe(2);
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
