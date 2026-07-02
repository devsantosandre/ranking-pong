import { describe, it, expect } from "vitest";
import { mockRepo } from "../helpers/mock-repo";

// ─────────────────────────────────────────────────────────────────────────────
// C4 — geração de chave pelo método "pots" (força = pot/rating CBTM).
// ─────────────────────────────────────────────────────────────────────────────

describe("generateBracket(method='pots') — semeadura por rating", () => {
  it("coloca o maior pot como seed 1 (slot A da 1ª partida)", async () => {
    const t = await mockRepo.createTournament({
      name: "Pots", format: "single_elimination", bestOf: 1,
      seedingMethod: "pots", registrationMode: "open", createdBy: "admin",
    });
    const added = await mockRepo.addParticipants(t.id, [
      { guestName: "fraco" }, { guestName: "forte" }, { guestName: "medio" }, { guestName: "semRating" },
    ]);
    // Define os pots (rating CBTM) — forte > medio > fraco; semRating sem pot.
    await mockRepo.saveSeeding(t.id, [
      { participantId: added[0]!.id, seed: 1, pot: 1400 },
      { participantId: added[1]!.id, seed: 2, pot: 2000 },
      { participantId: added[2]!.id, seed: 3, pot: 1700 },
      { participantId: added[3]!.id, seed: 4, pot: 0 },
    ]);

    const matches = await mockRepo.generateBracket(t.id, "pots");

    // Primeira rodada = maior round; slot 0 é o topo do bracket (seed 1).
    const maxRound = Math.max(...matches.map((m) => m.round));
    const topMatch = matches.find((m) => m.round === maxRound && m.slot === 0)!;
    expect(topMatch.participantAId).toBe(added[1]!.id); // "forte" (pot 2000) = seed 1
  });

  it("participante sem pot fica como o mais fraco", async () => {
    const t = await mockRepo.createTournament({
      name: "Pots2", format: "single_elimination", bestOf: 1,
      seedingMethod: "pots", registrationMode: "open", createdBy: "admin",
    });
    const added = await mockRepo.addParticipants(t.id, [
      { guestName: "comRating" }, { guestName: "semRating" },
    ]);
    await mockRepo.saveSeeding(t.id, [
      { participantId: added[0]!.id, seed: 1, pot: 1500 },
      { participantId: added[1]!.id, seed: 2 }, // sem pot
    ]);

    const matches = await mockRepo.generateBracket(t.id, "pots");
    const maxRound = Math.max(...matches.map((m) => m.round));
    const topMatch = matches.find((m) => m.round === maxRound && m.slot === 0)!;
    expect(topMatch.participantAId).toBe(added[0]!.id); // comRating = seed 1
  });
});
