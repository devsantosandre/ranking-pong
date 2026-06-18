import type { TournamentMatch, PositionedMatch, Connector } from "./types";

const CARD_W = 270;
const CARD_H = 84;
const ROW_GAP = 24;
const COL_GAP = 120;

export interface BracketLayout {
  matches: PositionedMatch[];
  connectors: Connector[];
  totalWidth: number;
  totalHeight: number;
}

export function computeBracketLayout(allMatches: TournamentMatch[]): BracketLayout {
  // Apenas partidas de mata-mata (não grupos)
  const matches = allMatches.filter((m) => m.bracket !== "group");
  if (matches.length === 0) return { matches: [], connectors: [], totalWidth: 0, totalHeight: 0 };

  // Group by round (higher round = earlier in bracket)
  const byRound = new Map<number, TournamentMatch[]>();
  for (const m of matches) {
    const list = byRound.get(m.round) ?? [];
    list.push(m);
    byRound.set(m.round, list);
  }

  const rounds = Array.from(byRound.keys()).sort((a, b) => b - a); // desc: round inicial primeiro
  const maxRound = rounds[0] ?? 1;

  const positionedMap = new Map<string, PositionedMatch>();

  // Round inicial: empilha verticalmente
  const initialRound = rounds[0]!;
  const initialMatches = byRound.get(initialRound) ?? [];
  initialMatches.forEach((m, i) => {
    positionedMap.set(m.id, {
      ...m,
      x: (maxRound - m.round) * (CARD_W + COL_GAP),
      y: i * (CARD_H + ROW_GAP),
      height: CARD_H,
    });
  });

  // Rounds seguintes: centraliza no par filho
  for (let ri = 1; ri < rounds.length; ri++) {
    const round = rounds[ri]!;
    const roundMatches = byRound.get(round) ?? [];

    for (const m of roundMatches) {
      // Encontrar filhos (matches cujo nextMatchId aponta para m)
      const children = matches.filter((c) => c.nextMatchId === m.id);
      const x = (maxRound - m.round) * (CARD_W + COL_GAP);

      let y: number;
      if (children.length === 2) {
        const c0 = positionedMap.get(children[0]!.id);
        const c1 = positionedMap.get(children[1]!.id);
        if (c0 && c1) {
          y = (c0.y + c1.y) / 2;
        } else {
          y = ri * (CARD_H + ROW_GAP);
        }
      } else if (children.length === 1) {
        const c0 = positionedMap.get(children[0]!.id);
        y = c0 ? c0.y : ri * (CARD_H + ROW_GAP);
      } else {
        y = ri * (CARD_H + ROW_GAP);
      }

      positionedMap.set(m.id, { ...m, x, y, height: CARD_H });
    }
  }

  const positioned = Array.from(positionedMap.values());

  // Conectores ortogonais
  const connectors: Connector[] = [];
  for (const m of positioned) {
    if (!m.nextMatchId) continue;
    const target = positionedMap.get(m.nextMatchId);
    if (!target) continue;

    const ox = m.x + CARD_W;
    const oy = m.y + CARD_H / 2;
    const tx = target.x;
    const ty = target.y + CARD_H / 2;
    const midX = (ox + tx) / 2;

    const path = `M ${ox} ${oy} H ${midX} V ${ty} H ${tx}`;
    const isActive =
      m.status === "in_progress" || m.status === "scheduled" || m.status === "finished";

    connectors.push({ fromId: m.id, toId: m.nextMatchId, path, active: isActive });
  }

  const maxX = Math.max(...positioned.map((m) => m.x + CARD_W), 0);
  const maxY = Math.max(...positioned.map((m) => m.y + CARD_H), 0);

  return {
    matches: positioned,
    connectors,
    totalWidth: maxX,
    totalHeight: maxY,
  };
}
