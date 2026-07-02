import { createAdminClient } from "@/utils/supabase/admin";
import type { TournamentRepo, CreateTournamentInput, AddParticipantInput, ReportResultInput, SaveSeedingInput, CreateEventInput, AddDivisionInput, CreateEventSignupInput } from "./tournament-repo";
import type { Tournament, TournamentEvent, TournamentEventDetail, EventListItem, DivisionSummary, TournamentParticipant, TournamentMatch, TournamentDetail, GroupStanding, SeedingMethod, TournamentStatus, EventInfo, EventSignup } from "../types";
import { tournamentFromRow, tournamentEventFromRow, participantFromRow, matchFromRow, eventSignupFromRow } from "../types";
import { computeGroupStandings } from "../standings";
import { deriveEventStatus } from "../event-status";

type AdminClient = ReturnType<typeof createAdminClient>;
type GroupSlotRow = { group_id: string; rank: number; match_id: string; match_slot: number };

/**
 * Bloco B — auto-avanço dos classificados de um grupo, decidido no TS (fonte
 * única ITTF/CBTM via `computeGroupStandings`, com o desempate progressivo).
 * Substitui o auto-avanço SQL (`tournament_auto_advance_group`, agora no-op na
 * migration 20260701000100): a classificação EXIBIDA e os CLASSIFICADOS que
 * avançam passam a usar exatamente o mesmo critério, sem divergência.
 *
 * Espelha `mock-repo.autoAdvanceGroup`: só age com o grupo terminado, preenche
 * os slots do mata-mata (`tournament_group_slots`) com os classificados e trata
 * o avanço por BYE (jogo de 1ª rodada com um único slot no total → finaliza e
 * propaga o classificado para a rodada seguinte).
 */
async function advanceGroupQualifiers(client: AdminClient, tournamentId: string, groupId: string) {
  const [pRes, mRes, sRes] = await Promise.all([
    client.from("tournament_participants").select("*").eq("tournament_id", tournamentId),
    client.from("tournament_matches").select("*").eq("tournament_id", tournamentId),
    client.from("tournament_group_slots").select("group_id, rank, match_id, match_slot").eq("tournament_id", tournamentId),
  ]);
  if (pRes.error) throw pRes.error;
  if (mRes.error) throw mRes.error;
  if (sRes.error) throw sRes.error;

  const participants = (pRes.data ?? []).map((r: Record<string, unknown>) => participantFromRow(r));
  const matches = (mRes.data ?? []).map((r: Record<string, unknown>) => matchFromRow(r));
  const slots = (sRes.data ?? []) as GroupSlotRow[];

  // Grupo ainda em andamento (ou sem partidas) → não avança nada.
  const groupMatches = matches.filter((m) => m.bracket === "group" && m.groupId === groupId);
  if (groupMatches.length === 0 || groupMatches.some((m) => m.status !== "finished")) return;

  // Classificação ITTF/CBTM deste grupo (position = rank + 1).
  const standings = computeGroupStandings(matches, participants)
    .filter((s) => s.groupId === groupId)
    .sort((a, b) => a.position - b.position);

  const matchById = new Map(matches.map((m) => [m.id, m]));
  // Quantos classificados apontam para cada partida de KO — total == 1 ⇒ BYE.
  const slotCountByMatch = new Map<string, number>();
  for (const s of slots) slotCountByMatch.set(s.match_id, (slotCountByMatch.get(s.match_id) ?? 0) + 1);

  const groupSlots = slots.filter((s) => s.group_id === groupId);

  // 1) Preenche os slots do mata-mata com os classificados deste grupo.
  for (const slot of groupSlots) {
    const qualifier = standings[slot.rank];
    if (!qualifier) continue;
    const col = slot.match_slot === 0 ? "participant_a_id" : "participant_b_id";
    const { error } = await client.from("tournament_matches").update({ [col]: qualifier.participantId }).eq("id", slot.match_id);
    if (error) throw error;
    const local = matchById.get(slot.match_id);
    if (local) {
      if (slot.match_slot === 0) local.participantAId = qualifier.participantId;
      else local.participantBId = qualifier.participantId;
    }
  }

  // 2) Ativa os jogos com os dois lados preenchidos (pending → scheduled).
  for (const slot of groupSlots) {
    const m = matchById.get(slot.match_id);
    if (m && m.participantAId && m.participantBId && m.status === "pending") {
      const { error } = await client.from("tournament_matches").update({ status: "scheduled" }).eq("id", m.id).eq("status", "pending");
      if (error) throw error;
      m.status = "scheduled";
    }
  }

  // 3) Auto-avanço por BYE: jogo de 1ª rodada com um único slot no total — o
  // classificado avança direto e é propagado para a próxima rodada.
  for (const slot of groupSlots) {
    if ((slotCountByMatch.get(slot.match_id) ?? 0) !== 1) continue;
    const m = matchById.get(slot.match_id);
    if (!m || m.winnerParticipantId) continue;
    const winner = m.participantAId ?? m.participantBId;
    if (!winner) continue;
    const { error: fErr } = await client.from("tournament_matches")
      .update({ winner_participant_id: winner, status: "finished", finished_at: new Date().toISOString() })
      .eq("id", m.id);
    if (fErr) throw fErr;
    m.winnerParticipantId = winner;
    m.status = "finished";

    if (!m.nextMatchId) continue;
    const col = m.nextMatchSlot === 0 ? "participant_a_id" : "participant_b_id";
    const { error: nErr } = await client.from("tournament_matches").update({ [col]: winner }).eq("id", m.nextMatchId);
    if (nErr) throw nErr;
    const next = matchById.get(m.nextMatchId);
    if (!next) continue;
    if (m.nextMatchSlot === 0) next.participantAId = winner;
    else next.participantBId = winner;
    if (next.participantAId && next.participantBId && next.status === "pending") {
      const { error: aErr } = await client.from("tournament_matches").update({ status: "scheduled" }).eq("id", next.id).eq("status", "pending");
      if (aErr) throw aErr;
      next.status = "scheduled";
    }
  }
}

export const supabaseRepo: TournamentRepo = {
  async listTournaments(filter) {
    const client = createAdminClient();
    let q = client.from("tournaments").select("*").order("created_at", { ascending: false });
    if (filter?.status) q = q.eq("status", filter.status);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => tournamentFromRow(r));
  },

  async getTournament(id) {
    const client = createAdminClient();
    const [tRes, pRes, mRes] = await Promise.all([
      client.from("tournaments").select("*").eq("id", id).single(),
      client.from("tournament_participants").select("*").eq("tournament_id", id)
        .order("seed", { ascending: true, nullsFirst: false }).order("created_at", { ascending: true }),
      client.from("tournament_matches").select("*").eq("tournament_id", id).order("round", { ascending: false }),
    ]);
    if (tRes.error || !tRes.data) return null;
    return {
      ...tournamentFromRow(tRes.data as Record<string, unknown>),
      participants: (pRes.data ?? []).map((r: Record<string, unknown>) => participantFromRow(r)),
      matches: (mRes.data ?? []).map((r: Record<string, unknown>) => matchFromRow(r)),
    } as TournamentDetail;
  },

  async createTournament(input: CreateTournamentInput) {
    const client = createAdminClient();
    const { data, error } = await client.from("tournaments").insert({
      name: input.name, format: input.format, best_of: input.bestOf,
      third_place_match: input.thirdPlaceMatch ?? true,
      seeding_method: input.seedingMethod, registration_mode: input.registrationMode,
      max_participants: input.maxParticipants ?? null, season_id: input.seasonId ?? null,
      created_by: input.createdBy,
      event_id: input.eventId ?? null,
      division_label: input.divisionLabel ?? null,
      division_order: input.divisionOrder ?? 0,
    }).select().single();
    if (error) throw error;
    return tournamentFromRow(data as Record<string, unknown>);
  },

  async updateTournament(id, patch) {
    const client = createAdminClient();
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.bestOf !== undefined) row.best_of = patch.bestOf;
    if (patch.branding !== undefined) row.branding = patch.branding;
    const { data, error } = await client.from("tournaments").update(row).eq("id", id).select().single();
    if (error) throw error;
    return tournamentFromRow(data as Record<string, unknown>);
  },

  async setThirdPlaceMatch(tournamentId, enabled) {
    const client = createAdminClient();
    // Atualiza o flag. A criação/remoção da partida 'placement' no bracket é
    // tratada pelo lado do banco (RPC generate_bracket / migration) — ver
    // supabase/migrations do third_place_match.
    const { data, error } = await client
      .from("tournaments")
      .update({ third_place_match: enabled })
      .eq("id", tournamentId)
      .select()
      .single();
    if (error) throw error;
    return tournamentFromRow(data as Record<string, unknown>);
  },

  async addParticipants(tournamentId, items: AddParticipantInput[]) {
    const client = createAdminClient();
    const rows = items.map((i) => ({
      tournament_id: tournamentId, user_id: i.userId ?? null, guest_name: i.guestName ?? null,
      flag: i.flag ?? null, avatar_url: i.avatarUrl ?? null, color: i.color ?? null,
      signup_status: "confirmed" as const,
    }));
    const { data, error } = await client.from("tournament_participants").insert(rows).select();
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => participantFromRow(r));
  },

  async removeParticipant(participantId) {
    const client = createAdminClient();
    const { error } = await client.from("tournament_participants").delete().eq("id", participantId);
    if (error) throw error;
  },

  async removeParticipants(tournamentId, participantIds) {
    if (participantIds.length === 0) return;
    const client = createAdminClient();
    // Trava de estado: não remove com o torneio em andamento/encerrado.
    const { data: t, error: tErr } = await client
      .from("tournaments").select("status").eq("id", tournamentId).single();
    if (tErr) throw tErr;
    if (t?.status === "active" || t?.status === "finished") {
      throw new Error("Não é possível remover inscritos com o torneio em andamento ou encerrado.");
    }
    // Remoção em lote numa única query (evita N round-trips).
    const { error } = await client
      .from("tournament_participants")
      .delete()
      .eq("tournament_id", tournamentId)
      .in("id", participantIds);
    if (error) throw error;
  },

  async saveSeeding(tournamentId, order: SaveSeedingInput[]) {
    const client = createAdminClient();
    await Promise.all(
      order.map((s) => {
        // Só atualiza grupo/pote quando enviados — reordenar seeds não pode
        // zerar o group_id (quebraria a tabela de pontos corridos / grupos).
        const upd: Record<string, unknown> = { seed: s.seed };
        if (s.groupId !== undefined) upd.group_id = s.groupId;
        if (s.pot !== undefined) upd.pot = s.pot;
        return client.from("tournament_participants").update(upd).eq("id", s.participantId);
      })
    );
  },

  async generateBracket(tournamentId, method: SeedingMethod) {
    const client = createAdminClient();
    const { data, error } = await client.rpc("generate_bracket", {
      p_tournament: tournamentId, p_method: method,
    });
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => matchFromRow(r));
  },

  async reportResult(matchId, input: ReportResultInput) {
    const client = createAdminClient();
    const { data, error } = await client.rpc("report_match_result", {
      p_match: matchId, p_a: input.scoreA, p_b: input.scoreB, p_sets: input.sets ?? null,
    });
    if (error) throw error;
    const match = matchFromRow(data as Record<string, unknown>);
    // Bloco B: a decisão de quem avança do grupo é feita no TS (ITTF/CBTM). O
    // auto-avanço SQL virou no-op (migration 20260701000100).
    if (match.bracket === "group" && match.groupId) {
      await advanceGroupQualifiers(client, match.tournamentId, match.groupId);
    }
    return match;
  },

  async revertResult(matchId) {
    const client = createAdminClient();
    const { error } = await client.rpc("revert_match_result", { p_match: matchId });
    if (error) throw error;
  },

  async walkover(matchId, winnerParticipantId) {
    const client = createAdminClient();
    const { data, error } = await client.rpc("walkover", {
      p_match: matchId, p_winner: winnerParticipantId,
    });
    if (error) throw error;
    const match = matchFromRow(data as Record<string, unknown>);
    // Bloco B: W.O. em jogo de grupo também dispara o avanço no TS (ver reportResult).
    if (match.bracket === "group" && match.groupId) {
      await advanceGroupQualifiers(client, match.tournamentId, match.groupId);
    }
    return match;
  },

  async getStandings(tournamentId) {
    // Classificação calculada no TS (fonte única) para aplicar o desempate oficial
    // ITTF/CBTM — a view SQL tournament_standings usa critério simplificado e não
    // tem pontos de game. Ver Bloco B (decisão "tudo em TS").
    const client = createAdminClient();
    const [pRes, mRes] = await Promise.all([
      client.from("tournament_participants").select("*").eq("tournament_id", tournamentId),
      client.from("tournament_matches").select("*").eq("tournament_id", tournamentId).eq("bracket", "group"),
    ]);
    if (pRes.error) throw pRes.error;
    if (mRes.error) throw mRes.error;
    const participants = (pRes.data ?? []).map((r: Record<string, unknown>) => participantFromRow(r));
    const matches = (mRes.data ?? []).map((r: Record<string, unknown>) => matchFromRow(r));
    return computeGroupStandings(matches, participants);
  },

  async closeGroupStage(tournamentId) {
    const client = createAdminClient();
    // Bloco B: fecha os grupos avançando os classificados no TS (fonte única
    // ITTF/CBTM). Não usa mais o RPC close_group_stage, cujo avanço SQL é no-op.
    const { data, error } = await client
      .from("tournament_group_slots")
      .select("group_id")
      .eq("tournament_id", tournamentId);
    if (error) throw error;
    const groupIds = Array.from(new Set((data ?? []).map((r: { group_id: string }) => r.group_id))).sort();
    for (const groupId of groupIds) {
      await advanceGroupQualifiers(client, tournamentId, groupId);
    }
  },

  async finishTournament(tournamentId, championParticipantId) {
    const client = createAdminClient();
    const part = await client
      .from("tournament_participants")
      .select("user_id, guest_name")
      .eq("id", championParticipantId)
      .single();
    const { data, error } = await client
      .from("tournaments")
      .update({
        status: "finished",
        champion_user_id: part.data?.user_id ?? null,
        champion_name: part.data?.guest_name ?? null,
        finished_at: new Date().toISOString(),
      })
      .eq("id", tournamentId)
      .select()
      .single();
    if (error) throw error;
    return tournamentFromRow(data as Record<string, unknown>);
  },

  async openRegistration(tournamentId) {
    await this.updateTournament(tournamentId, { status: "registration" });
  },

  async closeRegistration(tournamentId) {
    await this.updateTournament(tournamentId, { status: "active" });
  },

  // ── Eventos / Divisões ──

  async listEvents() {
    const client = createAdminClient();
    const { data, error } = await client.from("tournament_events").select("*").order("event_date", { ascending: false });
    if (error) throw error;
    const evs = (data ?? []).map((r: Record<string, unknown>) => tournamentEventFromRow(r));
    return Promise.all(
      evs.map(async (ev: TournamentEvent): Promise<EventListItem> => {
        const [cats, live] = await Promise.all([
          client.from("tournaments").select("id, status").eq("event_id", ev.id).order("division_order", { ascending: true }),
          client.from("tournaments").select("id, tournament_matches!inner(id)").eq("event_id", ev.id).eq("tournament_matches.status", "in_progress"),
        ]);
        const ids = (cats.data ?? []) as { id: string; status: TournamentStatus }[];
        const hasLive = (live.data ?? []).length > 0;
        return {
          ...ev,
          categoriesCount: ids.length,
          firstCategoryId: ids[0]?.id ?? null,
          hasLiveMatch: hasLive,
          status: deriveEventStatus(ids.map((c) => c.status), hasLive),
        };
      }),
    );
  },

  async getEvent(eventId): Promise<TournamentEventDetail | null> {
    const client = createAdminClient();
    const [evRes, divRes] = await Promise.all([
      client.from("tournament_events").select("*").eq("id", eventId).single(),
      client.from("tournaments").select("*").eq("event_id", eventId).order("division_order", { ascending: true }),
    ]);
    if (evRes.error || !evRes.data) return null;
    const divisionTournaments = (divRes.data ?? []).map((r: Record<string, unknown>) => tournamentFromRow(r));
    // Contagem de participantes e jogos ao vivo por divisão.
    const divisions: DivisionSummary[] = await Promise.all(
      divisionTournaments.map(async (t: Tournament): Promise<DivisionSummary> => {
        const [pCount, live] = await Promise.all([
          client.from("tournament_participants").select("id", { count: "exact", head: true }).eq("tournament_id", t.id),
          client.from("tournament_matches").select("id", { count: "exact", head: true }).eq("tournament_id", t.id).eq("status", "in_progress"),
        ]);
        return {
          id: t.id, name: t.name, divisionLabel: t.divisionLabel, divisionOrder: t.divisionOrder,
          format: t.format, status: t.status, participantCount: pCount.count ?? 0,
          championName: t.championName, hasLiveMatch: (live.count ?? 0) > 0,
          startTime: t.startTime, levelDescription: t.levelDescription,
        };
      }),
    );
    return { ...tournamentEventFromRow(evRes.data as Record<string, unknown>), divisions };
  },

  async createEvent(input: CreateEventInput) {
    const client = createAdminClient();
    const { data, error } = await client.from("tournament_events").insert({
      name: input.name, event_date: input.eventDate ?? null, venue: input.venue ?? null,
      season_id: input.seasonId ?? null, created_by: input.createdBy,
    }).select().single();
    if (error) throw error;
    return tournamentEventFromRow(data as Record<string, unknown>);
  },

  async updateEvent(eventId, patch) {
    const client = createAdminClient();
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.eventDate !== undefined) row.event_date = patch.eventDate;
    if (patch.venue !== undefined) row.venue = patch.venue;
    if (patch.branding !== undefined) row.branding = patch.branding;
    const { data, error } = await client.from("tournament_events").update(row).eq("id", eventId).select().single();
    if (error) throw error;
    return tournamentEventFromRow(data as Record<string, unknown>);
  },

  async addDivision(eventId, input: AddDivisionInput) {
    const client = createAdminClient();
    const ev = await client.from("tournament_events").select("name, season_id, created_by, branding").eq("id", eventId).single();
    if (ev.error || !ev.data) throw new Error("Evento não encontrado");
    const countRes = await client.from("tournaments").select("id", { count: "exact", head: true }).eq("event_id", eventId);
    const { data, error } = await client.from("tournaments").insert({
      name: `${ev.data.name} — ${input.label}`, format: input.format, best_of: input.bestOf,
      seeding_method: input.seedingMethod ?? "standard", registration_mode: input.registrationMode ?? "invite",
      season_id: ev.data.season_id ?? null, branding: ev.data.branding ?? null, created_by: ev.data.created_by,
      event_id: eventId, division_label: input.label, division_order: countRes.count ?? 0,
    }).select().single();
    if (error) throw error;
    return tournamentFromRow(data as Record<string, unknown>);
  },

  async setDivisionOrder(eventId, order) {
    const client = createAdminClient();
    await Promise.all(
      order.map((o) =>
        client.from("tournaments").update({ division_order: o.divisionOrder }).eq("id", o.tournamentId).eq("event_id", eventId),
      ),
    );
  },

  // ── Bloco C Fase 2 — informações do evento (C1) + inscrição nativa (C2) ──

  async updateEventInfo(eventId, info: EventInfo) {
    const client = createAdminClient();
    const { data, error } = await client.from("tournament_events").update({ info }).eq("id", eventId).select().single();
    if (error) throw error;
    return tournamentEventFromRow(data as Record<string, unknown>);
  },

  async updateDivisionInfo(tournamentId, patch) {
    const client = createAdminClient();
    const row: Record<string, unknown> = {};
    if (patch.startTime !== undefined) row.start_time = patch.startTime;
    if (patch.levelDescription !== undefined) row.level_description = patch.levelDescription;
    const { data, error } = await client.from("tournaments").update(row).eq("id", tournamentId).select().single();
    if (error) throw error;
    return tournamentFromRow(data as Record<string, unknown>);
  },

  async createEventSignup(eventId, input: CreateEventSignupInput) {
    if (input.paymentMode === "gateway") {
      throw new Error("Pagamento automático (gateway) estará disponível numa fase posterior.");
    }
    if (input.divisions.length < 1 || input.divisions.length > 2) {
      throw new Error("Escolha 1 ou 2 divisões.");
    }
    if (!input.agreedRules) throw new Error("É necessário concordar com as regras.");

    const client = createAdminClient();
    const confirmed = input.paymentMode === "free";
    const { data, error } = await client.from("event_signups").insert({
      event_id: eventId, full_name: input.fullName, email: input.email ?? null,
      phone: input.phone ?? null, club: input.club ?? null,
      cbtm_affiliated: input.cbtmAffiliated ?? false, cbtm_rating: input.cbtmRating ?? null,
      divisions: input.divisions, amount_cents: input.amountCents ?? null,
      payment_mode: input.paymentMode, payment_status: confirmed ? "confirmed" : "pending",
      agreed_rules: input.agreedRules, notes: input.notes ?? null,
    }).select().single();
    if (error) throw error;
    const signup = eventSignupFromRow(data as Record<string, unknown>);
    if (confirmed) await generateSignupParticipants(client, signup);
    return signup;
  },

  async listEventSignups(eventId) {
    const client = createAdminClient();
    const { data, error } = await client
      .from("event_signups").select("*").eq("event_id", eventId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => eventSignupFromRow(r));
  },

  async confirmEventSignup(signupId) {
    const client = createAdminClient();
    const { data, error } = await client.from("event_signups").select("*").eq("id", signupId).single();
    if (error) throw error;
    const signup = eventSignupFromRow(data as Record<string, unknown>);
    if (signup.paymentStatus === "confirmed") return; // idempotente
    // Confirma condicionando ao estado pendente (evita corrida gerar 2×).
    const { data: upd, error: uErr } = await client
      .from("event_signups").update({ payment_status: "confirmed" })
      .eq("id", signupId).neq("payment_status", "confirmed").select();
    if (uErr) throw uErr;
    if (!upd || upd.length === 0) return; // já confirmada por outra chamada
    await generateSignupParticipants(client, signup);
  },

  async rejectEventSignup(signupId) {
    const client = createAdminClient();
    const { error } = await client.from("event_signups").update({ payment_status: "rejected" }).eq("id", signupId);
    if (error) throw error;
  },
};

/** Gera 1 `tournament_participant` por divisão de uma inscrição confirmada.
 * Vincula `user_id` por e-mail (best-effort). Usado por create(free)/confirm. */
async function generateSignupParticipants(client: AdminClient, signup: EventSignup) {
  let userId: string | null = null;
  if (signup.email) {
    try {
      const { data: u } = await client.from("users").select("id").ilike("email", signup.email.trim()).maybeSingle();
      userId = (u?.id as string | undefined) ?? null;
    } catch { /* schema de users pode variar; sem vínculo não bloqueia a inscrição */ }
  }
  const rows = signup.divisions.map((divId) => ({
    tournament_id: divId, user_id: userId, guest_name: signup.fullName,
    pot: signup.cbtmRating, signup_status: "confirmed" as const,
  }));
  if (rows.length === 0) return;
  const { error } = await client.from("tournament_participants").insert(rows);
  if (error) throw error;
}
