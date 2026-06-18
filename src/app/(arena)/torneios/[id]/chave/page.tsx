import { ArenaShell } from "@/components/arena/arena-shell";
import { getTournamentRepo } from "@/lib/tournaments/repo";
import { notFound } from "next/navigation";
import { BracketClientShell } from "./bracket-client-shell";
import { computeGroupStandings } from "@/lib/tournaments/standings";

export const dynamic = "force-dynamic";

export default async function ChavePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repo = await getTournamentRepo();
  const tournament = await repo.getTournament(id);

  if (!tournament) notFound();

  const hasGroups = tournament.matches.some((m) => m.bracket === "group");
  const standings = hasGroups
    ? computeGroupStandings(tournament.matches, tournament.participants)
    : [];

  return (
    <ArenaShell title={tournament.name} subtitle="Chave do torneio" showBack layoutWidth="full">
      <BracketClientShell
        tournamentId={id}
        initialMatches={tournament.matches}
        participants={tournament.participants}
        isLive={tournament.status === "active"}
        bestOf={tournament.bestOf}
        initialStandings={standings}
      />
    </ArenaShell>
  );
}
