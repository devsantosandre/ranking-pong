/**
 * Probabilidade de vitória baseada em ELO.
 * Retorna a probabilidade de A vencer B (0..1).
 */
export function winProbability(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/** Retorna { pA, pB } como percentual inteiro (0-100). */
export function matchProbabilities(
  ratingA: number,
  ratingB: number,
): { pA: number; pB: number } {
  const pA = winProbability(ratingA, ratingB);
  return { pA: Math.round(pA * 100), pB: Math.round((1 - pA) * 100) };
}

/** Classifica se é zebra: seed baixo (mais fraco) vence seed alto (mais forte). */
export function isUpset(seedWinner: number, seedLoser: number): boolean {
  return seedWinner > seedLoser;
}
