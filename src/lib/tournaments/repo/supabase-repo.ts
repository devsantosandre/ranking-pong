import { createClient } from "@/utils/supabase/client";
import type { TournamentRepo, CreateTournamentInput, AddParticipantInput, ReportResultInput, SaveSeedingInput, CreateEventInput, AddDivisionInput } from "./tournament-repo";
import type { Tournament, TournamentEventDetail, DivisionSummary, TournamentParticipant, TournamentMatch, TournamentDetail, GroupStanding, SeedingMethod } from "../types";
import { tournamentFromRow, tournamentEventFromRow, participantFromRow, matchFromRow } from "../types";

export const supabaseRepo: TournamentRepo = {
  async listTournaments(filter) {
    const client = createClient();
    let q = client.from("tournaments").select("*").order("created_at", { ascending: false });
    if (filter?.status) q = q.eq("status", filter.status);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => tournamentFromRow(r));
  },

  async getTournament(id) {
    const client = createClient();
    const [tRes, pRes, mRes] = await Promise.all([
      client.from("tournaments").select("*").eq("id", id).single(),
      client.from("tournament_participants").select("*").eq("tournament_id", id),
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
    const client = createClient();
    const { data, error } = await client.from("tournaments").insert({
      name: input.name, format: input.format, best_of: input.bestOf,
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
    const client = createClient();
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.bestOf !== undefined) row.best_of = patch.bestOf;
    if (patch.branding !== undefined) row.branding = patch.branding;
    const { data, error } = await client.from("tournaments").update(row).eq("id", id).select().single();
    if (error) throw error;
    return tournamentFromRow(data as Record<string, unknown>);
  },

  async addParticipants(tournamentId, items: AddParticipantInput[]) {
    const client = createClient();
    const rows = items.map((i) => ({
      tournament_id: tournamentId, user_id: i.userId ?? null, guest_name: i.guestName ?? null,
      flag: i.flag ?? null, avatar_url: i.avatarUrl ?? null, color: i.color ?? null,
    }));
    const { data, error } = await client.from("tournament_participants").insert(rows).select();
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => participantFromRow(r));
  },

  async removeParticipant(participantId) {
    const client = createClient();
    const { error } = await client.from("tournament_participants").delete().eq("id", participantId);
    if (error) throw error;
  },

  async saveSeeding(tournamentId, order: SaveSeedingInput[]) {
    const client = createClient();
    await Promise.all(
      order.map((s) =>
        client.from("tournament_participants")
          .update({ seed: s.seed, group_id: s.groupId ?? null, pot: s.pot ?? null })
          .eq("id", s.participantId)
      )
    );
  },

  async generateBracket(tournamentId, method: SeedingMethod) {
    const client = createClient();
    const { data, error } = await client.rpc("generate_bracket", {
      p_tournament: tournamentId, p_method: method,
    });
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => matchFromRow(r));
  },

  async reportResult(matchId, input: ReportResultInput) {
    const client = createClient();
    const { data, error } = await client.rpc("report_match_result", {
      p_match: matchId, p_a: input.scoreA, p_b: input.scoreB, p_sets: input.sets ?? null,
    });
    if (error) throw error;
    return matchFromRow(data as Record<string, unknown>);
  },

  async revertResult(matchId) {
    const client = createClient();
    const { error } = await client.rpc("revert_match_result", { p_match: matchId });
    if (error) throw error;
  },

  async walkover(matchId, winnerParticipantId) {
    const client = createClient();
    const { data, error } = await client.rpc("walkover", {
      p_match: matchId, p_winner: winnerParticipantId,
    });
    if (error) throw error;
    return matchFromRow(data as Record<string, unknown>);
  },

  async getStandings(tournamentId) {
    const client = createClient();
    const { data, error } = await client
      .from("tournament_standings")
      .select("*")
      .eq("tournament_id", tournamentId);
    if (error) throw error;
    return (data ?? []) as GroupStanding[];
  },

  async closeGroupStage(tournamentId) {
    const client = createClient();
    const { error } = await client.rpc("close_group_stage", { p_tournament: tournamentId });
    if (error) throw error;
  },

  async finishTournament(tournamentId, championParticipantId) {
    const client = createClient();
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
    const client = createClient();
    const { data, error } = await client.from("tournament_events").select("*").order("event_date", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => tournamentEventFromRow(r));
  },

  async getEvent(eventId): Promise<TournamentEventDetail | null> {
    const client = createClient();
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
        };
      }),
    );
    return { ...tournamentEventFromRow(evRes.data as Record<string, unknown>), divisions };
  },

  async createEvent(input: CreateEventInput) {
    const client = createClient();
    const { data, error } = await client.from("tournament_events").insert({
      name: input.name, event_date: input.eventDate ?? null, venue: input.venue ?? null,
      season_id: input.seasonId ?? null, created_by: input.createdBy,
    }).select().single();
    if (error) throw error;
    return tournamentEventFromRow(data as Record<string, unknown>);
  },

  async updateEvent(eventId, patch) {
    const client = createClient();
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
    const client = createClient();
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
    const client = createClient();
    await Promise.all(
      order.map((o) =>
        client.from("tournaments").update({ division_order: o.divisionOrder }).eq("id", o.tournamentId).eq("event_id", eventId),
      ),
    );
  },
};
