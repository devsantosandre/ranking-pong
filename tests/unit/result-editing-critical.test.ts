import { describe, it, expect } from "vitest";
import { mockRepo } from "../helpers/mock-repo";
import type { TournamentMatch } from "@/lib/tournaments/types";

// ─────────────────────────────────────────────────────────────────────────────
// EDIÇÃO DE JOGO JÁ CONFIRMADO — cenários críticos.
//
// O admin pode corrigir um placar lançado errado em qualquer fase. Aqui
// validamos que a correção mantém o bracket COERENTE (sem campeão fantasma,
// sem participante órfão, sem propagação obsoleta).
//
// Os blocos `it.fails` documentam DEFEITOS CONFIRMADOS: a asserção descreve o
// comportamento CORRETO desejado; o `.fails` indica que hoje ele NÃO acontece.
// Quando o bug for corrigido, o teste passa e o runner cobra a remoção do `.fails`.
// ─────────────────────────────────────────────────────────────────────────────

async function bracket4() {
  const t = await mockRepo.createTournament({
    name: "Edição 4", format: "single_elimination", bestOf: 1,
    seedingMethod: "sequential", registrationMode: "invite", createdBy: "admin",
  });
  await mockRepo.addParticipants(t.id, [
    { guestName: "P1" }, { guestName: "P2" }, { guestName: "P3" }, { guestName: "P4" },
  ]);
  const matches = await mockRepo.generateBracket(t.id, "sequential");
  return { id: t.id, matches };
}

async function bracket8() {
  const t = await mockRepo.createTournament({
    name: "Edição 8", format: "single_elimination", bestOf: 1,
    seedingMethod: "sequential", registrationMode: "invite", createdBy: "admin",
  });
  await mockRepo.addParticipants(
    t.id,
    Array.from({ length: 8 }, (_, i) => ({ guestName: `J${i + 1}` })),
  );
  const matches = await mockRepo.generateBracket(t.id, "sequential");
  return { id: t.id, matches };
}

// ── O QUE JÁ FUNCIONA (deve continuar funcionando) ───────────────────────────

describe("Edição que mantém o vencedor", () => {
  it("corrigir só o placar não mexe em nada à frente", async () => {
    const { id, matches } = await bracket4();
    const semi = matches.find((m) => m.round === 2 && m.slot === 0)!;
    await mockRepo.reportResult(semi.id, { scoreA: 1, scoreB: 0 });
    let d = await mockRepo.getTournament(id);
    const finalAntes = d!.matches.find((m) => m.round === 1)!;
    const ladoFinalAntes = [finalAntes.participantAId, finalAntes.participantBId];

    // Re-lança com placar diferente mas mesmo vencedor (era bestOf 1, agora "11x9").
    await mockRepo.reportResult(semi.id, { scoreA: 11, scoreB: 9 });
    d = await mockRepo.getTournament(id);
    const m = d!.matches.find((x) => x.id === semi.id)!;
    const finalDepois = d!.matches.find((x) => x.round === 1)!;
    expect(m.scoreA).toBe(11);
    expect([finalDepois.participantAId, finalDepois.participantBId]).toEqual(ladoFinalAntes);
  });
});

describe("Edição em cadeia profunda (8 jogadores, 3 rodadas)", () => {
  it("trocar o vencedor de uma quartas reseta semi e final que dependiam dele", async () => {
    const { id, matches } = await bracket8();
    const quartas = matches.filter((m) => m.round === 3).sort((a, b) => a.slot - b.slot);

    // Joga todas as quartas (lado A vence), depois semis, depois final.
    for (const q of quartas) await mockRepo.reportResult(q.id, { scoreA: 1, scoreB: 0 });
    let d = await mockRepo.getTournament(id);
    const semis = d!.matches.filter((m) => m.round === 2).sort((a, b) => a.slot - b.slot);
    for (const s of semis) await mockRepo.reportResult(s.id, { scoreA: 1, scoreB: 0 });
    d = await mockRepo.getTournament(id);
    const final = d!.matches.find((m) => m.round === 1)!;
    await mockRepo.reportResult(final.id, { scoreA: 1, scoreB: 0 });
    d = await mockRepo.getTournament(id);
    expect(d!.matches.find((m) => m.round === 1)!.status).toBe("finished");

    // Corrige a 1ª quartas trocando o vencedor.
    const q0 = quartas[0]!;
    const perdedorOriginal = q0.participantBId!;
    await mockRepo.reportResult(q0.id, { scoreA: 0, scoreB: 1 });
    d = await mockRepo.getTournament(id);

    // A final deve ter sido resetada (cadeia inteira recalculada).
    const finalApos = d!.matches.find((m) => m.round === 1)!;
    expect(finalApos.status).not.toBe("finished");
    expect(finalApos.winnerParticipantId).toBeNull();

    // O novo vencedor da quartas deve estar propagado para a semi correspondente.
    const semiAfetada = d!.matches.find((m) => m.id === q0.nextMatchId)!;
    const lado = q0.nextMatchSlot === 0 ? semiAfetada.participantAId : semiAfetada.participantBId;
    expect(lado).toBe(perdedorOriginal);
  });
});

describe("Coerência estrutural após qualquer edição (invariantes)", () => {
  it("nunca existe partida finished cujo vencedor não seja um dos dois jogadores", async () => {
    const { id, matches } = await bracket8();
    // Joga tudo e depois corrige várias partidas aleatoriamente.
    const porRodada = [3, 2, 1];
    for (const r of porRodada) {
      const d = await mockRepo.getTournament(id);
      for (const m of d!.matches.filter((x) => x.round === r)) {
        if (m.participantAId && m.participantBId) {
          await mockRepo.reportResult(m.id, { scoreA: 1, scoreB: 0 });
        }
      }
    }
    // Corrige a primeira quartas trocando vencedor (dispara reset em cadeia).
    const q0 = matches.filter((m) => m.round === 3).sort((a, b) => a.slot - b.slot)[0]!;
    await mockRepo.reportResult(q0.id, { scoreA: 0, scoreB: 1 });

    const d = await mockRepo.getTournament(id);
    for (const m of d!.matches) {
      if (m.status === "finished" && m.winnerParticipantId) {
        expect([m.participantAId, m.participantBId]).toContain(m.winnerParticipantId);
      }
      // Toda partida finished precisa ter os dois jogadores definidos.
      if (m.status === "finished") {
        expect(m.participantAId !== null && m.participantBId !== null).toBe(true);
      }
    }
  });
});

// ── DEFEITOS CORRIGIDOS (regressões — devem permanecer verdes) ───────────────

describe("DEFEITO 1 (corrigido) — empate de placar é rejeitado", () => {
  it("placar empatado é recusado (não existe empate no tênis de mesa)", async () => {
    const { matches } = await bracket4();
    const semi = matches.find((m) => m.round === 2 && m.slot === 0)!;
    await expect(mockRepo.reportResult(semi.id, { scoreA: 5, scoreB: 5 })).rejects.toThrow();
    await expect(mockRepo.reportResult(semi.id, { scoreA: 0, scoreB: 0 })).rejects.toThrow();
    // E nada foi gravado.
    const m = (await mockRepo.getTournament(/* mesmo torneio */ semi.tournamentId))!.matches.find((x) => x.id === semi.id)!;
    expect(m.status).not.toBe("finished");
  });
});

describe("DEFEITO 2 (corrigido) — walkover honra o vencedor informado", () => {
  it("walkover(match, A) dá a vitória a A; (match, B) dá a B", async () => {
    const { matches } = await bracket4();
    const semi = matches.find((m) => m.round === 2 && m.slot === 0)!;
    const a = semi.participantAId!;
    const resA = await mockRepo.walkover(semi.id, a);
    expect(resA.winnerParticipantId).toBe(a);

    const semi2 = matches.find((m) => m.round === 2 && m.slot === 1)!;
    const b = semi2.participantBId!;
    const resB = await mockRepo.walkover(semi2.id, b);
    expect(resB.winnerParticipantId).toBe(b);
  });

  it("walkover com vencedor que não está na partida é rejeitado", async () => {
    const { matches } = await bracket4();
    const semi = matches.find((m) => m.round === 2 && m.slot === 0)!;
    await expect(mockRepo.walkover(semi.id, "fantasma")).rejects.toThrow();
  });
});

describe("DEFEITO 3 (corrigido) — editar jogo de grupo após o mata-mata preenchido", () => {
  it("flipar o classificado de um grupo atualiza a semi E reseta o que já foi jogado", async () => {
    // Conclui os grupos e joga uma semi.
    let d = await mockRepo.getTournament("mock-tournament-2");
    for (const gm of d!.matches.filter((m) => m.bracket === "group" && m.status !== "finished")) {
      await mockRepo.reportResult(gm.id, { scoreA: 2, scoreB: 0 });
    }
    await mockRepo.closeGroupStage("mock-tournament-2");
    d = await mockRepo.getTournament("mock-tournament-2");
    const sf1 = d!.matches.filter((m) => m.bracket === "winners" && m.round === 2)[0]!;
    if (sf1.participantAId && sf1.participantBId) {
      await mockRepo.reportResult(sf1.id, { scoreA: 2, scoreB: 0 });
    }

    // Edita um jogo do grupo A invertendo o resultado → muda o classificado.
    d = await mockRepo.getTournament("mock-tournament-2");
    const jogoGrupoA = d!.matches.find((m) => m.bracket === "group" && m.groupId === "A")!;
    await mockRepo.reportResult(jogoGrupoA.id, { scoreA: 0, scoreB: 2 });

    // INVARIANTE: nenhuma semi pode ter vencedor que não está mais nela.
    d = await mockRepo.getTournament("mock-tournament-2");
    for (const semi of d!.matches.filter((m) => m.bracket === "winners" && m.round === 2)) {
      if (semi.winnerParticipantId) {
        expect([semi.participantAId, semi.participantBId]).toContain(semi.winnerParticipantId);
      }
    }
    // E a final não pode carregar alguém que deixou de se classificar.
    const finalKO = d!.matches.find((m) => m.bracket === "winners" && m.round === 1)!;
    for (const lado of [finalKO.participantAId, finalKO.participantBId]) {
      if (lado) {
        const veioDeAlgumaSemi = d!.matches.some(
          (s) => s.bracket === "winners" && s.round === 2 && s.winnerParticipantId === lado,
        );
        expect(veioDeAlgumaSemi).toBe(true);
      }
    }
  });
});

describe("DEFEITO 4 (corrigido) — editar resultado de torneio já finalizado", () => {
  it("não permite editar placar de um torneio finished (precisa reabrir antes)", async () => {
    const t = await mockRepo.createTournament({
      name: "Finalizado", format: "single_elimination", bestOf: 1,
      seedingMethod: "sequential", registrationMode: "invite", createdBy: "admin",
    });
    await mockRepo.addParticipants(t.id, [{ guestName: "A" }, { guestName: "B" }]);
    const ms = await mockRepo.generateBracket(t.id, "sequential");
    const final = ms.find((m) => m.round === 1)!;
    await mockRepo.reportResult(final.id, { scoreA: 1, scoreB: 0 });
    await mockRepo.finishTournament(t.id, final.participantAId!);

    // Tentar editar depois de finalizado é recusado.
    await expect(mockRepo.reportResult(final.id, { scoreA: 0, scoreB: 1 })).rejects.toThrow();

    // Reabrindo (volta para active), a correção passa a ser permitida.
    await mockRepo.updateTournament(t.id, { status: "active" });
    const res = await mockRepo.reportResult(final.id, { scoreA: 0, scoreB: 1 });
    expect(res.winnerParticipantId).toBe(final.participantBId);
  });
});
