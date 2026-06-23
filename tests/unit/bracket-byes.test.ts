import { describe, it, expect } from "vitest";
import { mockRepo } from "../helpers/mock-repo";
import type { TournamentMatch } from "@/lib/tournaments/types";

async function generate(numPlayers: number): Promise<TournamentMatch[]> {
  const t = await mockRepo.createTournament({
    name: `Byes ${numPlayers}`, format: "single_elimination", bestOf: 1,
    seedingMethod: "sequential", registrationMode: "invite", createdBy: "admin",
  });
  await mockRepo.addParticipants(
    t.id,
    Array.from({ length: numPlayers }, (_, i) => ({ guestName: `P${i + 1}` })),
  );
  return mockRepo.generateBracket(t.id, "standard");
}

describe("Eliminatória com número não-potência-de-2 (BYEs)", () => {
  it("5 jogadores: nenhum confronto inicial fica 'a definir × a definir'", async () => {
    const matches = await generate(5);
    const maxRound = Math.max(...matches.map((m) => m.round));
    const initial = matches.filter((m) => m.round === maxRound);
    expect(initial).toHaveLength(4); // bracket de 8 → 4 confrontos iniciais
    for (const m of initial) {
      // todo confronto inicial tem ao menos um jogador (nunca os dois vazios)
      expect(m.participantAId !== null || m.participantBId !== null).toBe(true);
    }
  });

  it("5 jogadores: 3 BYEs distribuídos e marcados como concluídos", async () => {
    const matches = await generate(5);
    const maxRound = Math.max(...matches.map((m) => m.round));
    const initial = matches.filter((m) => m.round === maxRound);
    const byes = initial.filter((m) => m.status === "finished" && m.winnerParticipantId);
    expect(byes.length).toBe(3); // 8 - 5
    const realGames = initial.filter((m) => m.participantAId && m.participantBId);
    expect(realGames.length).toBe(1); // só um jogo de verdade na 1ª rodada
  });

  it("5 jogadores: vencedores de BYE avançam para a rodada seguinte", async () => {
    const matches = await generate(5);
    const rounds = Array.from(new Set(matches.map((m) => m.round))).sort((a, b) => a - b);
    const semiRound = rounds[1]!; // segunda rodada (semis)
    const semis = matches.filter((m) => m.round === semiRound);
    // ao menos uma semi já tem os dois jogadores (vindos de BYEs), nenhuma vazia
    const filledSemis = semis.filter((m) => m.participantAId || m.participantBId);
    expect(filledSemis.length).toBe(semis.length);
    const scheduled = semis.filter((m) => m.participantAId && m.participantBId);
    expect(scheduled.length).toBeGreaterThanOrEqual(1);
  });

  it("6 e 7 jogadores: também sem confronto inicial vazio", async () => {
    for (const num of [6, 7]) {
      const matches = await generate(num);
      const maxRound = Math.max(...matches.map((m) => m.round));
      const initial = matches.filter((m) => m.round === maxRound);
      for (const m of initial) {
        expect(m.participantAId !== null || m.participantBId !== null).toBe(true);
      }
    }
  });

  it("4 jogadores (potência de 2): sem BYEs", async () => {
    const matches = await generate(4);
    const maxRound = Math.max(...matches.map((m) => m.round));
    const initial = matches.filter((m) => m.round === maxRound);
    expect(initial).toHaveLength(2);
    expect(initial.every((m) => m.participantAId && m.participantBId)).toBe(true);
    expect(initial.every((m) => m.status === "pending")).toBe(true);
  });
});
