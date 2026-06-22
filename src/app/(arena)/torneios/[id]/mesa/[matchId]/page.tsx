import { ArenaShell } from "@/components/arena/arena-shell";
import { getTournamentRepo } from "@/lib/tournaments/repo";
import { notFound } from "next/navigation";
import { ScoreAtTableClient } from "./score-at-table-client";
import { isAdminServer } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function ScoreAtTablePage({
  params,
}: {
  params: Promise<{ id: string; matchId: string }>;
}) {
  const { id, matchId } = await params;
  const repo = await getTournamentRepo();
  const [tournament, admin] = await Promise.all([repo.getTournament(id), isAdminServer()]);

  if (!tournament) notFound();

  // Lançar placar é ação de organizador — bloqueia não-admin (defesa em
  // profundidade; a server action reportResult já exige admin).
  if (!admin) notFound();

  // Torneio encerrado é somente leitura — não há placar a lançar.
  if (tournament.status === "finished") notFound();

  const match = tournament.matches.find((m) => m.id === matchId);
  if (!match || match.status === "finished") notFound();

  return (
    <ArenaShell title="Lançar placar" subtitle={tournament.name} showBack>
      <ScoreAtTableClient
        match={match}
        participants={tournament.participants}
        tournamentId={id}
        bestOf={tournament.bestOf}
      />
    </ArenaShell>
  );
}
