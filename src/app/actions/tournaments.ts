"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTournamentRepo } from "@/lib/tournaments/repo";
import { createClient } from "@/utils/supabase/server";
import type { SeedingMethod } from "@/lib/tournaments/types";

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (data?.role !== "admin") throw new Error("Acesso negado");
  return user;
}

async function logAdmin(action: string, details: Record<string, unknown>) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("admin_logs").insert({ action, details, created_by: user.id });
    }
  } catch {}
}

function invalidateTournament(id: string) {
  revalidatePath(`/torneios/${id}`);
  revalidatePath(`/torneios/${id}/chave`);
  revalidatePath(`/admin/torneios/${id}`);
}

const createTournamentSchema = z.object({
  name: z.string().min(2).max(100),
  format: z.enum(["single_elimination","double_elimination","round_robin","groups_knockout","swiss","scorecard","americano","king_of_table","league"]),
  bestOf: z.number().int().refine((n) => [1,3,5,7].includes(n), "Deve ser 1, 3, 5 ou 7"),
  thirdPlaceMatch: z.boolean().optional().default(true),
  seedingMethod: z.enum(["standard","pots","sequential","manual","elo"]).default("standard"),
  registrationMode: z.enum(["invite","open"]).default("invite"),
  maxParticipants: z.number().int().min(2).max(256).optional(),
  seasonId: z.string().uuid().optional(),
});

export async function createTournament(rawInput: unknown) {
  const user = await assertAdmin();
  const input = createTournamentSchema.parse(rawInput);
  const repo = await getTournamentRepo();
  const tournament = await repo.createTournament({ ...input, createdBy: user.id });
  await logAdmin("tournament_create", { id: tournament.id, name: tournament.name });
  revalidatePath("/torneios");
  revalidatePath("/admin/torneios");
  return { tournament };
}

export async function updateTournament(id: string, rawPatch: unknown) {
  await assertAdmin();
  const patch = z.object({
    name: z.string().min(2).max(100).optional(),
    status: z.enum(["draft","registration","active","finished"]).optional(),
    bestOf: z.number().int().optional(),
  }).parse(rawPatch);
  const repo = await getTournamentRepo();
  const tournament = await repo.updateTournament(id, patch);
  invalidateTournament(id);
  revalidatePath("/torneios");
  return { tournament };
}

const addParticipantsSchema = z.array(
  z.object({
    userId: z.string().min(1).optional(),
    guestName: z.string().min(1).max(80).optional(),
    flag: z.string().max(4).optional(),
    color: z.string().max(10).optional(),
    avatarUrl: z.string().url().optional(),
  }).refine((i) => i.userId || i.guestName, "userId ou guestName obrigatório")
);

export async function setThirdPlaceMatch(tournamentId: string, enabled: boolean) {
  await assertAdmin();
  const repo = await getTournamentRepo();
  const tournament = await repo.setThirdPlaceMatch(tournamentId, enabled);
  await logAdmin("tournament_third_place_match", { tournament_id: tournamentId, enabled });
  invalidateTournament(tournamentId);
  revalidatePath("/torneios");
  return { tournament };
}

export async function addParticipants(tournamentId: string, rawItems: unknown) {
  await assertAdmin();
  const items = addParticipantsSchema.parse(rawItems);
  const repo = await getTournamentRepo();
  const added = await repo.addParticipants(tournamentId, items);
  invalidateTournament(tournamentId);
  return { added };
}

export async function removeParticipant(participantId: string, tournamentId: string) {
  await assertAdmin();
  const repo = await getTournamentRepo();
  await repo.removeParticipant(participantId);
  invalidateTournament(tournamentId);
  return { ok: true };
}

const saveSeedingSchema = z.array(
  z.object({
    participantId: z.string().min(1),
    seed: z.number().int().min(1),
    groupId: z.string().optional(),
    pot: z.number().int().optional(),
  })
);

export async function saveSeeding(tournamentId: string, rawOrder: unknown) {
  await assertAdmin();
  const order = saveSeedingSchema.parse(rawOrder);
  const repo = await getTournamentRepo();
  await repo.saveSeeding(tournamentId, order);
  invalidateTournament(tournamentId);
  return { ok: true };
}

export async function generateBracket(tournamentId: string, method: SeedingMethod = "standard") {
  await assertAdmin();
  const repo = await getTournamentRepo();
  const matches = await repo.generateBracket(tournamentId, method);
  await logAdmin("tournament_generate_bracket", { tournament_id: tournamentId, method });
  invalidateTournament(tournamentId);
  return { matches };
}

const reportResultSchema = z.object({
  scoreA: z.number().int().min(0),
  scoreB: z.number().int().min(0),
  sets: z.array(z.tuple([z.number(), z.number()])).optional(),
}).refine((r) => r.scoreA !== r.scoreB, {
  message: "Placar não pode terminar empatado.",
  path: ["scoreB"],
});

export async function reportResult(matchId: string, rawInput: unknown) {
  await assertAdmin();
  const input = reportResultSchema.parse(rawInput);
  const repo = await getTournamentRepo();
  const match = await repo.reportResult(matchId, input);
  await logAdmin("tournament_result", { match_id: matchId, ...input });
  invalidateTournament(match.tournamentId);
  return { match };
}

export async function revertResult(matchId: string, tournamentId: string) {
  await assertAdmin();
  const repo = await getTournamentRepo();
  await repo.revertResult(matchId);
  await logAdmin("tournament_revert", { match_id: matchId });
  invalidateTournament(tournamentId);
  return { ok: true };
}

export async function finishTournament(tournamentId: string, championParticipantId: string) {
  await assertAdmin();
  const repo = await getTournamentRepo();
  const tournament = await repo.finishTournament(tournamentId, championParticipantId);
  await logAdmin("tournament_finish", { tournament_id: tournamentId, champion: championParticipantId });
  invalidateTournament(tournamentId);
  revalidatePath("/torneios");
  return { tournament };
}

export async function openRegistration(tournamentId: string) {
  await assertAdmin();
  const repo = await getTournamentRepo();
  await repo.openRegistration(tournamentId);
  invalidateTournament(tournamentId);
  revalidatePath("/torneios");
  return { ok: true };
}

export async function closeRegistration(tournamentId: string) {
  await assertAdmin();
  const repo = await getTournamentRepo();
  await repo.closeRegistration(tournamentId);
  invalidateTournament(tournamentId);
  revalidatePath("/torneios");
  return { ok: true };
}

export async function closeGroupStage(tournamentId: string) {
  await assertAdmin();
  const repo = await getTournamentRepo();
  await repo.closeGroupStage(tournamentId);
  await logAdmin("tournament_close_group_stage", { tournament_id: tournamentId });
  invalidateTournament(tournamentId);
  revalidatePath("/torneios");
  return { ok: true };
}

export async function configureGroups(
  tournamentId: string,
  assignments: { participantId: string; groupId: string }[],
) {
  await assertAdmin();
  if (assignments.length < 4) throw new Error("Participantes insuficientes para os grupos.");
  const repo = await getTournamentRepo();
  const detail = await repo.getTournament(tournamentId);
  if (!detail) throw new Error("Torneio não encontrado");

  const seedMap = new Map(detail.participants.map((p) => [p.id, p.seed ?? 999]));
  const seedingInput = assignments.map((a) => ({
    participantId: a.participantId,
    seed: seedMap.get(a.participantId) ?? 999,
    groupId: a.groupId,
  }));

  await repo.saveSeeding(tournamentId, seedingInput);
  await repo.generateBracket(tournamentId, "standard");
  await logAdmin("tournament_configure_groups", { tournament_id: tournamentId, num_groups: new Set(assignments.map((a) => a.groupId)).size });
  invalidateTournament(tournamentId);
  revalidatePath("/torneios");
  return { ok: true };
}

const registerSelfSchema = z.object({
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres").max(80),
  flag: z.string().max(4).optional(),
});

export async function registerSelf(tournamentId: string, rawInput: unknown) {
  const { name, flag } = registerSelfSchema.parse(rawInput);
  const repo = await getTournamentRepo();
  const detail = await repo.getTournament(tournamentId);

  if (!detail) throw new Error("Torneio não encontrado");
  if (detail.status !== "registration") throw new Error("Inscrições não estão abertas para este torneio");

  const confirmed = detail.participants.filter((p) => p.signupStatus === "confirmed");
  if (detail.maxParticipants && confirmed.length >= detail.maxParticipants) {
    throw new Error("Vagas esgotadas");
  }

  const added = await repo.addParticipants(tournamentId, [{ guestName: name, flag }]);
  invalidateTournament(tournamentId);
  revalidatePath(`/torneios/${tournamentId}/inscrever`);
  return { participant: added[0]! };
}

// ── Eventos / Divisões (Opção B) ──────────────────────────────────────────

function invalidateEvent(eventId: string) {
  revalidatePath("/admin/eventos");
  revalidatePath(`/admin/eventos/${eventId}`);
  revalidatePath(`/eventos/${eventId}`);
  revalidatePath(`/tv/evento/${eventId}`);
  revalidatePath("/torneios");
}

const createEventSchema = z.object({
  name: z.string().min(2).max(100),
  eventDate: z.string().optional(),
  venue: z.string().max(120).optional(),
  seasonId: z.string().uuid().optional(),
});

export async function createEvent(rawInput: unknown) {
  const user = await assertAdmin();
  const input = createEventSchema.parse(rawInput);
  const repo = await getTournamentRepo();
  const event = await repo.createEvent({ ...input, createdBy: user.id });
  await logAdmin("event_create", { id: event.id, name: event.name });
  revalidatePath("/admin/eventos");
  return { event };
}

export async function updateEvent(eventId: string, rawPatch: unknown) {
  await assertAdmin();
  const patch = z.object({
    name: z.string().min(2).max(100).optional(),
    eventDate: z.string().optional(),
    venue: z.string().max(120).optional(),
  }).parse(rawPatch);
  const repo = await getTournamentRepo();
  const event = await repo.updateEvent(eventId, patch);
  invalidateEvent(eventId);
  return { event };
}

const addDivisionSchema = z.object({
  label: z.string().min(1).max(60),
  format: z.enum(["single_elimination","double_elimination","round_robin","groups_knockout","swiss","scorecard","americano","king_of_table","league"]),
  bestOf: z.number().int().refine((n) => [1,3,5,7].includes(n), "Deve ser 1, 3, 5 ou 7"),
  seedingMethod: z.enum(["standard","pots","sequential","manual","elo"]).optional(),
  registrationMode: z.enum(["invite","open"]).optional(),
});

export async function addDivision(eventId: string, rawInput: unknown) {
  await assertAdmin();
  const input = addDivisionSchema.parse(rawInput);
  const repo = await getTournamentRepo();
  const division = await repo.addDivision(eventId, input);
  await logAdmin("event_add_division", { event_id: eventId, division_id: division.id, label: input.label });
  invalidateEvent(eventId);
  return { division };
}

const setDivisionOrderSchema = z.array(
  z.object({ tournamentId: z.string().min(1), divisionOrder: z.number().int().min(0) }),
);

export async function setDivisionOrder(eventId: string, rawOrder: unknown) {
  await assertAdmin();
  const order = setDivisionOrderSchema.parse(rawOrder);
  const repo = await getTournamentRepo();
  await repo.setDivisionOrder(eventId, order);
  invalidateEvent(eventId);
  return { ok: true };
}
