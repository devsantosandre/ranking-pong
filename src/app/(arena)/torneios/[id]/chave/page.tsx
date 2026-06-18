import { ArenaShell } from "@/components/arena/arena-shell";
import { getTournamentRepo } from "@/lib/tournaments/repo";
import { notFound } from "next/navigation";
import { BracketClientShell } from "./bracket-client-shell";
import { DivisionSwitcher } from "@/components/tournaments/division-switcher";
import { computeGroupStandings } from "@/lib/tournaments/standings";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

// Em mock (dev) o organizador edita direto; em supabase, exige role admin.
async function isAdminServer(): Promise<boolean> {
  if ((process.env.NEXT_PUBLIC_DATA_SOURCE ?? "mock") !== "supabase") return true;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase.from("users").select("role").eq("id", user.id).single();
    return data?.role === "admin";
  } catch {
    return false;
  }
}

export default async function ChavePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repo = await getTournamentRepo();
  const [tournament, admin] = await Promise.all([repo.getTournament(id), isAdminServer()]);

  if (!tournament) notFound();

  const hasGroups = tournament.matches.some((m) => m.bracket === "group");
  const standings = hasGroups
    ? computeGroupStandings(tournament.matches, tournament.participants)
    : [];

  return (
    <ArenaShell title={tournament.name} subtitle="Chave do torneio" showBack layoutWidth="full">
      {tournament.eventId && (
        <div className="px-4 pt-3 sm:px-6">
          <DivisionSwitcher eventId={tournament.eventId} currentTournamentId={id} variant="public" />
        </div>
      )}
      <BracketClientShell
        tournamentId={id}
        initialMatches={tournament.matches}
        participants={tournament.participants}
        isLive={tournament.status === "active"}
        bestOf={tournament.bestOf}
        isAdmin={admin}
        isRoundRobin={tournament.format === "round_robin"}
        initialStandings={standings}
      />
    </ArenaShell>
  );
}
