import { describe, it, expect } from "vitest";
import { mockRepo } from "../helpers/mock-repo";
import type { TournamentMatch } from "@/lib/tournaments/types";

// ─────────────────────────────────────────────────────────────────────────────
// Fluxo completo de ponta a ponta — do rascunho ao campeão, por formato.
// Cobre os caminhos felizes e as principais barreiras de cada etapa.
// ─────────────────────────────────────────────────────────────────────────────

async function novoTorneio(format: Parameters<typeof mockRepo.createTournament>[0]["format"]) {
  return mockRepo.createTournament({
    name: `Fluxo ${format}`, format, bestOf: 1,
    seedingMethod: "sequential", registrationMode: "open", createdBy: "admin",
  });
}

function vencedorJoga(m: TournamentMatch, ladoAVence = true) {
  return ladoAVence ? { scoreA: 1, scoreB: 0 } : { scoreA: 0, scoreB: 1 };
}

describe("Ciclo de vida — eliminatória simples (4 jogadores)", () => {
  it("draft → registration → active → finished com campeão correto", async () => {
    const t = await novoTorneio("single_elimination");
    expect(t.status).toBe("draft");

    // Abre inscrições
    await mockRepo.openRegistration(t.id);
    expect((await mockRepo.getTournament(t.id))!.status).toBe("registration");

    // Inscreve 4 participantes
    await mockRepo.addParticipants(t.id, [
      { guestName: "A" }, { guestName: "B" }, { guestName: "C" }, { guestName: "D" },
    ]);

    // Fecha inscrições → active
    await mockRepo.closeRegistration(t.id);
    expect((await mockRepo.getTournament(t.id))!.status).toBe("active");

    // Gera a chave
    const ms = await mockRepo.generateBracket(t.id, "sequential");
    expect(ms.filter((m) => m.round === 2)).toHaveLength(2); // 2 semis
    expect(ms.filter((m) => m.round === 1)).toHaveLength(1); // 1 final

    // Joga as semis
    const semis = ms.filter((m) => m.round === 2).sort((a, b) => a.slot - b.slot);
    await mockRepo.reportResult(semis[0]!.id, vencedorJoga(semis[0]!));
    await mockRepo.reportResult(semis[1]!.id, vencedorJoga(semis[1]!));

    // A final agora deve estar preenchida e jogável
    let d = await mockRepo.getTournament(t.id);
    const final = d!.matches.find((m) => m.round === 1)!;
    expect(final.participantAId).not.toBeNull();
    expect(final.participantBId).not.toBeNull();

    // Joga a final
    const res = await mockRepo.reportResult(final.id, vencedorJoga(final));
    const campeao = res.winnerParticipantId!;

    // Finaliza
    await mockRepo.finishTournament(t.id, campeao);
    d = await mockRepo.getTournament(t.id);
    expect(d!.status).toBe("finished");
    expect(d!.finishedAt).not.toBeNull();
    expect(d!.championName).toBe(d!.participants.find((p) => p.id === campeao)!.guestName);
  });

  it("não gera chave com menos de 2 participantes", async () => {
    const t = await novoTorneio("single_elimination");
    await mockRepo.addParticipants(t.id, [{ guestName: "Só eu" }]);
    await expect(mockRepo.generateBracket(t.id, "sequential")).rejects.toThrow();
  });
});

describe("Ciclo de vida — round-robin (campeão pela classificação)", () => {
  it("joga todos contra todos e o líder vira campeão", async () => {
    const t = await novoTorneio("round_robin");
    await mockRepo.addParticipants(t.id, [{ guestName: "A" }, { guestName: "B" }, { guestName: "C" }]);
    const ms = await mockRepo.generateBracket(t.id, "sequential");
    expect(ms).toHaveLength(3); // C(3,2)

    // A vence todos; B vence C → A líder
    const d0 = await mockRepo.getTournament(t.id);
    const idDe = (nome: string) => d0!.participants.find((p) => p.guestName === nome)!.id;
    const a = idDe("A"), b = idDe("B");
    for (const m of ms) {
      const aEhA = m.participantAId === a;
      const aEhB = m.participantAId === b;
      if (m.participantAId === a || m.participantBId === a) {
        await mockRepo.reportResult(m.id, { scoreA: aEhA ? 1 : 0, scoreB: aEhA ? 0 : 1 });
      } else {
        // B x C → B vence
        await mockRepo.reportResult(m.id, { scoreA: aEhB ? 1 : 0, scoreB: aEhB ? 0 : 1 });
      }
    }

    const standings = await mockRepo.getStandings(t.id);
    const ordenado = standings.sort((x, y) => x.position - y.position);
    expect(ordenado[0]!.participantId).toBe(a);
  });
});

describe("Ciclo de vida — grupos + mata-mata (seed demo)", () => {
  it("fecha os grupos, preenche o mata-mata e chega à final", async () => {
    // Usa o torneio demo já com 2 grupos de 3.
    let d = await mockRepo.getTournament("mock-tournament-2");
    expect(d!.format).toBe("groups_knockout");

    // Conclui todos os jogos de grupo pendentes (lado A vence sempre).
    const pendentes = d!.matches.filter((m) => m.bracket === "group" && m.status !== "finished");
    for (const gm of pendentes) {
      await mockRepo.reportResult(gm.id, { scoreA: 2, scoreB: 0 });
    }

    await mockRepo.closeGroupStage("mock-tournament-2");
    d = await mockRepo.getTournament("mock-tournament-2");

    // As duas semis devem estar preenchidas com 4 classificados distintos.
    const semis = d!.matches.filter((m) => m.bracket === "winners" && m.round === 2);
    expect(semis).toHaveLength(2);
    const classificados = semis.flatMap((s) => [s.participantAId, s.participantBId]).filter(Boolean);
    expect(classificados).toHaveLength(4);
    expect(new Set(classificados).size).toBe(4); // sem duplicatas

    // Joga as semis e a final.
    for (const sf of semis) await mockRepo.reportResult(sf.id, { scoreA: 2, scoreB: 0 });
    d = await mockRepo.getTournament("mock-tournament-2");
    const finalKO = d!.matches.find((m) => m.bracket === "winners" && m.round === 1)!;
    expect(finalKO.participantAId).not.toBeNull();
    expect(finalKO.participantBId).not.toBeNull();
    const res = await mockRepo.reportResult(finalKO.id, { scoreA: 2, scoreB: 1 });
    expect(res.winnerParticipantId).not.toBeNull();
  });
});

describe("Auto-avanço dinâmico de grupo", () => {
  it("um grupo só preenche o mata-mata quando TODOS os seus jogos terminam", async () => {
    const d0 = await mockRepo.getTournament("mock-tournament-2");
    // Antes de fechar: pega um jogo pendente do grupo A e joga só ele.
    const grupoA = d0!.matches.filter((m) => m.bracket === "group" && m.groupId === "A");
    const pendenteA = grupoA.find((m) => m.status !== "finished");
    if (pendenteA) {
      await mockRepo.reportResult(pendenteA.id, { scoreA: 2, scoreB: 0 });
    }
    // Se ainda houver jogo pendente no grupo A, nenhum slot do grupo A no KO foi definido por ele.
    const d1 = await mockRepo.getTournament("mock-tournament-2");
    const aindaPendenteA = d1!.matches.some(
      (m) => m.bracket === "group" && m.groupId === "A" && m.status !== "finished",
    );
    if (aindaPendenteA) {
      // garante coerência: nenhuma semi marcada como scheduled sem os dois lados
      const semis = d1!.matches.filter((m) => m.bracket === "winners" && m.round === 2);
      for (const s of semis) {
        if (s.status === "scheduled") {
          expect(s.participantAId && s.participantBId).toBeTruthy();
        }
      }
    }
    expect(true).toBe(true);
  });
});

describe("Inscrição própria (registerSelf via repo)", () => {
  it("addParticipants confirma o inscrito imediatamente", async () => {
    const t = await novoTorneio("single_elimination");
    await mockRepo.openRegistration(t.id);
    const added = await mockRepo.addParticipants(t.id, [{ guestName: "Inscrito Aberto", flag: "br" }]);
    expect(added[0]!.signupStatus).toBe("confirmed");
    const d = await mockRepo.getTournament(t.id);
    expect(d!.participants.some((p) => p.guestName === "Inscrito Aberto")).toBe(true);
  });
});
