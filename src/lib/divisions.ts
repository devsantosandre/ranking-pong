/**
 * Sistema de Divisões do Ranking
 *
 * Top 3: Destaque especial (Diamante)
 * - 1º lugar: Diamante com visual roxo/azul premium
 * - 2º lugar: Diamante com visual roxo
 * - 3º lugar: Diamante com visual azul
 *
 * Divisões (6 jogadores cada):
 * - Divisão 1: posições 1-6 (inclui top 3)
 * - Divisão 2: posições 7-12
 * - Divisão 3: posições 13-18
 * - Divisão 4+: posições 19+
 */

export const PLAYERS_PER_DIVISION = 6;

export interface DivisionStyle {
  name: string;
  emoji: string | null;
  badge: string;
  border: string;
  bg: string;
  text: string;
}

// Estilos especiais para o Top 3 (Fogo).
// Os `badge` mantêm gradientes vívidos de medalha (ouro/prata/bronze) — semânticos
// de posição, lêem bem em claro e escuro. bg/border/text usam tokens (white-label + dark).
export const TOP_3_STYLES: Record<number, DivisionStyle> = {
  1: {
    name: 'Top 1',
    emoji: '🔥',
    badge: 'bg-gradient-to-br from-yellow-300 via-orange-500 to-red-600',
    border: 'border-(--state-scheduled)/50 ring-2 ring-(--state-scheduled)/30',
    bg: 'bg-(--state-scheduled)/12',
    text: 'text-(--state-scheduled)',
  },
  2: {
    name: 'Top 2',
    emoji: '🔥',
    badge: 'bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500',
    border: 'border-(--state-scheduled)/40 ring-1 ring-(--state-scheduled)/20',
    bg: 'bg-(--state-scheduled)/10',
    text: 'text-(--state-scheduled)',
  },
  3: {
    name: 'Top 3',
    emoji: '🔥',
    badge: 'bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500',
    border: 'border-(--state-scheduled)/30',
    bg: 'bg-(--state-scheduled)/10',
    text: 'text-(--state-scheduled)',
  },
};

export const DIVISION_STYLES: Record<number, DivisionStyle> = {
  1: {
    name: 'Divisão 1',
    emoji: '🥇',
    badge: 'bg-gradient-to-br from-yellow-400 to-amber-500',
    border: 'border-(--division-gold-border)',
    bg: 'bg-(--division-gold-bg)',
    text: 'text-(--division-gold)',
  },
  2: {
    name: 'Divisão 2',
    emoji: '🥈',
    badge: 'bg-(--division-silver-badge)',
    border: 'border-(--division-silver-border)',
    bg: 'bg-(--division-silver-bg)',
    text: 'text-foreground',
  },
  3: {
    name: 'Divisão 3',
    emoji: '🥉',
    badge: 'bg-(--division-bronze-badge)',
    border: 'border-(--division-bronze-border)',
    bg: 'bg-(--division-bronze-bg)',
    text: 'text-foreground',
  },
};

export const DEFAULT_DIVISION_STYLE: DivisionStyle = {
  name: 'Divisão',
  emoji: null,
  badge: 'bg-(--division-default-badge)',
  border: 'border-(--division-default-border)',
  bg: 'bg-(--division-default-bg)',
  text: 'text-foreground',
};

/**
 * Calcula o número da divisão baseado na posição no ranking
 * Posição 1-6 → Divisão 1
 * Posição 7-12 → Divisão 2
 * Posição 13-18 → Divisão 3
 * etc.
 */
export function getDivisionNumber(position: number): number {
  return Math.ceil(position / PLAYERS_PER_DIVISION);
}

/**
 * Retorna o estilo visual da divisão baseado na posição
 */
export function getDivisionStyle(position: number): DivisionStyle {
  const divNum = getDivisionNumber(position);
  return DIVISION_STYLES[divNum] || DEFAULT_DIVISION_STYLE;
}

/**
 * Retorna o estilo do jogador considerando destaque especial para top 3
 */
export function getPlayerStyle(position: number): DivisionStyle {
  // Top 3 tem estilo especial (Diamante)
  if (position <= 3) {
    return TOP_3_STYLES[position];
  }
  // Demais jogadores usam estilo da divisão
  return getDivisionStyle(position);
}

/**
 * Verifica se o jogador está no top 3
 */
export function isTopThree(position: number): boolean {
  return position <= 3;
}

/**
 * Retorna o nome da divisão baseado na posição
 */
export function getDivisionName(position: number): string {
  const divNum = getDivisionNumber(position);
  const style = DIVISION_STYLES[divNum];
  return style?.name || `Divisão ${divNum}`;
}

/**
 * Verifica se a posição é a primeira da divisão (para mostrar separador)
 */
export function isFirstOfDivision(position: number): boolean {
  return (position - 1) % PLAYERS_PER_DIVISION === 0;
}
