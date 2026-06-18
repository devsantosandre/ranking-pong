import { describe, it, expect } from "vitest";
import { computeBracketLayout } from "@/lib/tournaments/bracket-layout";
import type { TournamentMatch } from "@/lib/tournaments/types";

function makeMatch(id: string, round: number, slot: number, nextMatchId?: string): TournamentMatch {
  return {
    id,
    tournamentId: "t1",
    round,
    slot,
    bracket: "winners",
    groupId: null,
    participantAId: null,
    participantBId: null,
    scoreA: null,
    scoreB: null,
    sets: null,
    winnerParticipantId: null,
    nextMatchId: nextMatchId ?? null,
    nextMatchSlot: null,
    status: "pending",
    deadlineAt: null,
    scheduledAt: null,
    tableNo: null,
    startedAt: null,
    finishedAt: null,
  };
}

// Convenção do layout: round alto = rodada inicial (esquerda), round=1 = final (direita)
// Chave de 4 jogadores: round=2 (semis) → round=1 (final)

describe("computeBracketLayout", () => {
  it("retorna layout vazio para lista vazia", () => {
    const result = computeBracketLayout([]);
    expect(result.matches).toHaveLength(0);
    expect(result.connectors).toHaveLength(0);
    expect(result.totalWidth).toBe(0);
    expect(result.totalHeight).toBe(0);
  });

  it("posiciona uma única partida com x e y >= 0", () => {
    const result = computeBracketLayout([makeMatch("m1", 1, 1)]);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].x).toBeGreaterThanOrEqual(0);
    expect(result.matches[0].y).toBeGreaterThanOrEqual(0);
  });

  it("retorna dimensões positivas", () => {
    const result = computeBracketLayout([makeMatch("m1", 1, 1)]);
    expect(result.totalWidth).toBeGreaterThan(0);
    expect(result.totalHeight).toBeGreaterThan(0);
  });

  it("partidas da rodada inicial (round=2) ficam à esquerda da final (round=1)", () => {
    const matches = [
      makeMatch("m1", 2, 1, "m3"),
      makeMatch("m2", 2, 2, "m3"),
      makeMatch("m3", 1, 1),
    ];
    const result = computeBracketLayout(matches);
    const pos = Object.fromEntries(result.matches.map((m) => [m.id, m]));

    expect(pos["m1"].x).toBeLessThan(pos["m3"].x);
    expect(pos["m2"].x).toBeLessThan(pos["m3"].x);
  });

  it("centraliza a final entre as semis (y da final = média das semis)", () => {
    const matches = [
      makeMatch("m1", 2, 1, "m3"),
      makeMatch("m2", 2, 2, "m3"),
      makeMatch("m3", 1, 1),
    ];
    const result = computeBracketLayout(matches);
    const pos = Object.fromEntries(result.matches.map((m) => [m.id, m]));

    const midY = (pos["m1"].y + pos["m2"].y) / 2;
    expect(Math.abs(pos["m3"].y - midY)).toBeLessThan(5);
  });

  it("gera 2 connectors para chave de 4 (m1→m3, m2→m3)", () => {
    const matches = [
      makeMatch("m1", 2, 1, "m3"),
      makeMatch("m2", 2, 2, "m3"),
      makeMatch("m3", 1, 1),
    ];
    const result = computeBracketLayout(matches);
    expect(result.connectors).toHaveLength(2);
    for (const c of result.connectors) {
      expect(c.path).toMatch(/^M/);
    }
  });

  it("connector aponta do fromId para toId correto", () => {
    const matches = [
      makeMatch("m1", 2, 1, "m3"),
      makeMatch("m2", 2, 2, "m3"),
      makeMatch("m3", 1, 1),
    ];
    const result = computeBracketLayout(matches);
    const connIds = result.connectors.map((c) => `${c.fromId}→${c.toId}`).sort();
    expect(connIds).toEqual(["m1→m3", "m2→m3"].sort());
  });

  it("chave de 8: 3 rodadas, 7 partidas, 6 connectors", () => {
    const matches = [
      makeMatch("m1", 3, 1, "m5"),
      makeMatch("m2", 3, 2, "m5"),
      makeMatch("m3", 3, 3, "m6"),
      makeMatch("m4", 3, 4, "m6"),
      makeMatch("m5", 2, 1, "m7"),
      makeMatch("m6", 2, 2, "m7"),
      makeMatch("m7", 1, 1),
    ];
    const result = computeBracketLayout(matches);
    expect(result.matches).toHaveLength(7);
    expect(result.connectors).toHaveLength(6);
  });

  it("semis da chave de 8 ficam entre os quartos e a final", () => {
    const matches = [
      makeMatch("m1", 3, 1, "m5"),
      makeMatch("m2", 3, 2, "m5"),
      makeMatch("m3", 3, 3, "m6"),
      makeMatch("m4", 3, 4, "m6"),
      makeMatch("m5", 2, 1, "m7"),
      makeMatch("m6", 2, 2, "m7"),
      makeMatch("m7", 1, 1),
    ];
    const result = computeBracketLayout(matches);
    const pos = Object.fromEntries(result.matches.map((m) => [m.id, m]));

    // Quartos (round=3) ← Semis (round=2) ← Final (round=1) da esquerda para direita
    expect(pos["m1"].x).toBeLessThan(pos["m5"].x);
    expect(pos["m5"].x).toBeLessThan(pos["m7"].x);
  });

  it("filtra partidas de grupo (bracket=group, round=100) — não aparecem no layout", () => {
    const groupMatch = {
      ...makeMatch("gm1", 100, 0),
      bracket: "group" as const,
      groupId: "A",
    };
    const result = computeBracketLayout([groupMatch]);
    expect(result.matches).toHaveLength(0);
    expect(result.connectors).toHaveLength(0);
  });

  it("mistura de grupo + mata-mata: apenas mata-mata aparece no layout", () => {
    const groupMatches = [
      { ...makeMatch("gm1", 100, 0), bracket: "group" as const, groupId: "A" },
      { ...makeMatch("gm2", 100, 1), bracket: "group" as const, groupId: "A" },
    ];
    const knockoutMatches = [
      makeMatch("km1", 2, 1, "km3"),
      makeMatch("km2", 2, 2, "km3"),
      makeMatch("km3", 1, 1),
    ];
    const result = computeBracketLayout([...groupMatches, ...knockoutMatches]);
    expect(result.matches).toHaveLength(3);
    expect(result.matches.every((m) => m.bracket !== "group")).toBe(true);
    expect(result.connectors).toHaveLength(2);
  });

  it("round=1 é a final (x mais à direita)", () => {
    const matches = [
      makeMatch("semi1", 2, 1, "final"),
      makeMatch("semi2", 2, 2, "final"),
      makeMatch("final", 1, 1),
    ];
    const result = computeBracketLayout(matches);
    const pos = Object.fromEntries(result.matches.map((m) => [m.id, m]));
    expect(pos["final"].x).toBeGreaterThan(pos["semi1"].x);
    expect(pos["final"].x).toBeGreaterThan(pos["semi2"].x);
  });
});
