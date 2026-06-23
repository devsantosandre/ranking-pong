import { describe, it, expect } from "vitest";
import { mockRepo } from "../helpers/mock-repo";

describe("Eventos / Divisões (Opção B) — mock-repo", () => {
  it("evento demo agrupa 3 divisões ordenadas por divisionOrder", async () => {
    const ev = await mockRepo.getEvent("mock-event-1");
    expect(ev).not.toBeNull();
    expect(ev!.name).toBe("Rachão de Sábado");
    expect(ev!.divisions).toHaveLength(3);
    expect(ev!.divisions.map((d) => d.divisionOrder)).toEqual([0, 1, 2]);
    expect(ev!.divisions.map((d) => d.divisionLabel)).toEqual([
      "A · Avançados",
      "B · Intermediários",
      "C · Iniciantes",
    ]);
  });

  it("resumo da divisão traz contagem de participantes e flag de jogo ao vivo", async () => {
    const ev = await mockRepo.getEvent("mock-event-1");
    const a = ev!.divisions.find((d) => d.id === "mock-div-a")!;
    expect(a.participantCount).toBe(4);
    expect(a.hasLiveMatch).toBe(true); // divisão A tem uma semi in_progress
    const c = ev!.divisions.find((d) => d.id === "mock-div-c")!;
    expect(c.hasLiveMatch).toBe(false); // divisão C é rascunho
  });

  it("listTournaments NÃO inclui divisões (só torneios avulsos)", async () => {
    const list = await mockRepo.listTournaments();
    const ids = list.map((t) => t.id);
    expect(ids).not.toContain("mock-div-a");
    expect(ids).not.toContain("mock-div-b");
    // torneios avulsos seguem aparecendo
    expect(ids).toContain("mock-tournament-1");
  });

  it("createEvent + addDivision cria divisão ligada com ordem incremental", async () => {
    const ev = await mockRepo.createEvent({ name: "Open de Teste", createdBy: "admin" });
    const d1 = await mockRepo.addDivision(ev.id, { label: "Única", format: "single_elimination", bestOf: 5 });
    const d2 = await mockRepo.addDivision(ev.id, { label: "Segunda", format: "round_robin", bestOf: 3 });

    expect(d1.eventId).toBe(ev.id);
    expect(d1.divisionOrder).toBe(0);
    expect(d2.divisionOrder).toBe(1);

    const detail = await mockRepo.getEvent(ev.id);
    expect(detail!.divisions).toHaveLength(2);
    // divisão herda formato/best-of próprios
    expect(detail!.divisions[0]!.format).toBe("single_elimination");
    expect(detail!.divisions[1]!.format).toBe("round_robin");
  });

  it("setDivisionOrder reordena as divisões do evento", async () => {
    const ev = await mockRepo.createEvent({ name: "Reorder Test", createdBy: "admin" });
    const a = await mockRepo.addDivision(ev.id, { label: "Primeira", format: "single_elimination", bestOf: 5 });
    const b = await mockRepo.addDivision(ev.id, { label: "Segunda", format: "single_elimination", bestOf: 5 });

    await mockRepo.setDivisionOrder(ev.id, [
      { tournamentId: a.id, divisionOrder: 1 },
      { tournamentId: b.id, divisionOrder: 0 },
    ]);

    const detail = await mockRepo.getEvent(ev.id);
    expect(detail!.divisions.map((d) => d.id)).toEqual([b.id, a.id]);
  });

  it("torneio avulso continua com eventId null (zero breaking change)", async () => {
    const t = await mockRepo.createTournament({
      name: "Avulso", format: "single_elimination", bestOf: 5,
      seedingMethod: "standard", registrationMode: "invite", createdBy: "admin",
    });
    expect(t.eventId).toBeNull();
    expect(t.divisionOrder).toBe(0);
  });
});
