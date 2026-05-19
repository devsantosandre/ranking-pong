import { describe, it, expect } from "vitest";
import { calculateElo, calculateNewRatings, expectedScore } from "@/lib/elo";

describe("ELO — regras de negócio do ranking", () => {
  it("expectativa é 0.5 para ratings iguais", () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5, 5);
  });

  it("jogo equilibrado com K=24 vai resultar em +12/-12", () => {
    const { winnerDelta, loserDelta } = calculateElo(1000, 1000, 24);
    expect(winnerDelta).toBe(12);
    expect(loserDelta).toBe(-12);
  });

  it("favorito que ganha leva menos pontos", () => {
    const { winnerDelta, loserDelta } = calculateElo(1200, 800, 24);
    expect(winnerDelta).toBeLessThan(12);
    expect(loserDelta).toBeGreaterThan(-12);
    expect(winnerDelta + loserDelta).toBe(0);
  });

  it("zebra (mais fraco vence) leva mais pontos", () => {
    const { winnerDelta, loserDelta } = calculateElo(800, 1200, 24);
    expect(winnerDelta).toBeGreaterThan(12);
    expect(loserDelta).toBeLessThan(-12);
    expect(winnerDelta + loserDelta).toBe(0);
  });

  it("calculateNewRatings aplica o delta corretamente", () => {
    const { winnerNewRating, loserNewRating, winnerDelta, loserDelta } =
      calculateNewRatings(1000, 1000, 24);
    expect(winnerNewRating).toBe(1000 + winnerDelta);
    expect(loserNewRating).toBe(1000 + loserDelta);
  });

  it("K customizado escala o impacto", () => {
    const k16 = calculateElo(1000, 1000, 16);
    const k32 = calculateElo(1000, 1000, 32);
    expect(Math.abs(k32.winnerDelta)).toBeGreaterThan(Math.abs(k16.winnerDelta));
  });
});
