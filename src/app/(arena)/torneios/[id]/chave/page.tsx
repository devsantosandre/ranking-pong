import { ArenaShell } from "@/components/arena/arena-shell";
import { getTournamentRepo } from "@/lib/tournaments/repo";
import { notFound } from "next/navigation";
import { BracketClientShell } from "./bracket-client-shell";
import { DivisionSwitcher } from "@/components/tournaments/division-switcher";
import { computeGroupStandings } from "@/lib/tournaments/standings";
import { isAdminServer } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function ChavePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repo = await getTournamentRepo();
  const [tournament, admin] = await Promise.all([repo.getTournament(id), isAdminServer()]);

  if (!tournament) notFound();

  // Rascunho só é visível para o admin (organizador ainda configurando).
  if (tournament.status === "draft" && !admin) notFound();

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
        // Torneio encerrado é histórico: somente leitura para todos, inclusive admin.
        // A correção de um resultado passado é feita pelo painel admin (reabrir torneio).
        isAdmin={admin && tournament.status !== "finished"}
        isRoundRobin={tournament.format === "round_robin"}
        initialStandings={standings}
      />
    </ArenaShell>
  );
}
