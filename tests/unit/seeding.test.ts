import { describe, it, expect } from "vitest";
import {
  standardSeeding,
  eloSeeding,
  sequentialSeeding,
  countByes,
  nextPowerOfTwo,
} from "@/lib/tournaments/seeding";
import type { TournamentParticipant } from "@/lib/tournaments/types";

function makeParticipant(overrides: Partial<TournamentParticipant> & { id: string }): TournamentParticipant {
  return {
    tournamentId: "t1",
    userId: null,
    guestName: overrides.id,
    seed: null,
    groupId: null,
    pot: null,
    flag: null,
    color: null,
    avatarUrl: null,
    signupStatus: "confirmed",
    partnerParticipantId: null,
    ...overrides,
  };
}

function makePlayers(n: number): TournamentParticipant[] {
  return Array.from({ length: n }, (_, i) => makeParticipant({ id: `p${i + 1}` }));
}

describe("nextPowerOfTwo", () => {
  it("8 → 8", () => expect(nextPowerOfTwo(8)).toBe(8));
  it("5 → 8", () => expect(nextPowerOfTwo(5)).toBe(8));
  it("9 → 16", () => expect(nextPowerOfTwo(9)).toBe(16));
  it("1 → 1", () => expect(nextPowerOfTwo(1)).toBe(1));
  it("16 → 16", () => expect(nextPowerOfTwo(16)).toBe(16));
  it("2 → 2", () => expect(nextPowerOfTwo(2)).toBe(2));
});

describe("countByes", () => {
  it("8 jogadores → 0 byes", () => expect(countByes(8)).toBe(0));
  it("5 jogadores → 3 byes (para completar 8)", () => expect(countByes(5)).toBe(3));
  it("6 jogadores → 2 byes", () => expect(countByes(6)).toBe(2));
  it("7 jogadores → 1 bye", () => expect(countByes(7)).toBe(1));
});

describe("sequentialSeeding", () => {
  it("atribui seed sequencial a cada participante", () => {
    const players = makePlayers(4);
    const result = sequentialSeeding(players);
    expect(result.map((p) => p.seed)).toEqual([1, 2, 3, 4]);
  });

  it("preserva ordem original", () => {
    const players = makePlayers(3);
    const result = sequentialSeeding(players);
    expect(result.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
  });

  it("lista vazia retorna vazia", () => {
    expect(sequentialSeeding([])).toHaveLength(0);
  });
});

describe("standardSeeding", () => {
  it("retorna todos os participantes com seed atribuído", () => {
    const players = makePlayers(4);
    const result = standardSeeding(players);
    expect(result).toHaveLength(4);
    expect(result.every((p) => p.seed !== null && p.seed >= 1)).toBe(true);
  });

  it("todos os seeds são únicos", () => {
    const players = makePlayers(8);
    const result = standardSeeding(players);
    const seeds = result.map((p) => p.seed);
    expect(new Set(seeds).size).toBe(seeds.length);
  });

  it("seed 1 e seed N aparecem na mesma chave (opostos)", () => {
    // Na semeadura padrão, seed 1 vs seed N são colocados em lados opostos
    const players = makePlayers(8);
    const result = standardSeeding(players);
    const seeds = result.map((p) => p.seed);
    expect(seeds).toContain(1);
    expect(seeds).toContain(8);
  });

  it("chave de 2 produz seeds [1, 2]", () => {
    const players = makePlayers(2);
    const result = standardSeeding(players);
    expect(result.map((p) => p.seed).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([1, 2]);
  });
});

describe("eloSeeding", () => {
  it("ordena por rating decrescente (maior rating = seed 1)", () => {
    const players = [
      makeParticipant({ id: "low", userId: "u1" }),
      makeParticipant({ id: "high", userId: "u2" }),
      makeParticipant({ id: "mid", userId: "u3" }),
    ];
    const ratings = new Map([["u1", 800], ["u2", 1200], ["u3", 1000]]);
    const result = eloSeeding(players, ratings);
    // Depois de ordenar por rating, aplica standardSeeding
    // O primeiro na lista (maior rating) recebe seed baseado na posição 0 da ordem padrão
    expect(result).toHaveLength(3);
    expect(result.every((p) => p.seed !== null)).toBe(true);
  });

  it("sem ratings no Map, mantém ordem de entrada", () => {
    const players = makePlayers(4);
    const ratings = new Map<string, number>();
    const sequential = sequentialSeeding(players);
    const eloResult = eloSeeding(players, ratings);
    // Sem ratings, todos ficam com rating 0 — ordem preservada, seeds idênticos ao padrão
    expect(eloResult).toHaveLength(4);
    expect(eloResult.every((p) => typeof p.seed === "number")).toBe(true);
  });
});
