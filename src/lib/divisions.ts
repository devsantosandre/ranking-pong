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

// Estilos especiais para o Top 3 (Fogo)
export const TOP_3_STYLES: Record<number, DivisionStyle> = {
  1: {
    name: 'Top 1',
    emoji: '🔥',
    badge: 'bg-gradient-to-br from-yellow-300 via-orange-500 to-red-600',
    border: 'border-orange-400 ring-2 ring-orange-300/50',
    bg: 'bg-gradient-to-r from-orange-50 via-red-50 to-yellow-50',
    text: 'text-orange-700',
  },
  2: {
    name: 'Top 2',
    emoji: '🔥',
    badge: 'bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500',
    border: 'border-orange-300 ring-1 ring-orange-200/50',
    bg: 'bg-gradient-to-r from-orange-50 to-yellow-50',
    text: 'text-orange-600',
  },
  3: {
    name: 'Top 3',
    emoji: '🔥',
    badge: 'bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500',
    border: 'border-amber-300',
    bg: 'bg-gradient-to-r from-amber-50 to-orange-50',
    text: 'text-amber-700',
  },
};

export const DIVISION_STYLES: Record<number, DivisionStyle> = {
  1: {
    name: 'Divisão 1',
    emoji: '🥇',
    badge: 'bg-gradient-to-br from-yellow-400 to-amber-500',
    border: 'border-amber-300',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
  },
  2: {
    name: 'Divisão 2',
    emoji: '🥈',
    badge: 'bg-gradient-to-br from-gray-300 to-gray-400',
    border: 'border-gray-300',
    bg: 'bg-gray-50',
    text: 'text-gray-600',
  },
  3: {
    name: 'Divisão 3',
    emoji: '🥉',
    badge: 'bg-gradient-to-br from-orange-400 to-orange-600',
    border: 'border-orange-300',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
  },
};

export const DEFAULT_DIVISION_STYLE: DivisionStyle = {
  name: 'Divisão',
  emoji: null,
  badge: 'bg-muted',
  border: 'border-border',
  bg: 'bg-card',
  text: 'text-muted-foreground',
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
