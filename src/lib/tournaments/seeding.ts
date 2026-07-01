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

/** Semeadura por pontuação/rating (`pot`): ordena por `pot` desc (sem `pot`
 * vai ao fim), depois aplica standard. Base do seed por rating CBTM. */
export function potsSeeding(participants: TournamentParticipant[]): SeededParticipant[] {
  const sorted = [...participants].sort((a, b) => (b.pot ?? -1) - (a.pot ?? -1));
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

/** Seeds (1-indexed) que recebem BYE quando `q` classificados montam um bracket
 * `B = nextPowerOfTwo(q)`. Um seed ganha bye quando seu adversário de 1ª rodada
 * seria um seed inexistente (> q). Retorna os melhores seeds primeiro, em ordem. */
export function byeSeeds(q: number): number[] {
  const b = nextPowerOfTwo(q);
  if (b === q) return [];
  const order = buildStandardOrder(b);
  const byes: number[] = [];
  for (let i = 0; i < order.length; i += 2) {
    const a = order[i]!;
    const c = order[i + 1]!;
    if (a > q && c <= q) byes.push(c);
    else if (c > q && a <= q) byes.push(a);
  }
  return byes.sort((x, y) => x - y);
}

/** Classificado de um grupo posicionado no mata-mata. */
export interface QualifierSlot {
  /** número do grupo (1-indexed, na ordem dos grupos) */
  group: number;
  /** 0 = vencedor do grupo, 1 = 2º colocado */
  rank: 0 | 1;
}

/** Posiciona os classificados dos grupos no mata-mata seguindo a ITTF 3.7
 * (Second Stage Draw): vencedores de grupo assumem os seeds de cabeça na ordem
 * do grupo (G1 → topo, G2 → metade oposta/fundo, …) e cada 2º colocado fica na
 * metade oposta ao vencedor do próprio grupo. Reutiliza `buildStandardOrder` e
 * completa com byes (posições `null`) quando `2×grupos` não é potência de 2.
 *
 * Retorna um array indexado por posição de bracket (0 = topo … B-1 = fundo). */
export function seedQualifiersIntoBracket(groupCount: number): (QualifierSlot | null)[] {
  const g = groupCount;
  const q = g * 2;
  const b = nextPowerOfTwo(q);
  const order = buildStandardOrder(b); // posição de bracket → seed

  // Metade (0 = topo, 1 = fundo) de cada seed dentro do bracket.
  const halfOfSeed = new Map<number, 0 | 1>();
  order.forEach((seed, pos) => halfOfSeed.set(seed, pos < b / 2 ? 0 : 1));

  const seedToQual = new Map<number, QualifierSlot>();
  // Vencedores: grupo i (1-indexed) → seed i (cabeças de chave).
  for (let i = 1; i <= g; i++) seedToQual.set(i, { group: i, rank: 0 });

  // Pool de seeds dos 2º colocados (g+1 .. 2g), separado por metade.
  const runnersInTop: number[] = [];
  const runnersInBottom: number[] = [];
  for (let s = g + 1; s <= q; s++) {
    if (halfOfSeed.get(s) === 0) runnersInTop.push(s);
    else runnersInBottom.push(s);
  }

  // Cada 2º colocado vai para a metade OPOSTA ao vencedor do seu grupo.
  for (let i = 1; i <= g; i++) {
    const winnerHalf = halfOfSeed.get(i)!;
    const preferred = winnerHalf === 0 ? runnersInBottom : runnersInTop;
    const fallback = winnerHalf === 0 ? runnersInTop : runnersInBottom;
    const seed = preferred.shift() ?? fallback.shift()!;
    seedToQual.set(seed, { group: i, rank: 1 });
  }

  return order.map((seed) => (seed <= q ? seedToQual.get(seed) ?? null : null));
}
