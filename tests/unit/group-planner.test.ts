import { describe, it, expect } from "vitest";
import { planGroupSizes, qualifiersCount, snakeGroups } from "@/lib/tournaments/group-planner";

describe("planGroupSizes", () => {
  it("8 → [4,4]", () => {
    expect(planGroupSizes(8)).toEqual([4, 4]);
  });

  it("12 → [3,3,3,3]", () => {
    expect(planGroupSizes(12)).toEqual([3, 3, 3, 3]);
  });

  it("20 → [4,4,3,3,3,3] (6 grupos, sem grupo de 2)", () => {
    expect(planGroupSizes(20)).toEqual([4, 4, 3, 3, 3, 3]);
  });

  it("24 → oito grupos de 3", () => {
    expect(planGroupSizes(24)).toEqual(Array(8).fill(3));
  });

  it("30 → dez grupos de 3", () => {
    expect(planGroupSizes(30)).toEqual(Array(10).fill(3));
  });

  it("100 → 1 grupo de 4 + 32 grupos de 3 (33 grupos)", () => {
    expect(planGroupSizes(100)).toEqual([4, ...Array(32).fill(3)]);
  });

  it("5 → tamanhos em {2,3} somando 5", () => {
    const sizes = planGroupSizes(5);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(5);
    expect(sizes.every((s) => s === 2 || s === 3)).toBe(true);
    expect(sizes.some((s) => s === 2)).toBe(true);
  });

  it("todos os tamanhos ficam em {2,3,4} e somam n", () => {
    for (const n of [8, 9, 11, 12, 13, 17, 20, 23, 24, 30, 50, 100]) {
      const sizes = planGroupSizes(n);
      expect(sizes.reduce((a, b) => a + b, 0)).toBe(n);
      expect(sizes.every((s) => s >= 2 && s <= 4)).toBe(true);
    }
  });

  it("não gera grupo de 2 quando há divisão só com 3 e 4", () => {
    for (const n of [8, 12, 20, 24, 30, 100]) {
      expect(planGroupSizes(n).every((s) => s !== 2)).toBe(true);
    }
  });

  it("os grupos de 4 vêm antes dos de 3 (ordem estável)", () => {
    const sizes = planGroupSizes(20);
    const firstThree = sizes.indexOf(3);
    const lastFour = sizes.lastIndexOf(4);
    expect(lastFour).toBeLessThan(firstThree);
  });
});

describe("snakeGroups — semeadura serpentina (ITTF 3.6)", () => {
  it("um jogador forte por grupo: seeds 1–8 em grupos distintos, 9–16 na ordem inversa", () => {
    const players = Array.from({ length: 24 }, (_, i) => i + 1); // 1 = mais forte
    const groups = snakeGroups(players, 8);
    expect(groups).toHaveLength(8);
    // seeds 1..8 → grupos 0..7 (um por grupo)
    for (let s = 1; s <= 8; s++) expect(groups[s - 1]![0]).toBe(s);
    // seeds 9..16 voltam invertidos → grupo 7..0
    for (let s = 9; s <= 16; s++) expect(groups[16 - s]![1]).toBe(s);
  });

  it("distribui 24 em 8 grupos de 3 sem sobra", () => {
    const players = Array.from({ length: 24 }, (_, i) => i + 1);
    const groups = snakeGroups(players, 8);
    expect(groups.map((g) => g.length)).toEqual(Array(8).fill(3));
  });

  it("determinismo: mesma entrada → mesma saída", () => {
    const players = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(snakeGroups(players, 6)).toEqual(snakeGroups(players, 6));
  });
});

describe("qualifiersCount (top 2 avançam)", () => {
  it("classificados = 2 × número de grupos", () => {
    expect(qualifiersCount(planGroupSizes(20))).toBe(12); // 6 grupos → 12
    expect(qualifiersCount(planGroupSizes(24))).toBe(16); // 8 grupos → 16
    expect(qualifiersCount(planGroupSizes(8))).toBe(4); // 2 grupos → 4
  });
});
