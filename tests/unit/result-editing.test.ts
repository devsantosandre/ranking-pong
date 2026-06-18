import { describe, it, expect, beforeEach } from "vitest";
import { mockRepo } from "@/lib/tournaments/repo/mock-repo";

// Monta um torneio de eliminatória simples com 4 jogadores e gera a chave.
async function setupBracket() {
  const t = await mockRepo.createTournament({
    name: "Edição Teste", format: "single_elimination", bestOf: 1,
    seedingMethod: "sequential", registrationMode: "invite", createdBy: "admin",
  });
  await mockRepo.addParticipants(t.id, [
    { guestName: "P1" }, { guestName: "P2" }, { guestName: "P3" }, { guestName: "P4" },
  ]);
  const matchesList = await mockRepo.generateBracket(t.id, "sequential");
  return { tournamentId: t.id, matches: matchesList };
}

describe("Correção de resultado lançado", () => {
  it("corrige o placar mantendo o vencedor (só atualiza o número)", async () => {
    const { tournamentId, matches } = await setupBracket();
    const semi = matches.find((m) => m.round === 2 && m.slot === 0)!;

    await mockRepo.reportResult(semi.id, { scoreA: 1, scoreB: 0 });
    let detail = await mockRepo.getTournament(tournamentId);
    let m = detail!.matches.find((x) => x.id === semi.id)!;
    const winner = m.winnerParticipantId;

    // corrige o placar (mesmo vencedor)
    await mockRepo.reportResult(semi.id, { scoreA: 1, scoreB: 0 });
    detail = await mockRepo.getTournament(tournamentId);
    m = detail!.matches.find((x) => x.id === semi.id)!;
    expect(m.scoreA).toBe(1);
    expect(m.winnerParticipantId).toBe(winner); // vencedor inalterado
  });

  it("ao trocar o vencedor, propaga o novo e remove o antigo da próxima fase", async () => {
    const { tournamentId, matches } = await setupBracket();
    const semi = matches.find((m) => m.round === 2 && m.slot === 0)!;
    const a = semi.participantAId!;
    const b = semi.participantBId!;

    // 1º lançamento: A vence
    await mockRepo.reportResult(semi.id, { scoreA: 1, scoreB: 0 });
    let detail = await mockRepo.getTournament(tournamentId);
    let final = detail!.matches.find((x) => x.round === 1)!;
    // A foi propagado para a final (slot do semi 0 = participante A da final)
    expect([final.participantAId, final.participantBId]).toContain(a);
    expect([final.participantAId, final.participantBId]).not.toContain(b);

    // Correção: na verdade B venceu
    await mockRepo.reportResult(semi.id, { scoreA: 0, scoreB: 1 });
    detail = await mockRepo.getTournament(tournamentId);
    final = detail!.matches.find((x) => x.round === 1)!;
    const semiNow = detail!.matches.find((x) => x.id === semi.id)!;

    expect(semiNow.winnerParticipantId).toBe(b);
    // B agora está na final; A não está mais
    expect([final.participantAId, final.participantBId]).toContain(b);
    expect([final.participantAId, final.participantBId]).not.toContain(a);
  });

  it("corrigir uma semi reseta a final que já tinha sido jogada com o vencedor antigo", async () => {
    const { tournamentId, matches } = await setupBracket();
    const semi1 = matches.find((m) => m.round === 2 && m.slot === 0)!;
    const semi2 = matches.find((m) => m.round === 2 && m.slot === 1)!;
    const a = semi1.participantAId!;

    // joga as duas semis
    await mockRepo.reportResult(semi1.id, { scoreA: 1, scoreB: 0 }); // A avança
    await mockRepo.reportResult(semi2.id, { scoreA: 1, scoreB: 0 });
    let detail = await mockRepo.getTournament(tournamentId);
    let final = detail!.matches.find((x) => x.round === 1)!;

    // joga a final
    await mockRepo.reportResult(final.id, { scoreA: 1, scoreB: 0 });
    detail = await mockRepo.getTournament(tournamentId);
    final = detail!.matches.find((x) => x.round === 1)!;
    expect(final.status).toBe("finished");

    // corrige a semi1 trocando o vencedor → a final deve ser resetada
    await mockRepo.reportResult(semi1.id, { scoreA: 0, scoreB: 1 });
    detail = await mockRepo.getTournament(tournamentId);
    final = detail!.matches.find((x) => x.round === 1)!;
    expect(final.status).not.toBe("finished"); // final foi resetada
    expect(final.winnerParticipantId).toBeNull();
    expect([final.participantAId, final.participantBId]).not.toContain(a);
  });

  it("recusa lançar placar em partida sem os dois jogadores definidos", async () => {
    const { tournamentId, matches } = await setupBracket();
    const final = matches.find((m) => m.round === 1)!;
    // A final ainda está com os dois lados "a definir" (semis não jogadas).
    expect(final.participantAId).toBeNull();
    await expect(mockRepo.reportResult(final.id, { scoreA: 1, scoreB: 0 })).rejects.toThrow();
    // garante que nada foi gravado
    const detail = await mockRepo.getTournament(tournamentId);
    const finalAfter = detail!.matches.find((m) => m.id === final.id)!;
    expect(finalAfter.status).not.toBe("finished");
  });

  it("revertResult limpa a partida e a propagação à frente", async () => {
    const { tournamentId, matches } = await setupBracket();
    const semi = matches.find((m) => m.round === 2 && m.slot === 0)!;

    await mockRepo.reportResult(semi.id, { scoreA: 1, scoreB: 0 });
    await mockRepo.revertResult(semi.id);
    const detail = await mockRepo.getTournament(tournamentId);
    const m = detail!.matches.find((x) => x.id === semi.id)!;
    const final = detail!.matches.find((x) => x.round === 1)!;

    expect(m.scoreA).toBeNull();
    expect(m.winnerParticipantId).toBeNull();
    expect(m.status).not.toBe("finished");
    // a final não deve ter ninguém vindo dessa semi
    expect(final.participantAId).toBeNull();
  });
});
