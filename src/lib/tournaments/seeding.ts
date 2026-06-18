import type { TournamentParticipant } from "./types";

export type SeededParticipant = TournamentParticipant & { seed: number };

/** Semeadura padrão: 1 vs N, N/2+1 vs N/2, etc. */
export function standardSeeding(participants: TournamentParticipant[]): SeededParticipant[] {
  const n = nextPowerOfTwo(participants.length);
  const order = buildStandardOrder(n);
  return participants.map((p, i) => ({ ...p, seed: order[i] ?? i + 1 }));
}

/** Semeadura por ELO: ordena por rating desc, depois aplica standard */
export function eloSeeding(
  participants: TournamentParticipant[],
  ratings: Map<string, number>,
): SeededParticipant[] {
  const sorted = [...participants].sort((a, b) => {
    const ra = a.userId ? (ratings.get(a.userId) ?? 0) : 0;
    const rb = b.userId ? (ratings.get(b.userId) ?? 0) : 0;
    return rb - ra;
  });
  return standardSeeding(sorted);
}

/** Semeadura sequential: seed = posição de entrada */
export function sequentialSeeding(participants: TournamentParticipant[]): SeededParticipant[] {
  return participants.map((p, i) => ({ ...p, seed: i + 1 }));
}

/** Calcula o número de BYEs necessários para completar a potência de 2 */
export function countByes(n: number): number {
  return nextPowerOfTwo(n) - n;
}

export function nextPowerOfTwo(n: number): number {
  if (n <= 1) return 1;
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/** Gera a ordem de semeadura padrão (bracket espelho clássico).
 * Retorna, para cada posição do bracket, o número do seed que a ocupa.
 * Ex.: n=8 → [1,8,5,4,3,6,7,2]. Garante que, faltando jogadores (BYEs nos
 * seeds mais altos), cada BYE cai num confronto distinto — nunca dois BYEs
 * no mesmo jogo. */
export function buildStandardOrder(n: number): number[] {
  if (n === 1) return [1];
  const half = buildStandardOrder(n / 2);
  const result: number[] = [];
  for (const seed of half) {
    result.push(seed);
    result.push(n + 1 - seed);
  }
  return result;
}
