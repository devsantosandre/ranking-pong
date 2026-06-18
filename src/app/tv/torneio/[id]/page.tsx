import { getTournamentRepo } from "@/lib/tournaments/repo";
import { notFound } from "next/navigation";
import { TvBracketView } from "@/components/tv/tv-bracket-view";
import { TvKingView } from "@/components/tv/tv-king-view";

export const dynamic = "force-dynamic";

export default async function TvTournamentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repo = await getTournamentRepo();
  const tournament = await repo.getTournament(id);

  if (!tournament) notFound();

  const isActive = tournament.status === "active";
  const commonProps = {
    tournamentId: id,
    initialMatches: tournament.matches,
    initialParticipants: tournament.participants,
    tournamentName: tournament.name,
    isActive,
  };

  if (tournament.format === "king_of_table") {
    return <TvKingView {...commonProps} />;
  }

  return <TvBracketView {...commonProps} />;
}
