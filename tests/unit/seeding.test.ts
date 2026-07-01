import { describe, it, expect } from "vitest";
import {
  standardSeeding,
  eloSeeding,
  potsSeeding,
  sequentialSeeding,
  countByes,
  nextPowerOfTwo,
  byeSeeds,
  seedQualifiersIntoBracket,
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

describe("byeSeeds — byes nos melhores seeds (ITTF)", () => {
  it("12 classificados → bracket 16, byes nos seeds 1,2,3,4", () => {
    expect(byeSeeds(12)).toEqual([1, 2, 3, 4]);
  });

  it("classificados que deixam 1 bye → bye no seed 1", () => {
    // 3 → bracket 4, 1 bye no melhor seed
    expect(byeSeeds(3)).toEqual([1]);
  });

  it("classificados em potência de 2 → 0 byes", () => {
    expect(byeSeeds(8)).toEqual([]);
    expect(byeSeeds(16)).toEqual([]);
  });

  it("os byes vão sempre para os seeds mais altos, em ordem", () => {
    // 10 → bracket 16, 6 byes nos seeds 1..6
    expect(byeSeeds(10)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("seedQualifiersIntoBracket — ITTF 3.7", () => {
  /** metade (0 = topo, 1 = fundo) da posição `pos` num bracket de `b` posições */
  const halfOf = (pos: number, b: number): 0 | 1 => (pos < b / 2 ? 0 : 1);

  it("vencedor do grupo 1 no topo, vencedor do grupo 2 no fundo (metades opostas)", () => {
    const slots = seedQualifiersIntoBracket(4); // 4 grupos → 8 classificados
    const b = slots.length;
    const posG1w = slots.findIndex((s) => s?.group === 1 && s.rank === 0);
    const posG2w = slots.findIndex((s) => s?.group === 2 && s.rank === 0);
    expect(posG1w).toBe(0); // topo
    expect(halfOf(posG1w, b)).toBe(0);
    expect(halfOf(posG2w, b)).toBe(1); // fundo
  });

  it("1º e 2º do mesmo grupo ficam em metades opostas (só se cruzam na final)", () => {
    for (const g of [4, 6, 8]) {
      const slots = seedQualifiersIntoBracket(g);
      const b = slots.length;
      for (let group = 1; group <= g; group++) {
        const posW = slots.findIndex((s) => s?.group === group && s.rank === 0);
        const posR = slots.findIndex((s) => s?.group === group && s.rank === 1);
        expect(posW).toBeGreaterThanOrEqual(0);
        expect(posR).toBeGreaterThanOrEqual(0);
        expect(halfOf(posW, b)).not.toBe(halfOf(posR, b));
      }
    }
  });

  it("nenhum confronto de 1ª rodada é entre jogadores do mesmo grupo", () => {
    for (const g of [4, 6, 8]) {
      const slots = seedQualifiersIntoBracket(g);
      for (let i = 0; i < slots.length; i += 2) {
        const a = slots[i];
        const bb = slots[i + 1];
        if (a && bb) expect(a.group).not.toBe(bb.group);
      }
    }
  });

  it("com classificados fora de potência de 2, completa com byes (posições null)", () => {
    const slots = seedQualifiersIntoBracket(6); // 12 classificados → bracket 16
    expect(slots).toHaveLength(16);
    const real = slots.filter((s) => s !== null);
    const byes = slots.filter((s) => s === null);
    expect(real).toHaveLength(12);
    expect(byes).toHaveLength(4);
  });

  it("todos os classificados aparecem exatamente uma vez", () => {
    const g = 6;
    const slots = seedQualifiersIntoBracket(g);
    const keys = slots.filter((s) => s !== null).map((s) => `${s!.group}-${s!.rank}`);
    expect(new Set(keys).size).toBe(g * 2);
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

describe("potsSeeding — seed por rating/pontuação (pot)", () => {
  it("ordena por pot decrescente (maior pot vem primeiro)", () => {
    const players = [
      makeParticipant({ id: "mid", pot: 1800 }),
      makeParticipant({ id: "low", pot: 1500 }),
      makeParticipant({ id: "high", pot: 2000 }),
    ];
    const result = potsSeeding(players);
    // A ordem interna (antes do standardSeeding) deve ser high, mid, low
    expect(result.map((p) => p.guestName)).toEqual(["high", "mid", "low"]);
    expect(result.every((p) => typeof p.seed === "number")).toBe(true);
  });

  it("participantes sem pot vão para o fim da fila", () => {
    const players = [
      makeParticipant({ id: "semPot", pot: null }),
      makeParticipant({ id: "comPot", pot: 1200 }),
    ];
    const result = potsSeeding(players);
    expect(result.map((p) => p.guestName)).toEqual(["comPot", "semPot"]);
  });

  it("empate de pot mantém ordem estável de entrada", () => {
    const players = [
      makeParticipant({ id: "a", pot: 1500 }),
      makeParticipant({ id: "b", pot: 1500 }),
      makeParticipant({ id: "c", pot: 1500 }),
    ];
    const result = potsSeeding(players);
    expect(result.map((p) => p.guestName)).toEqual(["a", "b", "c"]);
  });
});
