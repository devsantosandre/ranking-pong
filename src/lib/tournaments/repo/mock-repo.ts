import type { TournamentRepo, CreateTournamentInput, AddParticipantInput, ReportResultInput, SaveSeedingInput, CreateEventInput, AddDivisionInput } from "./tournament-repo";
import type { Tournament, TournamentEvent, EventListItem, DivisionSummary, TournamentParticipant, TournamentMatch, TournamentDetail, GroupStanding, SeedingMethod } from "../types";
import { computeBracketLayout } from "../bracket-layout";
import { nextPowerOfTwo, buildStandardOrder } from "../seeding";
import { computeGroupStandings } from "../standings";

function uuid() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

// globalThis garante que server actions e API routes compartilham o mesmo estado
// mesmo quando rodam em contextos de módulo separados (Turbopack dev mode)
type GroupSlotEntry = { groupId: string; rank: number; matchId: string; matchSlot: 0 | 1 };
type MockGlobal = {
  __mockTournaments?: Map<string, Tournament>;
  __mockParticipants?: Map<string, TournamentParticipant[]>;
  __mockMatches?: Map<string, TournamentMatch[]>;
  __mockGroupSlotMap?: Map<string, GroupSlotEntry[]>;
  __mockEvents?: Map<string, TournamentEvent>;
};
const g = globalThis as typeof globalThis & MockGlobal;
if (!g.__mockTournaments) g.__mockTournaments = new Map<string, Tournament>();
if (!g.__mockParticipants) g.__mockParticipants = new Map<string, TournamentParticipant[]>();
if (!g.__mockMatches) g.__mockMatches = new Map<string, TournamentMatch[]>();
if (!g.__mockGroupSlotMap) g.__mockGroupSlotMap = new Map<string, GroupSlotEntry[]>();
if (!g.__mockEvents) g.__mockEvents = new Map<string, TournamentEvent>();

const tournaments = g.__mockTournaments;
const participants = g.__mockParticipants;
const matches = g.__mockMatches;
const groupSlotMap = g.__mockGroupSlotMap;
const events = g.__mockEvents;

// ── Helpers para o fluxo grupos_knockout ──

function buildKnockoutSkeleton(
  tournamentId: string,
  groupIds: string[],
  spotsPerGroup: number,
): { knockoutMatches: TournamentMatch[]; slotEntries: GroupSlotEntry[] } {
  const totalClassified = groupIds.length * spotsPerGroup;
  if (totalClassified < 2) return { knockoutMatches: [], slotEntries: [] };
  if (totalClassified > 1 && (totalClassified & (totalClassified - 1)) !== 0) {
    throw new Error(
      `Configuração inválida: ${totalClassified} classificados não é potência de 2. Use 2, 4 ou 8 grupos para um bracket sem byes.`,
    );
  }

  // Seeding cross-group: rank0 forward, rank1 reversed, intercalados
  const seededSlots: { groupId: string; rank: number }[] = [];
  for (let r = 0; r < spotsPerGroup; r++) {
    const tier = (r % 2 === 0 ? groupIds : [...groupIds].reverse()).map((gId) => ({ groupId: gId, rank: r }));
    for (let i = 0; i < tier.length; i++) {
      if (r === 0) {
        seededSlots.push(tier[i]!);
      } else {
        // intercalar com o tier anterior
        seededSlots.splice(i * spotsPerGroup + r, 0, tier[i]!);
      }
    }
  }

  const n = nextPowerOfTwo(totalClassified);
  const rounds = Math.log2(n);

  // matchIdsByRoundIdx[k] = IDs para round = (rounds - k)
  // matchIdsByRoundIdx[0] = primeira rodada (round=rounds), [rounds-1] = final (round=1)
  const matchIdsByRoundIdx: string[][] = [];
  for (let r = 1; r <= rounds; r++) {
    const count = Math.pow(2, rounds - r);
    matchIdsByRoundIdx.push(Array.from({ length: count }, () => uuid()));
  }

  const knockoutMatches: TournamentMatch[] = [];
  const slotEntries: GroupSlotEntry[] = [];

  const blank = (): Pick<TournamentMatch, "scoreA"|"scoreB"|"sets"|"winnerParticipantId"|"deadlineAt"|"scheduledAt"|"tableNo"|"startedAt"|"finishedAt"> => ({
    scoreA: null, scoreB: null, sets: null, winnerParticipantId: null,
    deadlineAt: null, scheduledAt: null, tableNo: null, startedAt: null, finishedAt: null,
  });

  // Primeira rodada (round = rounds)
  const firstRoundIds = matchIdsByRoundIdx[0]!;
  for (let i = 0; i < firstRoundIds.length; i++) {
    const seedA = seededSlots[i * 2];
    const seedB = seededSlots[i * 2 + 1];
    const nextMatchId = rounds > 1 ? (matchIdsByRoundIdx[1]?.[Math.floor(i / 2)] ?? null) : null;
    knockoutMatches.push({
      id: firstRoundIds[i]!, tournamentId, round: rounds, bracket: "winners", slot: i,
      groupId: null, participantAId: null, participantBId: null, ...blank(),
      nextMatchId: rounds > 1 ? nextMatchId : null,
      nextMatchSlot: rounds > 1 ? (i % 2 as 0 | 1) : null,
      status: "pending",
    });
    if (seedA) slotEntries.push({ groupId: seedA.groupId, rank: seedA.rank, matchId: firstRoundIds[i]!, matchSlot: 0 });
    if (seedB) slotEntries.push({ groupId: seedB.groupId, rank: seedB.rank, matchId: firstRoundIds[i]!, matchSlot: 1 });
  }

  // Rodadas intermediárias e final
  for (let r = rounds - 1; r >= 1; r--) {
    const rIdx = rounds - r;
    const ids = matchIdsByRoundIdx[rIdx]!;
    for (let i = 0; i < ids.length; i++) {
      const nextRIdx = rIdx + 1;
      const nextMatchId = r > 1 ? (matchIdsByRoundIdx[nextRIdx]?.[Math.floor(i / 2)] ?? null) : null;
      knockoutMatches.push({
        id: ids[i]!, tournamentId, round: r, bracket: "winners", slot: i,
        groupId: null, participantAId: null, participantBId: null, ...blank(),
        nextMatchId: r > 1 ? nextMatchId : null,
        nextMatchSlot: r > 1 ? (i % 2 as 0 | 1) : null,
        status: "pending",
      });
    }
  }

  return { knockoutMatches, slotEntries };
}

function autoAdvanceGroup(tournamentId: string, groupId: string) {
  const ms = matches.get(tournamentId) ?? [];
  const parts = participants.get(tournamentId) ?? [];
  const groupMatches = ms.filter((m) => m.bracket === "group" && m.groupId === groupId);
  if (groupMatches.some((m) => m.status !== "finished")) return; // grupo ainda em andamento

  const standings = computeGroupStandings(ms, parts);
  const groupStandings = standings
    .filter((s) => s.groupId === groupId)
    .sort((a, b) => a.position - b.position);

  const slotEntries = (groupSlotMap.get(tournamentId) ?? []).filter((e) => e.groupId === groupId);
  let changed = false;
  for (const entry of slotEntries) {
    const qualifier = parts.find((p) => p.id === groupStandings[entry.rank]?.participantId);
    if (!qualifier) continue;
    const m = ms.find((m) => m.id === entry.matchId);
    if (!m) continue;
    if (entry.matchSlot === 0) m.participantAId = qualifier.id;
    else m.participantBId = qualifier.id;
    if (m.participantAId && m.participantBId) m.status = "scheduled";
    changed = true;
  }
  if (changed) matches.set(tournamentId, [...ms]);
}

// Remove recursivamente o vencedor de `match` das partidas à frente (downstream),
// resetando partidas que dependiam dele. Usado ao corrigir ou reverter um resultado.
function clearMatchForward(list: TournamentMatch[], match: TournamentMatch) {
  if (!match.nextMatchId) return;
  const next = list.find((m) => m.id === match.nextMatchId);
  const w = match.winnerParticipantId;
  if (!next || !w) return;
  let touched = false;
  if (next.participantAId === w) { next.participantAId = null; touched = true; }
  if (next.participantBId === w) { next.participantBId = null; touched = true; }
  if (!touched) return;
  // Se a próxima já tinha resultado, ela precisa ser refeita → limpa o downstream dela antes.
  if (next.winnerParticipantId) {
    clearMatchForward(list, next);
    next.winnerParticipantId = null;
    next.scoreA = null; next.scoreB = null; next.sets = null; next.finishedAt = null;
  }
  next.status = next.participantAId && next.participantBId ? "scheduled" : "pending";
}

function seedTournament(): Tournament {
  const id = "mock-tournament-1";
  if (!tournaments.has(id)) {
    tournaments.set(id, {
      id, name: "Torneio Demo", format: "single_elimination", bestOf: 5,
      status: "draft", seedingMethod: "standard", registrationMode: "invite",
      verificationCode: null, maxParticipants: 8, seasonId: null,
      championUserId: null, championName: null, branding: null,
      createdBy: "admin", createdAt: new Date().toISOString(), finishedAt: null,
      eventId: null, divisionLabel: null, divisionOrder: 0,
    });
    participants.set(id, [
      { id: "p1", tournamentId: id, userId: "u1", guestName: "Carlos Almeida",   seed: 1, groupId: null, pot: null, flag: "br", avatarUrl: null, color: null, signupStatus: "confirmed", partnerParticipantId: null },
      { id: "p2", tournamentId: id, userId: "u2", guestName: "André Santos",     seed: 2, groupId: null, pot: null, flag: "br", avatarUrl: null, color: null, signupStatus: "confirmed", partnerParticipantId: null },
      { id: "p3", tournamentId: id, userId: "u3", guestName: "Lucas Ferreira",   seed: 3, groupId: null, pot: null, flag: "br", avatarUrl: null, color: null, signupStatus: "confirmed", partnerParticipantId: null },
      { id: "p4", tournamentId: id, userId: "u4", guestName: "Marcos Oliveira",  seed: 4, groupId: null, pot: null, flag: "br", avatarUrl: null, color: null, signupStatus: "confirmed", partnerParticipantId: null },
    ]);
  }
  return tournaments.get(id)!;
}

function seedGroupTournament(): Tournament {
  const id = "mock-tournament-2";
  if (!tournaments.has(id)) {
    tournaments.set(id, {
      id, name: "Copa Grupos Demo", format: "groups_knockout", bestOf: 3,
      status: "active", seedingMethod: "standard", registrationMode: "invite",
      verificationCode: null, maxParticipants: 6, seasonId: null,
      championUserId: null, championName: null, branding: null,
      createdBy: "admin", createdAt: new Date().toISOString(), finishedAt: null,
      eventId: null, divisionLabel: null, divisionOrder: 0,
    });
    const gParts: TournamentParticipant[] = [
      { id: "g1", tournamentId: id, userId: null, guestName: "Felipe Torres",    seed: 1, groupId: "A", pot: null, flag: null, avatarUrl: null, color: null, signupStatus: "confirmed", partnerParticipantId: null },
      { id: "g2", tournamentId: id, userId: null, guestName: "Marina Lopes",     seed: 2, groupId: "A", pot: null, flag: null, avatarUrl: null, color: null, signupStatus: "confirmed", partnerParticipantId: null },
      { id: "g3", tournamentId: id, userId: null, guestName: "Roberto Nunes",    seed: 3, groupId: "A", pot: null, flag: null, avatarUrl: null, color: null, signupStatus: "confirmed", partnerParticipantId: null },
      { id: "g4", tournamentId: id, userId: null, guestName: "Juliana Castro",   seed: 4, groupId: "B", pot: null, flag: null, avatarUrl: null, color: null, signupStatus: "confirmed", partnerParticipantId: null },
      { id: "g5", tournamentId: id, userId: null, guestName: "Diego Pinto",      seed: 5, groupId: "B", pot: null, flag: null, avatarUrl: null, color: null, signupStatus: "confirmed", partnerParticipantId: null },
      { id: "g6", tournamentId: id, userId: null, guestName: "Fernanda Melo",    seed: 6, groupId: "B", pot: null, flag: null, avatarUrl: null, color: null, signupStatus: "confirmed", partnerParticipantId: null },
    ];
    participants.set(id, gParts);
    // 3 partidas no Grupo A (round-robin de 3: 3 jogos), 3 no Grupo B
    // 1 já jogada em cada grupo como exemplo
    const gm1 = uuid(); const gm2 = uuid(); const gm3 = uuid();
    const gm4 = uuid(); const gm5 = uuid(); const gm6 = uuid();
    // Skeleton do mata-mata: 2 semis + 1 final (2 grupos × 2 vagas = 4 classificados)
    const sf1 = uuid(); const sf2 = uuid(); const kFinal = uuid();
    const groupSlots: GroupSlotEntry[] = [
      { groupId: "A", rank: 0, matchId: sf1,  matchSlot: 0 }, // A1 → semi 1 lado A
      { groupId: "B", rank: 1, matchId: sf1,  matchSlot: 1 }, // B2 → semi 1 lado B
      { groupId: "B", rank: 0, matchId: sf2,  matchSlot: 0 }, // B1 → semi 2 lado A
      { groupId: "A", rank: 1, matchId: sf2,  matchSlot: 1 }, // A2 → semi 2 lado B
    ];
    if (!groupSlotMap.has(id)) groupSlotMap.set(id, groupSlots);
    matches.set(id, [
      // Grupo A
      { id: gm1, tournamentId: id, round: 100, bracket: "group", slot: 0, groupId: "A", participantAId: "g1", participantBId: "g2", scoreA: 2, scoreB: 1, sets: null, winnerParticipantId: "g1", nextMatchId: null, nextMatchSlot: null, status: "finished", deadlineAt: null, scheduledAt: null, tableNo: null, startedAt: null, finishedAt: new Date().toISOString() },
      { id: gm2, tournamentId: id, round: 100, bracket: "group", slot: 1, groupId: "A", participantAId: "g1", participantBId: "g3", scoreA: null, scoreB: null, sets: null, winnerParticipantId: null, nextMatchId: null, nextMatchSlot: null, status: "pending", deadlineAt: null, scheduledAt: null, tableNo: null, startedAt: null, finishedAt: null },
      { id: gm3, tournamentId: id, round: 100, bracket: "group", slot: 2, groupId: "A", participantAId: "g2", participantBId: "g3", scoreA: null, scoreB: null, sets: null, winnerParticipantId: null, nextMatchId: null, nextMatchSlot: null, status: "pending", deadlineAt: null, scheduledAt: null, tableNo: null, startedAt: null, finishedAt: null },
      // Grupo B
      { id: gm4, tournamentId: id, round: 100, bracket: "group", slot: 3, groupId: "B", participantAId: "g4", participantBId: "g5", scoreA: 1, scoreB: 2, sets: null, winnerParticipantId: "g5", nextMatchId: null, nextMatchSlot: null, status: "finished", deadlineAt: null, scheduledAt: null, tableNo: null, startedAt: null, finishedAt: new Date().toISOString() },
      { id: gm5, tournamentId: id, round: 100, bracket: "group", slot: 4, groupId: "B", participantAId: "g4", participantBId: "g6", scoreA: null, scoreB: null, sets: null, winnerParticipantId: null, nextMatchId: null, nextMatchSlot: null, status: "pending", deadlineAt: null, scheduledAt: null, tableNo: null, startedAt: null, finishedAt: null },
      { id: gm6, tournamentId: id, round: 100, bracket: "group", slot: 5, groupId: "B", participantAId: "g5", participantBId: "g6", scoreA: null, scoreB: null, sets: null, winnerParticipantId: null, nextMatchId: null, nextMatchSlot: null, status: "pending", deadlineAt: null, scheduledAt: null, tableNo: null, startedAt: null, finishedAt: null },
      // Mata-mata skeleton (TBD até grupos terminarem)
      { id: sf1,    tournamentId: id, round: 2, bracket: "winners", slot: 0, groupId: null, participantAId: null, participantBId: null, scoreA: null, scoreB: null, sets: null, winnerParticipantId: null, nextMatchId: kFinal, nextMatchSlot: 0, status: "pending", deadlineAt: null, scheduledAt: null, tableNo: null, startedAt: null, finishedAt: null },
      { id: sf2,    tournamentId: id, round: 2, bracket: "winners", slot: 1, groupId: null, participantAId: null, participantBId: null, scoreA: null, scoreB: null, sets: null, winnerParticipantId: null, nextMatchId: kFinal, nextMatchSlot: 1, status: "pending", deadlineAt: null, scheduledAt: null, tableNo: null, startedAt: null, finishedAt: null },
      { id: kFinal, tournamentId: id, round: 1, bracket: "winners", slot: 0, groupId: null, participantAId: null, participantBId: null, scoreA: null, scoreB: null, sets: null, winnerParticipantId: null, nextMatchId: null,   nextMatchSlot: null, status: "pending", deadlineAt: null, scheduledAt: null, tableNo: null, startedAt: null, finishedAt: null },
    ]);
  }
  return tournaments.get(id)!;
}

function seedKingTournament(): Tournament {
  const id = "mock-tournament-3";
  if (!tournaments.has(id)) {
    tournaments.set(id, {
      id, name: "Rei da Mesa", format: "king_of_table", bestOf: 3,
      status: "active", seedingMethod: "sequential", registrationMode: "open",
      verificationCode: null, maxParticipants: null, seasonId: null,
      championUserId: null, championName: null, branding: null,
      createdBy: "admin", createdAt: new Date().toISOString(), finishedAt: null,
      eventId: null, divisionLabel: null, divisionOrder: 0,
    });
    const kParts: TournamentParticipant[] = [
      { id: "k1", tournamentId: id, userId: null, guestName: "Rodrigo Costa",    seed: 1, groupId: null, pot: null, flag: null, avatarUrl: null, color: null, signupStatus: "confirmed", partnerParticipantId: null },
      { id: "k2", tournamentId: id, userId: null, guestName: "Beatriz Alves",    seed: 2, groupId: null, pot: null, flag: null, avatarUrl: null, color: null, signupStatus: "confirmed", partnerParticipantId: null },
      { id: "k3", tournamentId: id, userId: null, guestName: "Gustavo Lima",     seed: 3, groupId: null, pot: null, flag: null, avatarUrl: null, color: null, signupStatus: "confirmed", partnerParticipantId: null },
      { id: "k4", tournamentId: id, userId: null, guestName: "Patricia Souza",   seed: 4, groupId: null, pot: null, flag: null, avatarUrl: null, color: null, signupStatus: "confirmed", partnerParticipantId: null },
      { id: "k5", tournamentId: id, userId: null, guestName: "Renato Gomes",     seed: 5, groupId: null, pot: null, flag: null, avatarUrl: null, color: null, signupStatus: "confirmed", partnerParticipantId: null },
    ];
    participants.set(id, kParts);
    const km1 = uuid(); const km2 = uuid(); const km3 = uuid(); const km4 = uuid();
    const now = new Date();
    const t1 = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
    const t2 = new Date(now.getTime() - 20 * 60 * 1000).toISOString();
    const t3 = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
    matches.set(id, [
      // k1 venceu k2 (primeiro reinado)
      { id: km1, tournamentId: id, round: 1, bracket: "winners", slot: 0, groupId: null, participantAId: "k1", participantBId: "k2", scoreA: 2, scoreB: 0, sets: null, winnerParticipantId: "k1", nextMatchId: km2, nextMatchSlot: 0, status: "finished", deadlineAt: null, scheduledAt: null, tableNo: 1, startedAt: t1, finishedAt: t1 },
      // k1 venceu k3 (segundo reinado consecutivo)
      { id: km2, tournamentId: id, round: 2, bracket: "winners", slot: 0, groupId: null, participantAId: "k1", participantBId: "k3", scoreA: 2, scoreB: 1, sets: null, winnerParticipantId: "k1", nextMatchId: km3, nextMatchSlot: 0, status: "finished", deadlineAt: null, scheduledAt: null, tableNo: 1, startedAt: t2, finishedAt: t2 },
      // k4 venceu k1 (derrubou o rei)
      { id: km3, tournamentId: id, round: 3, bracket: "winners", slot: 0, groupId: null, participantAId: "k1", participantBId: "k4", scoreA: 1, scoreB: 2, sets: null, winnerParticipantId: "k4", nextMatchId: km4, nextMatchSlot: 0, status: "finished", deadlineAt: null, scheduledAt: null, tableNo: 1, startedAt: t3, finishedAt: t3 },
      // k4 (rei atual) vs k5 (próximo desafio) — em andamento
      { id: km4, tournamentId: id, round: 4, bracket: "winners", slot: 0, groupId: null, participantAId: "k4", participantBId: "k5", scoreA: null, scoreB: null, sets: null, winnerParticipantId: null, nextMatchId: null, nextMatchSlot: null, status: "in_progress", deadlineAt: null, scheduledAt: null, tableNo: 1, startedAt: new Date().toISOString(), finishedAt: null },
    ]);
  }
  return tournaments.get(id)!;
}

export const mockRepo: TournamentRepo = {
  async listTournaments(filter) {
    seedTournament();
    seedGroupTournament();
    seedKingTournament();
    // Divisões (eventId != null) são listadas via getEvent, não soltas aqui.
    const all = Array.from(tournaments.values()).filter((t) => t.eventId === null);
    if (!filter?.status) return all;
    return all.filter((t) => t.status === filter.status);
  },

  async getTournament(id) {
    seedTournament();
    seedGroupTournament();
    seedKingTournament();
    const t = tournaments.get(id);
    if (!t) return null;
    return {
      ...t,
      participants: participants.get(id) ?? [],
      matches: matches.get(id) ?? [],
    } as TournamentDetail;
  },

  async createTournament(input: CreateTournamentInput) {
    seedTournament();
    const id = uuid();
    const t: Tournament = {
      id, name: input.name, format: input.format, bestOf: input.bestOf,
      status: "draft", seedingMethod: input.seedingMethod, registrationMode: input.registrationMode,
      verificationCode: null, maxParticipants: input.maxParticipants ?? null,
      seasonId: input.seasonId ?? null, championUserId: null, championName: null,
      branding: null, createdBy: input.createdBy, createdAt: new Date().toISOString(), finishedAt: null,
      eventId: input.eventId ?? null,
      divisionLabel: input.divisionLabel ?? null,
      divisionOrder: input.divisionOrder ?? 0,
    };
    tournaments.set(id, t);
    participants.set(id, []);
    matches.set(id, []);
    return t;
  },

  async updateTournament(id, patch) {
    seedTournament();
    const t = tournaments.get(id);
    if (!t) throw new Error("Torneio não encontrado");
    const updated = { ...t, ...patch };
    tournaments.set(id, updated);
    return updated;
  },

  async addParticipants(tournamentId, items: AddParticipantInput[]) {
    seedTournament();
    const list = participants.get(tournamentId) ?? [];
    const nextSeed = list.length + 1;
    const added: TournamentParticipant[] = items.map((item, i) => ({
      id: uuid(), tournamentId,
      userId: item.userId ?? null, guestName: item.guestName ?? null,
      seed: nextSeed + i, groupId: null, pot: null,
      flag: item.flag ?? null, avatarUrl: item.avatarUrl ?? null, color: item.color ?? null,
      signupStatus: "confirmed", partnerParticipantId: null,
    }));
    participants.set(tournamentId, [...list, ...added]);
    return added;
  },

  async removeParticipant(participantId) {
    seedTournament();
    for (const [tid, list] of participants) {
      const idx = list.findIndex((p) => p.id === participantId);
      if (idx !== -1) {
        list.splice(idx, 1);
        // Renumera seeds sequencialmente para não ficar buracos
        list.forEach((p, i) => { if (p.seed !== null) p.seed = i + 1; });
        participants.set(tid, list);
        return;
      }
    }
  },

  async saveSeeding(tournamentId, order: SaveSeedingInput[]) {
    seedTournament();
    const list = participants.get(tournamentId) ?? [];
    for (const s of order) {
      const p = list.find((p) => p.id === s.participantId);
      if (p) { p.seed = s.seed; p.groupId = s.groupId ?? null; p.pot = s.pot ?? null; }
    }
    participants.set(tournamentId, list);
  },

  async generateBracket(tournamentId, method: SeedingMethod) {
    // A força de cada jogador vem do `seed` definido no seeding; `method` é
    // mantido na assinatura por paridade com a RPC do Supabase.
    void method;
    seedTournament();
    const t = tournaments.get(tournamentId);
    const parts = (participants.get(tournamentId) ?? []).filter((p) => p.signupStatus === "confirmed");

    if (parts.length < 2) throw new Error("Mínimo de 2 participantes para gerar a chave.");

    // ── Formato groups_knockout: gera round-robin + skeleton do mata-mata ──
    if (t?.format === "groups_knockout") {
      const byGroup = new Map<string, typeof parts>();
      for (const p of parts) {
        if (!p.groupId) continue;
        const list = byGroup.get(p.groupId) ?? [];
        list.push(p);
        byGroup.set(p.groupId, list);
      }
      if (byGroup.size === 0) throw new Error("Configure os grupos antes de gerar as partidas.");

      // Round-robin por grupo
      const groupMatches: TournamentMatch[] = [];
      let slot = 0;
      for (const [groupId, groupParts] of Array.from(byGroup.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
        for (let i = 0; i < groupParts.length; i++) {
          for (let j = i + 1; j < groupParts.length; j++) {
            groupMatches.push({
              id: uuid(), tournamentId, round: 100, bracket: "group", slot: slot++,
              groupId, participantAId: groupParts[i]!.id, participantBId: groupParts[j]!.id,
              scoreA: null, scoreB: null, sets: null, winnerParticipantId: null,
              nextMatchId: null, nextMatchSlot: null, status: "pending",
              deadlineAt: null, scheduledAt: null, tableNo: null, startedAt: null, finishedAt: null,
            });
          }
        }
      }

      // Skeleton do mata-mata (slots TBD, preenchidos conforme grupos terminam)
      const groupIds = Array.from(byGroup.keys()).sort();
      const spotsPerGroup = Math.max(1, Math.ceil(Math.max(...Array.from(byGroup.values()).map((g) => g.length)) / 2));
      const { knockoutMatches, slotEntries } = buildKnockoutSkeleton(tournamentId, groupIds, spotsPerGroup);

      groupSlotMap.set(tournamentId, slotEntries);
      const allMatches = [...groupMatches, ...knockoutMatches];
      matches.set(tournamentId, allMatches);
      if (t) tournaments.set(tournamentId, { ...t, status: "active" });
      return allMatches;
    }

    // ── Eliminatória simples ──
    // Ordena por força (seed do organizador; menor = mais forte) e posiciona no
    // bracket pela ordem espelhada — assim os BYEs caem distribuídos nos seeds
    // altos, nunca deixando um confronto "a definir × a definir".
    const ranked = [...parts].sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999));
    const n = nextPowerOfTwo(ranked.length);
    const rounds = Math.log2(n);
    const order = buildStandardOrder(n);
    const slots = order.map((seedNum) => ranked[seedNum - 1] ?? null); // null = BYE

    const matchList: TournamentMatch[] = [];
    const matchById = new Map<string, TournamentMatch>();

    // matchIds[k] → round = (rounds - k); [0] = rodada inicial, [rounds-1] = final
    const matchIds: string[][] = [];
    for (let r = 1; r <= rounds; r++) {
      const count = Math.pow(2, rounds - r);
      matchIds.push(Array.from({ length: count }, () => uuid()));
    }

    // Rodada inicial
    const initialIds = matchIds[0]!;
    for (let i = 0; i < initialIds.length; i++) {
      const a = slots[i * 2] ?? null;
      const b = slots[i * 2 + 1] ?? null;
      const isBye = (!!a && !b) || (!!b && !a);
      const winner = isBye ? (a?.id ?? b?.id ?? null) : null;
      const nextMatchId = rounds > 1 ? (matchIds[1]![Math.floor(i / 2)] ?? null) : null;
      const m: TournamentMatch = {
        id: initialIds[i]!, tournamentId, round: rounds, bracket: "winners", slot: i,
        groupId: null, participantAId: a?.id ?? null, participantBId: b?.id ?? null,
        scoreA: null, scoreB: null, sets: null, winnerParticipantId: winner,
        nextMatchId, nextMatchSlot: (i % 2) as 0 | 1,
        status: isBye ? "finished" : "pending",
        deadlineAt: null, scheduledAt: null, tableNo: null, startedAt: null,
        finishedAt: isBye ? new Date().toISOString() : null,
      };
      matchList.push(m);
      matchById.set(m.id, m);
    }

    // Rodadas subsequentes (vazias)
    for (let r = rounds - 1; r >= 1; r--) {
      const ids = matchIds[rounds - r]!;
      for (let i = 0; i < ids.length; i++) {
        const nextMatchId = r > 1 ? (matchIds[rounds - r + 1]![Math.floor(i / 2)] ?? null) : null;
        const m: TournamentMatch = {
          id: ids[i]!, tournamentId, round: r, bracket: "winners", slot: i,
          groupId: null, participantAId: null, participantBId: null,
          scoreA: null, scoreB: null, sets: null, winnerParticipantId: null,
          nextMatchId, nextMatchSlot: r > 1 ? ((i % 2) as 0 | 1) : null,
          status: "pending",
          deadlineAt: null, scheduledAt: null, tableNo: null, startedAt: null, finishedAt: null,
        };
        matchList.push(m);
        matchById.set(m.id, m);
      }
    }

    // Propaga vencedores de BYE para a rodada seguinte
    for (const m of matchList) {
      if (m.status === "finished" && m.winnerParticipantId && m.nextMatchId) {
        const next = matchById.get(m.nextMatchId);
        if (next) {
          if (m.nextMatchSlot === 0) next.participantAId = m.winnerParticipantId;
          else next.participantBId = m.winnerParticipantId;
          if (next.participantAId && next.participantBId && next.status === "pending") {
            next.status = "scheduled";
          }
        }
      }
    }

    matches.set(tournamentId, matchList);
    return matchList;
  },

  async reportResult(matchId, input: ReportResultInput) {
    seedTournament();
    let foundMatch: TournamentMatch | undefined;
    let tournamentId: string | undefined;

    for (const [tid, list] of matches) {
      const m = list.find((m) => m.id === matchId);
      if (m) { foundMatch = m; tournamentId = tid; break; }
    }
    if (!foundMatch || !tournamentId) throw new Error("Partida não encontrada");
    if (!foundMatch.participantAId || !foundMatch.participantBId) {
      throw new Error("Defina os dois jogadores antes de lançar o placar.");
    }

    const list = matches.get(tournamentId) ?? [];
    const newWinner = input.scoreA > input.scoreB
      ? foundMatch.participantAId
      : foundMatch.participantBId;
    const oldWinner = foundMatch.winnerParticipantId;

    // Correção: se já havia resultado e o vencedor mudou, limpa a propagação antiga
    // (e tudo que dependia dela) antes de propagar o novo vencedor.
    if (oldWinner && oldWinner !== newWinner) {
      clearMatchForward(list, foundMatch);
    }

    foundMatch.scoreA = input.scoreA;
    foundMatch.scoreB = input.scoreB;
    foundMatch.sets = input.sets ?? null;
    foundMatch.winnerParticipantId = newWinner;
    foundMatch.status = "finished";
    foundMatch.finishedAt = new Date().toISOString();

    // Propagar vencedor para a próxima partida (knockout)
    if (foundMatch.nextMatchId && newWinner) {
      const next = list.find((m) => m.id === foundMatch!.nextMatchId);
      if (next) {
        if (foundMatch.nextMatchSlot === 0) next.participantAId = newWinner;
        else next.participantBId = newWinner;
        if (next.participantAId && next.participantBId && next.status === "pending") {
          next.status = "scheduled";
        }
      }
    }

    // Auto-avanço dinâmico: quando um grupo termina, (re)preenche os slots do mata-mata
    if (foundMatch.bracket === "group" && foundMatch.groupId) {
      autoAdvanceGroup(tournamentId, foundMatch.groupId);
    }

    matches.set(tournamentId, [...list]);
    return foundMatch;
  },

  async revertResult(matchId) {
    for (const [tid, list] of matches) {
      const m = list.find((m) => m.id === matchId);
      if (m) {
        // Limpa recursivamente tudo que dependia do vencedor desta partida.
        clearMatchForward(list, m);
        m.scoreA = null; m.scoreB = null; m.sets = null;
        m.winnerParticipantId = null; m.finishedAt = null;
        m.status = m.participantAId && m.participantBId ? "scheduled" : "pending";
        matches.set(tid, [...list]);
        return;
      }
    }
  },

  async walkover(matchId, winnerParticipantId) {
    return this.reportResult(matchId, { scoreA: 0, scoreB: 0 });
  },

  async getStandings(tournamentId) {
    seedTournament();
    seedGroupTournament();
    const ms = matches.get(tournamentId) ?? [];
    const parts = participants.get(tournamentId) ?? [];
    return computeGroupStandings(ms, parts);
  },

  async closeGroupStage(tournamentId) {
    seedTournament();
    seedGroupTournament();
    // Recalcula o avanço de todos os grupos que já terminaram
    const ms = matches.get(tournamentId) ?? [];
    const groupIds = Array.from(new Set(ms.filter((m) => m.bracket === "group" && m.groupId).map((m) => m.groupId!)));
    for (const gId of groupIds) {
      autoAdvanceGroup(tournamentId, gId);
    }
  },

  async finishTournament(tournamentId, championParticipantId) {
    seedTournament();
    const t = tournaments.get(tournamentId);
    if (!t) throw new Error("Torneio não encontrado");
    const parts = participants.get(tournamentId) ?? [];
    const champ = parts.find((p) => p.id === championParticipantId);
    const updated = {
      ...t, status: "finished" as const,
      championName: champ?.guestName ?? null,
      championUserId: champ?.userId ?? null,
      finishedAt: new Date().toISOString(),
    };
    tournaments.set(tournamentId, updated);
    return updated;
  },

  async openRegistration(tournamentId) {
    seedTournament();
    const t = tournaments.get(tournamentId);
    if (t) tournaments.set(tournamentId, { ...t, status: "registration" });
  },

  async closeRegistration(tournamentId) {
    seedTournament();
    const t = tournaments.get(tournamentId);
    if (t) tournaments.set(tournamentId, { ...t, status: "active" });
  },

  // ── Eventos / Divisões ──

  async listEvents() {
    seedEventDemo();
    return Array.from(events.values())
      .sort((a, b) => (b.eventDate ?? "").localeCompare(a.eventDate ?? ""))
      .map((ev): EventListItem => {
        const cats = Array.from(tournaments.values())
          .filter((t) => t.eventId === ev.id)
          .sort((a, b) => a.divisionOrder - b.divisionOrder);
        const hasLive = cats.some((c) => (matches.get(c.id) ?? []).some((m) => m.status === "in_progress"));
        return {
          ...ev,
          categoriesCount: cats.length,
          firstCategoryId: cats[0]?.id ?? null,
          hasLiveMatch: hasLive,
        };
      });
  },

  async getEvent(eventId) {
    seedEventDemo();
    const ev = events.get(eventId);
    if (!ev) return null;
    const divisions: DivisionSummary[] = Array.from(tournaments.values())
      .filter((t) => t.eventId === eventId)
      .sort((a, b) => a.divisionOrder - b.divisionOrder)
      .map(buildDivisionSummary);
    return { ...ev, divisions };
  },

  async createEvent(input: CreateEventInput) {
    const id = uuid();
    const ev: TournamentEvent = {
      id, name: input.name, eventDate: input.eventDate ?? null, venue: input.venue ?? null,
      branding: null, seasonId: input.seasonId ?? null, createdBy: input.createdBy,
      createdAt: new Date().toISOString(),
    };
    events.set(id, ev);
    return ev;
  },

  async updateEvent(eventId, patch) {
    const ev = events.get(eventId);
    if (!ev) throw new Error("Evento não encontrado");
    const updated = { ...ev, ...patch };
    events.set(eventId, updated);
    return updated;
  },

  async addDivision(eventId, input: AddDivisionInput) {
    const ev = events.get(eventId);
    if (!ev) throw new Error("Evento não encontrado");
    const existing = Array.from(tournaments.values()).filter((t) => t.eventId === eventId);
    const id = uuid();
    const t: Tournament = {
      id, name: `${ev.name} — ${input.label}`, format: input.format, bestOf: input.bestOf,
      status: "draft", seedingMethod: input.seedingMethod ?? "standard",
      registrationMode: input.registrationMode ?? "invite",
      verificationCode: null, maxParticipants: null, seasonId: ev.seasonId,
      championUserId: null, championName: null, branding: ev.branding,
      createdBy: ev.createdBy, createdAt: new Date().toISOString(), finishedAt: null,
      eventId, divisionLabel: input.label, divisionOrder: existing.length,
    };
    tournaments.set(id, t);
    participants.set(id, []);
    matches.set(id, []);
    return t;
  },

  async setDivisionOrder(eventId, order) {
    for (const o of order) {
      const t = tournaments.get(o.tournamentId);
      if (t && t.eventId === eventId) tournaments.set(o.tournamentId, { ...t, divisionOrder: o.divisionOrder });
    }
  },
};

function buildDivisionSummary(t: Tournament): DivisionSummary {
  const ps = participants.get(t.id) ?? [];
  const ms = matches.get(t.id) ?? [];
  return {
    id: t.id, name: t.name, divisionLabel: t.divisionLabel,
    divisionOrder: t.divisionOrder, format: t.format, status: t.status,
    participantCount: ps.length, championName: t.championName,
    hasLiveMatch: ms.some((m) => m.status === "in_progress"),
  };
}

// Evento demo: "Rachão de Sábado" com 3 divisões (A active c/ jogo ao vivo, B inscrições, C rascunho).
function seedEventDemo(): TournamentEvent {
  const eventId = "mock-event-1";
  if (events.has(eventId)) return events.get(eventId)!;
  events.set(eventId, {
    id: eventId, name: "Rachão de Sábado",
    eventDate: new Date().toISOString().slice(0, 10), venue: "Escola de Tênis de Mesa",
    branding: null, seasonId: null, createdBy: "admin", createdAt: new Date().toISOString(),
  });

  const mkParts = (divId: string, names: string[]): TournamentParticipant[] =>
    names.map((n, i) => ({
      id: `${divId}-p${i + 1}`, tournamentId: divId, userId: null, guestName: n,
      seed: i + 1, groupId: null, pot: null, flag: null, avatarUrl: null, color: null,
      signupStatus: "confirmed" as const, partnerParticipantId: null,
    }));

  const mkDiv = (divId: string, label: string, order: number, format: Tournament["format"], status: Tournament["status"]) => {
    tournaments.set(divId, {
      id: divId, name: `Rachão de Sábado — ${label}`, format, bestOf: 3,
      status, seedingMethod: "standard", registrationMode: "invite",
      verificationCode: null, maxParticipants: null, seasonId: null,
      championUserId: null, championName: null, branding: null,
      createdBy: "admin", createdAt: new Date().toISOString(), finishedAt: null,
      eventId, divisionLabel: label, divisionOrder: order,
    });
  };

  // Divisão A — eliminatória em andamento, com 1 semi ao vivo (renderiza bracket + indicador "ao vivo")
  mkDiv("mock-div-a", "A · Avançados", 0, "single_elimination", "active");
  participants.set("mock-div-a", mkParts("mock-div-a", ["Felipe Torres", "Marina Lopes", "Roberto Nunes", "Juliana Castro"]));
  const aSf1 = uuid(); const aSf2 = uuid(); const aFinal = uuid();
  const now = new Date().toISOString();
  matches.set("mock-div-a", [
    { id: aSf1, tournamentId: "mock-div-a", round: 2, bracket: "winners", slot: 0, groupId: null, participantAId: "mock-div-a-p1", participantBId: "mock-div-a-p4", scoreA: 3, scoreB: 1, sets: null, winnerParticipantId: "mock-div-a-p1", nextMatchId: aFinal, nextMatchSlot: 0, status: "finished", deadlineAt: null, scheduledAt: null, tableNo: 1, startedAt: now, finishedAt: now },
    { id: aSf2, tournamentId: "mock-div-a", round: 2, bracket: "winners", slot: 1, groupId: null, participantAId: "mock-div-a-p2", participantBId: "mock-div-a-p3", scoreA: null, scoreB: null, sets: null, winnerParticipantId: null, nextMatchId: aFinal, nextMatchSlot: 1, status: "in_progress", deadlineAt: null, scheduledAt: null, tableNo: 2, startedAt: now, finishedAt: null },
    { id: aFinal, tournamentId: "mock-div-a", round: 1, bracket: "winners", slot: 0, groupId: null, participantAId: "mock-div-a-p1", participantBId: null, scoreA: null, scoreB: null, sets: null, winnerParticipantId: null, nextMatchId: null, nextMatchSlot: null, status: "pending", deadlineAt: null, scheduledAt: null, tableNo: null, startedAt: null, finishedAt: null },
  ]);

  // Divisão B — inscrições abertas, sem chave ainda
  mkDiv("mock-div-b", "B · Intermediários", 1, "single_elimination", "registration");
  participants.set("mock-div-b", mkParts("mock-div-b", ["Diego Pinto", "Fernanda Melo", "Bruno Alves", "Carla Dias"]));
  matches.set("mock-div-b", []);

  // Divisão C — rascunho
  mkDiv("mock-div-c", "C · Iniciantes", 2, "groups_knockout", "draft");
  participants.set("mock-div-c", mkParts("mock-div-c", ["Léo Maia", "Tom Reis", "Ana Vaz", "Bia Sá"]));
  matches.set("mock-div-c", []);

  return events.get(eventId)!;
}
