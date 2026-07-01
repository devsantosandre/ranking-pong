import { describe, it, expect } from "vitest";
import { mockRepo } from "../helpers/mock-repo";

// ─────────────────────────────────────────────────────────────────────────────
// Bloco D — remoção em lote de inscritos (repo.removeParticipants).
// ─────────────────────────────────────────────────────────────────────────────

async function torneioComInscritos(n: number) {
  const t = await mockRepo.createTournament({
    name: "Remoção em massa", format: "single_elimination", bestOf: 1,
    seedingMethod: "sequential", registrationMode: "open", createdBy: "admin",
  });
  const nomes = Array.from({ length: n }, (_, i) => ({ guestName: `J${i + 1}` }));
  const added = await mockRepo.addParticipants(t.id, nomes);
  return { t, added };
}

describe("removeParticipants — remoção em lote", () => {
  it("remove vários de uma vez e mantém os demais", async () => {
    const { t, added } = await torneioComInscritos(5);
    await mockRepo.removeParticipants(t.id, [added[0]!.id, added[2]!.id]);

    const detail = (await mockRepo.getTournament(t.id))!;
    const ids = detail.participants.map((p) => p.id);
    expect(ids).not.toContain(added[0]!.id);
    expect(ids).not.toContain(added[2]!.id);
    expect(detail.participants).toHaveLength(3);
  });

  it("id inexistente não quebra — remove só os válidos", async () => {
    const { t, added } = await torneioComInscritos(3);
    await expect(
      mockRepo.removeParticipants(t.id, [added[0]!.id, "id-que-nao-existe"]),
    ).resolves.not.toThrow();

    const detail = (await mockRepo.getTournament(t.id))!;
    expect(detail.participants).toHaveLength(2);
    expect(detail.participants.map((p) => p.id)).not.toContain(added[0]!.id);
  });

  it("renumera os seeds dos remanescentes sem buracos", async () => {
    const { t, added } = await torneioComInscritos(4);
    // remove o 2º → esperado seeds 1,2,3 contínuos
    await mockRepo.removeParticipants(t.id, [added[1]!.id]);

    const detail = (await mockRepo.getTournament(t.id))!;
    const seeds = detail.participants.map((p) => p.seed).sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(seeds).toEqual([1, 2, 3]);
  });

  it("é bloqueada quando o torneio está active/finished e permitida antes disso", async () => {
    const { t, added } = await torneioComInscritos(3);

    // draft → permitido
    await expect(mockRepo.removeParticipants(t.id, [added[0]!.id])).resolves.not.toThrow();

    // active → bloqueado
    await mockRepo.updateTournament(t.id, { status: "active" });
    await expect(mockRepo.removeParticipants(t.id, [added[1]!.id])).rejects.toThrow();

    // finished → bloqueado
    await mockRepo.updateTournament(t.id, { status: "finished" });
    await expect(mockRepo.removeParticipants(t.id, [added[1]!.id])).rejects.toThrow();

    // continua com 2 (só o 1º saiu)
    const detail = (await mockRepo.getTournament(t.id))!;
    expect(detail.participants).toHaveLength(2);
  });
});
