import type { TournamentRepo } from "./tournament-repo";
import { mockRepo } from "./mock-repo";

// Troca entre mock e supabase via env.
// Para usar supabase: NEXT_PUBLIC_DATA_SOURCE=supabase
let _repo: TournamentRepo | null = null;

export async function getTournamentRepo(): Promise<TournamentRepo> {
  if (_repo) return _repo;

  const source = process.env.NEXT_PUBLIC_DATA_SOURCE ?? "mock";
  if (source === "supabase") {
    const { supabaseRepo } = await import("./supabase-repo");
    _repo = supabaseRepo;
  } else {
    _repo = mockRepo;
  }
  return _repo;
}

export type { TournamentRepo };
export type { CreateTournamentInput, AddParticipantInput, ReportResultInput, SaveSeedingInput } from "./tournament-repo";
