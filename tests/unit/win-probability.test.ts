import { describe, it, expect } from "vitest";
import { winProbability, matchProbabilities, isUpset } from "@/lib/tournaments/win-probability";

describe("winProbability", () => {
  it("é 0.5 para ratings iguais", () => {
    expect(winProbability(1000, 1000)).toBeCloseTo(0.5, 5);
  });

  it("favorito (maior rating) tem prob > 0.5", () => {
    expect(winProbability(1200, 800)).toBeGreaterThan(0.5);
  });

  it("azarão (menor rating) tem prob < 0.5", () => {
    expect(winProbability(800, 1200)).toBeLessThan(0.5);
  });

  it("prob(A) + prob(B) = 1 (complementar)", () => {
    const pA = winProbability(1100, 900);
    const pB = winProbability(900, 1100);
    expect(pA + pB).toBeCloseTo(1, 10);
  });

  it("probabilidade está em (0,1) para diferença extrema", () => {
    const p = winProbability(2000, 500);
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(1);
  });

  it("usa fórmula ELO com divisor 400 — diferença de 400 pts dá ~75%", () => {
    // Expectativa ELO padrão: 1/(1+10^(400/400)) = 1/(1+10) ≈ 0.0909 para o azarão
    // Logo o favorito ≈ 0.909
    const p = winProbability(1400, 1000);
    expect(p).toBeCloseTo(1 / (1 + Math.pow(10, -400 / 400)), 10);
  });
});

describe("matchProbabilities", () => {
  it("retorna { pA, pB } como percentuais inteiros somando 100", () => {
    const result = matchProbabilities(1200, 800);
    expect(result.pA + result.pB).toBe(100);
  });

  it("favorito tem pA > 50", () => {
    const result = matchProbabilities(1200, 800);
    expect(result.pA).toBeGreaterThan(50);
    expect(result.pB).toBeLessThan(50);
  });

  it("para ratings iguais, pA === pB === 50", () => {
    const result = matchProbabilities(1000, 1000);
    expect(result.pA).toBe(50);
    expect(result.pB).toBe(50);
  });

  it("valores são inteiros (arredondamento por Math.round)", () => {
    const result = matchProbabilities(1100, 950);
    expect(Number.isInteger(result.pA)).toBe(true);
    expect(Number.isInteger(result.pB)).toBe(true);
  });
});

describe("isUpset", () => {
  // isUpset(seedWinner, seedLoser): seed alto = jogador mais fraco
  // zebra = jogador com seed maior (mais fraco) vence jogador com seed menor (mais forte)

  it("seed 8 vencer seed 1 é zebra", () => {
    expect(isUpset(8, 1)).toBe(true);
  });

  it("seed 1 vencer seed 8 NÃO é zebra", () => {
    expect(isUpset(1, 8)).toBe(false);
  });

  it("seed igual nunca é zebra (empate teórico)", () => {
    expect(isUpset(4, 4)).toBe(false);
  });

  it("seed 5 vencer seed 4 é zebra (por 1 posição)", () => {
    expect(isUpset(5, 4)).toBe(true);
  });

  it("seed 2 vencer seed 7 NÃO é zebra", () => {
    expect(isUpset(2, 7)).toBe(false);
  });
});
