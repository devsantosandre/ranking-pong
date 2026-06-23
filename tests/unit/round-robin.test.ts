import { describe, it, expect } from "vitest";
import { mockRepo } from "../helpers/mock-repo";

async function setup(numPlayers: number) {
  const t = await mockRepo.createTournament({
    name: `RR ${numPlayers}`, format: "round_robin", bestOf: 1,
    seedingMethod: "sequential", registrationMode: "invite", createdBy: "admin",
  });
  await mockRepo.addParticipants(
    t.id,
    Array.from({ length: numPlayers }, (_, i) => ({ guestName: `P${i + 1}` })),
  );
  const matches = await mockRepo.generateBracket(t.id, "standard");
  return { id: t.id, matches };
}

describe("Round-robin puro", () => {
  it("gera todos contra todos (C(n,2) partidas) num único grupo", async () => {
    const { id, matches } = await setup(4);
    expect(matches).toHaveLength(6); // C(4,2)
    expect(matches.every((m) => m.bracket === "group" && m.groupId === "GERAL")).toBe(true);
    expect(matches.every((m) => m.participantAId && m.participantBId)).toBe(true);
    const detail = await mockRepo.getTournament(id);
    const conf = detail!.participants.filter((p) => p.signupStatus === "confirmed");
    expect(conf.every((p) => p.groupId === "GERAL")).toBe(true);
  });

  it("não gera mata-mata (sem partidas de bracket winners)", async () => {
    const { matches } = await setup(5);
    expect(matches).toHaveLength(10); // C(5,2)
    expect(matches.some((m) => m.bracket === "winners")).toBe(false);
  });

  it("classificação ordena por pontos e o líder é o campeão", async () => {
    const { id, matches } = await setup(3); // 3 partidas: P1xP2, P1xP3, P2xP3
    // P1 vence as duas; P2 vence P3 → P1 1º, P2 2º, P3 3º
    const find = (a: string, b: string) =>
      matches.find(
        (m) =>
          (m.participantAId?.endsWith(a) && m.participantBId?.endsWith(b)) ||
          (m.participantAId?.endsWith(b) && m.participantBId?.endsWith(a)),
      )!;
    const detail = await mockRepo.getTournament(id);
    const p1 = detail!.participants.find((p) => p.guestName === "P1")!;
    const p2 = detail!.participants.find((p) => p.guestName === "P2")!;

    // lança: P1 vence P2 e P3; P2 vence P3
    for (const m of matches) {
      const aIsP1 = m.participantAId === p1.id;
      const aIsP2 = m.participantAId === p2.id;
      const hasP1 = m.participantAId === p1.id || m.participantBId === p1.id;
      const hasP2 = m.participantAId === p2.id || m.participantBId === p2.id;
      let scoreA = 0, scoreB = 0;
      if (hasP1) { aIsP1 ? (scoreA = 1) : (scoreB = 1); } // P1 vence
      else if (hasP2) { aIsP2 ? (scoreA = 1) : (scoreB = 1); } // P2 vence P3
      await mockRepo.reportResult(m.id, { scoreA, scoreB });
    }
    void find;

    const standings = await mockRepo.getStandings(id);
    const sorted = standings.sort((a, b) => a.position - b.position);
    expect(sorted[0]!.participantId).toBe(p1.id); // líder = P1
    expect(sorted[0]!.wins).toBe(2);
  });
});
