/**
 * Sistema de Pontuação ELO
 *
 * O ELO calcula pontos baseado na probabilidade esperada de vitória.
 * Jogadores que vencem oponentes mais fortes ganham mais pontos.
 * Jogadores que perdem para oponentes mais fracos perdem mais pontos.
 */

const DEFAULT_K_FACTOR = 24;
const MIN_RATING = 100;

/**
 * Calcula a expectativa de vitória (0 a 1)
 * Quanto maior a diferença de rating a seu favor, maior a expectativa
 */
export function expectedScore(myRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - myRating) / 400));
}

/**
 * Calcula a variação de pontos após uma partida
 *
 * @param winnerRating - Rating atual do vencedor
 * @param loserRating - Rating atual do perdedor
 * @param kFactor - Fator de ajuste (padrão: 24)
 * @returns Objeto com delta do vencedor (positivo) e delta do perdedor (negativo)
 *
 * Exemplos com K=24:
 * - Favorito (1200) vence Fraco (800): vencedor +4, perdedor -4
 * - Jogo igual (1000 vs 1000): vencedor +12, perdedor -12
 * - Zebra! Fraco (800) vence Favorito (1200): vencedor +20, perdedor -20
 */
export function calculateElo(
  winnerRating: number,
  loserRating: number,
  kFactor: number = DEFAULT_K_FACTOR
): { winnerDelta: number; loserDelta: number } {
  // Expectativa de cada jogador
  const expectedWinner = expectedScore(winnerRating, loserRating);
  const expectedLoser = expectedScore(loserRating, winnerRating);

  // Cálculo do delta
  // Vencedor: resultado = 1, então delta = K * (1 - expectativa)
  // Perdedor: resultado = 0, então delta = K * (0 - expectativa)
  const winnerDelta = Math.round(kFactor * (1 - expectedWinner));
  const loserDelta = Math.round(kFactor * (0 - expectedLoser));

  return { winnerDelta, loserDelta };
}

/**
 * Aplica o rating mínimo para evitar valores negativos extremos
 */
export function applyMinRating(rating: number): number {
  return Math.max(rating, MIN_RATING);
}

/**
 * Calcula os novos ratings após uma partida
 *
 * @param winnerRating - Rating atual do vencedor
 * @param loserRating - Rating atual do perdedor
 * @param kFactor - Fator de ajuste
 * @returns Novos ratings e deltas
 */
export function calculateNewRatings(
  winnerRating: number,
  loserRating: number,
  kFactor: number = DEFAULT_K_FACTOR
): {
  winnerNewRating: number;
  loserNewRating: number;
  winnerDelta: number;
  loserDelta: number;
} {
  const { winnerDelta, loserDelta } = calculateElo(winnerRating, loserRating, kFactor);

  return {
    winnerNewRating: applyMinRating(winnerRating + winnerDelta),
    loserNewRating: applyMinRating(loserRating + loserDelta),
    winnerDelta,
    loserDelta,
  };
}
