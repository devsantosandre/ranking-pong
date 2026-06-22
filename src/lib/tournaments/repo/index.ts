import type { TournamentRepo } from "./tournament-repo";
import { supabaseRepo } from "./supabase-repo";

export async function getTournamentRepo(): Promise<TournamentRepo> {
  return supabaseRepo;
}

export type { TournamentRepo };
export type { CreateTournamentInput, AddParticipantInput, ReportResultInput, SaveSeedingInput } from "./tournament-repo";
