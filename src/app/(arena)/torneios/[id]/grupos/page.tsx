import { ArenaShell } from "@/components/arena/arena-shell";
import { getTournamentRepo } from "@/lib/tournaments/repo";
import { notFound } from "next/navigation";
import { StandingsTable } from "@/components/tournaments/standings-table";
import Link from "next/link";
import { Network, ChevronRight } from "lucide-react";
import { GlassCard } from "@/components/arena/glass-card";
import { isAdminServer } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function GruposPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repo = await getTournamentRepo();
  const [tournament, admin] = await Promise.all([repo.getTournament(id), isAdminServer()]);

  if (!tournament) notFound();

  // Rascunho só é visível para o admin.
  if (tournament.status === "draft" && !admin) notFound();

  const standings = await repo.getStandings(id);

  return (
    <ArenaShell title={tournament.name} subtitle="Fase de grupos" showBack>
      <div className="flex flex-col gap-4">
        <StandingsTable
          standings={standings}
          participants={tournament.participants}
          qualifyingSpots={2}
        />

        {/* Link para a chave se existir */}
        {tournament.matches.some((m) => m.bracket === "winners" && m.round === 1) && (
          <Link href={`/torneios/${id}/chave`}>
            <GlassCard
              noPadding
              className="group flex items-center gap-3 px-4 py-3 transition-all hover:scale-[1.01]"
              glow="active"
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: "color-mix(in srgb,var(--state-active) 15%,transparent)" }}
              >
                <Network className="h-5 w-5" style={{ color: "var(--state-active)" }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-(--arena-foreground)">Mata-mata</p>
                <p className="text-[11px] text-(--arena-muted)">Ver bracket ao vivo</p>
              </div>
              <ChevronRight className="h-4 w-4 text-(--arena-muted) transition group-hover:translate-x-0.5" />
            </GlassCard>
          </Link>
        )}
      </div>
    </ArenaShell>
  );
}
