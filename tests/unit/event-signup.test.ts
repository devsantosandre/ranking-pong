import { describe, it, expect } from "vitest";
import { mockRepo, seedMockUser } from "../helpers/mock-repo";
import type { CreateEventSignupInput } from "@/lib/tournaments/repo/tournament-repo";

// ─────────────────────────────────────────────────────────────────────────────
// C2 — inscrição nativa de evento (event_signups) → gera participantes.
// ─────────────────────────────────────────────────────────────────────────────

async function eventoComDuasDivisoes() {
  const ev = await mockRepo.createEvent({ name: "Aberto Teste", createdBy: "admin" });
  const divA = await mockRepo.addDivision(ev.id, { label: "A", format: "single_elimination", bestOf: 3 });
  const divB = await mockRepo.addDivision(ev.id, { label: "B", format: "single_elimination", bestOf: 3 });
  return { ev, divA, divB };
}

function baseInput(divisions: string[], over: Partial<CreateEventSignupInput> = {}): CreateEventSignupInput {
  return {
    fullName: "Fulano de Tal", email: "fulano@example.com", cbtmRating: 1600,
    divisions, paymentMode: "manual", agreedRules: true, ...over,
  };
}

describe("createEventSignup — validações", () => {
  it("cria inscrição válida (manual) como pendente, sem gerar participantes ainda", async () => {
    const { ev, divA } = await eventoComDuasDivisoes();
    const s = await mockRepo.createEventSignup(ev.id, baseInput([divA.id]));
    expect(s.paymentStatus).toBe("pending");
    const detail = (await mockRepo.getTournament(divA.id))!;
    expect(detail.participants).toHaveLength(0);
  });

  it("rejeita mais de 2 divisões", async () => {
    const { ev, divA, divB } = await eventoComDuasDivisoes();
    await expect(
      mockRepo.createEventSignup(ev.id, baseInput([divA.id, divB.id, "x"])),
    ).rejects.toThrow();
  });

  it("rejeita quando não há divisão escolhida", async () => {
    const { ev } = await eventoComDuasDivisoes();
    await expect(mockRepo.createEventSignup(ev.id, baseInput([]))).rejects.toThrow();
  });

  it("rejeita sem concordância com as regras", async () => {
    const { ev, divA } = await eventoComDuasDivisoes();
    await expect(
      mockRepo.createEventSignup(ev.id, baseInput([divA.id], { agreedRules: false })),
    ).rejects.toThrow();
  });

  it("rejeita modo gateway nesta fase", async () => {
    const { ev, divA } = await eventoComDuasDivisoes();
    await expect(
      mockRepo.createEventSignup(ev.id, baseInput([divA.id], { paymentMode: "gateway" })),
    ).rejects.toThrow();
  });
});

describe("createEventSignup — geração de participantes", () => {
  it("free confirma na hora e gera 1 participante por divisão com pot", async () => {
    const { ev, divA, divB } = await eventoComDuasDivisoes();
    const s = await mockRepo.createEventSignup(ev.id, baseInput([divA.id, divB.id], { paymentMode: "free", cbtmRating: 1800 }));
    expect(s.paymentStatus).toBe("confirmed");

    const pa = (await mockRepo.getTournament(divA.id))!.participants;
    const pb = (await mockRepo.getTournament(divB.id))!.participants;
    expect(pa).toHaveLength(1);
    expect(pb).toHaveLength(1);
    expect(pa[0]!.pot).toBe(1800);
    expect(pa[0]!.guestName).toBe("Fulano de Tal");
  });

  it("confirmar (manual) gera 1 participante por divisão; idempotente", async () => {
    const { ev, divA, divB } = await eventoComDuasDivisoes();
    const s = await mockRepo.createEventSignup(ev.id, baseInput([divA.id, divB.id]));

    await mockRepo.confirmEventSignup(s.id);
    await mockRepo.confirmEventSignup(s.id); // 2ª vez não duplica

    expect((await mockRepo.getTournament(divA.id))!.participants).toHaveLength(1);
    expect((await mockRepo.getTournament(divB.id))!.participants).toHaveLength(1);
  });

  it("vincula user_id quando o e-mail casa com um usuário existente", async () => {
    const { ev, divA } = await eventoComDuasDivisoes();
    seedMockUser("linkme@example.com", "user-123");
    const s = await mockRepo.createEventSignup(ev.id, baseInput([divA.id], { email: "linkme@example.com" }));
    await mockRepo.confirmEventSignup(s.id);

    const p = (await mockRepo.getTournament(divA.id))!.participants[0]!;
    expect(p.userId).toBe("user-123");
  });

  it("rejeitar não gera participantes", async () => {
    const { ev, divA } = await eventoComDuasDivisoes();
    const s = await mockRepo.createEventSignup(ev.id, baseInput([divA.id]));
    await mockRepo.rejectEventSignup(s.id);

    expect((await mockRepo.getTournament(divA.id))!.participants).toHaveLength(0);
    const list = await mockRepo.listEventSignups(ev.id);
    expect(list.find((x) => x.id === s.id)!.paymentStatus).toBe("rejected");
  });
});
