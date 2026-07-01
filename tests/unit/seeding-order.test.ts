import { describe, it, expect } from "vitest";
import { mockRepo } from "../helpers/mock-repo";

async function setup(n: number) {
  const t = await mockRepo.createTournament({
    name: `Seed order ${n}`,
    format: "single_elimination",
    bestOf: 1,
    seedingMethod: "standard",
    registrationMode: "invite",
    createdBy: "admin",
  });
  const parts = await mockRepo.addParticipants(
    t.id,
    Array.from({ length: n }, (_, i) => ({ guestName: `P${i + 1}` })),
  );
  return { tournamentId: t.id, parts };
}

describe("ordenação de seeds — getTournament ordena por seed", () => {
  it("participants voltam ordenados por seed ascendente", async () => {
    const { tournamentId, parts } = await setup(5);
    // Inverte a semeadura: o último vira seed 1, etc.
    await mockRepo.saveSeeding(
      tournamentId,
      parts.map((p, i) => ({ participantId: p.id, seed: parts.length - i })),
    );
    const detail = await mockRepo.getTournament(tournamentId);
    const seeds = detail!.participants.map((p) => p.seed);
    expect(seeds).toEqual([1, 2, 3, 4, 5]);
    // o primeiro da lista (seed 1) deve ser o último participante adicionado
    expect(detail!.participants[0]!.id).toBe(parts[4]!.id);
  });

  it("swap de 2 adjacentes reflete só nesses 2 (posição = seed)", async () => {
    const { tournamentId, parts } = await setup(5);
    // seeds iniciais 1..5 na ordem de adição; troca seed 1 <-> seed 2
    const order = [
      { participantId: parts[1]!.id, seed: 1 }, // P2 vira seed 1
      { participantId: parts[0]!.id, seed: 2 }, // P1 vira seed 2
      { participantId: parts[2]!.id, seed: 3 },
      { participantId: parts[3]!.id, seed: 4 },
      { participantId: parts[4]!.id, seed: 5 },
    ];
    await mockRepo.saveSeeding(tournamentId, order);
    const detail = await mockRepo.getTournament(tournamentId);
    // A ordem por seed deve ser exatamente P2, P1, P3, P4, P5 — nada "embaixo" muda.
    expect(detail!.participants.map((p) => p.id)).toEqual([
      parts[1]!.id, parts[0]!.id, parts[2]!.id, parts[3]!.id, parts[4]!.id,
    ]);
    // posição (index) bate com seed-1 para todos → "era #" só apareceria nos 2 trocados
    detail!.participants.forEach((p, i) => expect(p.seed).toBe(i + 1));
  });
});
