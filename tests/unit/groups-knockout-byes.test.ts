import { describe, it, expect } from "vitest";
import { mockRepo } from "../helpers/mock-repo";
import { planGroupSizes, snakeGroups } from "@/lib/tournaments/group-planner";
import type { TournamentMatch } from "@/lib/tournaments/types";

/** Cria um torneio groups_knockout, distribui `numPlayers` em `planGroupSizes(n)`
 * grupos por snake e gera o bracket. Retorna torneio, matches e nº de grupos. */
async function setupGroups(numPlayers: number, groupSizes?: number[]) {
  const t = await mockRepo.createTournament({
    name: `GK ${numPlayers}`,
    format: "groups_knockout",
    bestOf: 1,
    seedingMethod: "sequential",
    registrationMode: "invite",
    createdBy: "admin",
  });
  const parts = await mockRepo.addParticipants(
    t.id,
    Array.from({ length: numPlayers }, (_, i) => ({ guestName: `P${i + 1}` })),
  );
  const sizes = groupSizes ?? planGroupSizes(numPlayers);
  const g = sizes.length;
  const sorted = [...parts].sort((a, b) => (a.seed ?? 0) - (b.seed ?? 0));

  // Distribuição por tamanhos exatos de `sizes` (respeita grupos de 5, etc.).
  const labels = Array.from({ length: g }, (_, i) => String.fromCharCode(65 + i));
  const order: { participantId: string; seed: number; groupId: string }[] = [];
  if (groupSizes) {
    let idx = 0;
    sizes.forEach((size, gi) => {
      for (let k = 0; k < size; k++) {
        const p = sorted[idx++]!;
        order.push({ participantId: p.id, seed: p.seed!, groupId: labels[gi]! });
      }
    });
  } else {
    const groups = snakeGroups(sorted, g);
    groups.forEach((members, gi) => {
      members.forEach((p) => order.push({ participantId: p.id, seed: p.seed!, groupId: labels[gi]! }));
    });
  }

  await mockRepo.saveSeeding(t.id, order);
  const matches = await mockRepo.generateBracket(t.id, "standard");
  return { tournamentId: t.id, matches, g };
}

/** Reporta todos os jogos de grupo (menor seed vence) para fechar a fase. */
async function finishAllGroups(tournamentId: string) {
  const detail = await mockRepo.getTournament(tournamentId);
  if (!detail) throw new Error("torneio sumiu");
  const seedOf = new Map(detail.participants.map((p) => [p.id, p.seed ?? 999]));
  const groupMatches = detail.matches.filter(
    (m) => m.bracket === "group" && m.status !== "finished",
  );
  for (const m of groupMatches) {
    const sa = seedOf.get(m.participantAId!)!;
    const sb = seedOf.get(m.participantBId!)!;
    // menor seed = mais forte = vence
    if (sa < sb) await mockRepo.reportResult(m.id, { scoreA: 1, scoreB: 0 });
    else await mockRepo.reportResult(m.id, { scoreA: 0, scoreB: 1 });
  }
}

const knockout = (ms: TournamentMatch[]) => ms.filter((m) => m.bracket === "winners");

describe("groups_knockout — top 2 fixo (sem derivar de ceil(tamanho/2))", () => {
  it("grupo de 5: apenas 2 avançam (Q = 2 × grupos)", async () => {
    // 2 grupos de 5 = 10 jogadores → 4 classificados → bracket de 4
    const { matches, g } = await setupGroups(10, [5, 5]);
    const ko = knockout(matches);
    const initialRound = Math.max(...ko.map((m) => m.round));
    const initial = ko.filter((m) => m.round === initialRound);
    // Q = 2 × 2 = 4 → bracket de 4 → 2 confrontos iniciais
    expect(g).toBe(2);
    expect(initial).toHaveLength(2);
    expect(ko).toHaveLength(3); // bracket de 4 = 3 partidas (2 semis + final)
  });
});

describe("groups_knockout — sem trava de potência de 2 (byes)", () => {
  it("20 jogadores (6 grupos → 12 classificados) não lança erro e monta bracket de 16", async () => {
    const { matches, g } = await setupGroups(20);
    expect(g).toBe(6);
    const ko = knockout(matches);
    expect(ko).toHaveLength(15); // bracket de 16 → 15 partidas
    const initialRound = Math.max(...ko.map((m) => m.round));
    expect(ko.filter((m) => m.round === initialRound)).toHaveLength(8);
  });

  it("após fechar os grupos: nenhum confronto inicial fica vazio; 4 byes finalizados", async () => {
    const { tournamentId } = await setupGroups(20);
    await finishAllGroups(tournamentId);
    const detail = await mockRepo.getTournament(tournamentId);
    const ko = knockout(detail!.matches);
    const initialRound = Math.max(...ko.map((m) => m.round));
    const initial = ko.filter((m) => m.round === initialRound);

    // todo confronto inicial tem ao menos um jogador
    for (const m of initial) {
      expect(m.participantAId !== null || m.participantBId !== null).toBe(true);
    }
    // 4 byes: 1 jogador só, já finalizado com vencedor
    const byes = initial.filter(
      (m) => m.status === "finished" && m.winnerParticipantId &&
        !(m.participantAId && m.participantBId),
    );
    expect(byes).toHaveLength(4);
    // 4 confrontos reais
    const real = initial.filter((m) => m.participantAId && m.participantBId);
    expect(real).toHaveLength(4);
  });

  it("os vencedores de bye avançam para a 2ª rodada", async () => {
    const { tournamentId } = await setupGroups(20);
    await finishAllGroups(tournamentId);
    const detail = await mockRepo.getTournament(tournamentId);
    const ko = knockout(detail!.matches);
    const rounds = Array.from(new Set(ko.map((m) => m.round))).sort((a, b) => b - a);
    const secondRound = rounds[1]!; // a rodada após a inicial
    const semis2 = ko.filter((m) => m.round === secondRound);
    // 4 partidas na 2ª rodada, cada uma já com 1 jogador (vindo de bye), aguardando o outro
    expect(semis2).toHaveLength(4);
    for (const m of semis2) {
      expect(m.participantAId !== null || m.participantBId !== null).toBe(true);
    }
  });
});

describe("groups_knockout — potência de 2 continua sem byes", () => {
  it("24 jogadores (8 grupos → 16 classificados): bracket de 16 sem byes", async () => {
    const { tournamentId, g } = await setupGroups(24);
    expect(g).toBe(8);
    await finishAllGroups(tournamentId);
    const detail = await mockRepo.getTournament(tournamentId);
    const ko = knockout(detail!.matches);
    const initialRound = Math.max(...ko.map((m) => m.round));
    const initial = ko.filter((m) => m.round === initialRound);
    expect(initial).toHaveLength(8);
    // nenhum bye: todos os confrontos iniciais têm 2 jogadores
    expect(initial.every((m) => m.participantAId && m.participantBId)).toBe(true);
  });
});
