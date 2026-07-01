/**
 * Dimensionamento de grupos (ITTF 3.6 / CBTM).
 *
 * `planGroupSizes(n)` divide `n` jogadores em grupos preferindo **3**, aceitando
 * **4** e, só quando não houver divisão apenas com 3 e 4, um grupo de **2**.
 * Escolhe o número de grupos que maximiza grupos de 3 dentro da faixa válida
 * `ceil(n/4) .. floor(n/3)` (o maior `g` possível → mais grupos de 3).
 * Os 2 primeiros de cada grupo avançam para o mata-mata.
 */
export function planGroupSizes(n: number): number[] {
  if (n < 2) return n === 1 ? [1] : [];

  const lo = Math.ceil(n / 4);
  const hi = Math.floor(n / 3);

  if (lo <= hi) {
    // Maior g → grupos menores → máximo de grupos de 3.
    const g = hi;
    const fours = n - 3 * g; // 0..2 grupos que ganham +1 jogador (viram 4)
    return [...Array(fours).fill(4), ...Array(g - fours).fill(3)];
  }

  // Faixa vazia: não há divisão só com 3 e 4 → permite um grupo de 2.
  const threes = Math.floor(n / 3);
  const rem = n % 3;
  if (rem === 0) return Array(threes).fill(3);
  if (rem === 2) return [...Array(threes).fill(3), 2];
  // rem === 1 (campo minúsculo, ex.: n=4 cai na faixa; aqui só n muito pequeno)
  return [...Array(Math.max(0, threes - 1)).fill(3), 2, 2];
}

/** Número de classificados para o mata-mata: top 2 de cada grupo. */
export function qualifiersCount(sizes: number[]): number {
  return sizes.length * 2;
}

/** Distribuição serpentina/snake (ITTF 3.6): `items` deve vir ordenado por força
 * (o mais forte primeiro). Coloca 1 forte por grupo (grupos 0..n-1), depois
 * serpenteia de volta (n-1..0), garantindo balanceamento. Determinístico. */
export function snakeGroups<T>(items: T[], n: number): T[][] {
  const groups: T[][] = Array.from({ length: n }, () => []);
  items.forEach((item, i) => {
    const round = Math.floor(i / n);
    const pos = i % n;
    const idx = round % 2 === 0 ? pos : n - 1 - pos;
    groups[idx]!.push(item);
  });
  return groups;
}
