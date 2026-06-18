import { ArenaShell } from "@/components/arena/arena-shell";
import { GlassCard } from "@/components/arena/glass-card";
import { StatusPill } from "@/components/arena/status-pill";
import { getTournamentRepo } from "@/lib/tournaments/repo";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Trophy, Users, Network, ChevronRight, LayoutGrid } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TournamentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repo = await getTournamentRepo();
  const tournament = await repo.getTournament(id);

  if (!tournament) notFound();

  const confirmedParticipants = tournament.participants.filter(
    (p) => p.signupStatus === "confirmed",
  );
  const hasBracket = tournament.matches.some((m) => m.bracket !== "group");
  const hasGroupStage = tournament.matches.some((m) => m.bracket === "group");

  return (
    <ArenaShell title={tournament.name} showBack>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <GlassCard
          variant="elevated"
          className="relative overflow-hidden"
        >
          <div
            className="pointer-events-none absolute inset-0 rounded-[inherit]"
            style={{
              background:
                "radial-gradient(ellipse 120% 80% at 80% 50%, color-mix(in srgb,var(--arena-primary) 8%,transparent) 0%, transparent 70%)",
            }}
            aria-hidden
          />
          <div className="relative space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{ background: "color-mix(in srgb,var(--arena-primary) 15%,transparent)" }}>
                <Trophy className="h-6 w-6" style={{ color: "var(--arena-primary)" }} />
              </div>
              <StatusPill kind={tournament.status} size="md" pulse={tournament.status === "active"} />
            </div>
            <div>
              <h1
                className="text-xl font-bold text-(--arena-foreground)"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {tournament.name}
              </h1>
              <p className="mt-1 text-sm text-(--arena-muted)">
                {tournament.format.replace(/_/g, " ")} · MD{tournament.bestOf}
              </p>
            </div>
            {tournament.championName && (
              <div className="flex items-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--state-played)_25%,transparent)] bg-[color-mix(in_srgb,var(--state-played)_8%,transparent)] px-3 py-2">
                <span className="text-lg">🏆</span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-(--state-played)">
                    Campeão
                  </p>
                  <p className="text-sm font-bold text-(--arena-foreground)">
                    {tournament.championName}
                  </p>
                </div>
              </div>
            )}
          </div>
        </GlassCard>

        {/* Stats rápidos */}
        <div className="grid grid-cols-2 gap-2">
          <GlassCard className="space-y-1 text-center">
            <p className="text-2xl font-bold tabular-nums text-(--arena-foreground)"
              style={{ fontFamily: "var(--font-display)" }}>
              {confirmedParticipants.length}
            </p>
            <p className="text-[11px] text-(--arena-muted)">Participantes</p>
          </GlassCard>
          <GlassCard className="space-y-1 text-center">
            <p className="text-2xl font-bold tabular-nums text-(--arena-foreground)"
              style={{ fontFamily: "var(--font-display)" }}>
              {tournament.matches.filter((m) => m.status === "finished").length}
            </p>
            <p className="text-[11px] text-(--arena-muted)">Partidas jogadas</p>
          </GlassCard>
        </div>

        {/* Ações */}
        {hasGroupStage && (
          <Link href={`/torneios/${id}/grupos`}>
            <GlassCard noPadding className="group flex items-center gap-3 px-4 py-3 transition-all hover:scale-[1.01]">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: "color-mix(in srgb,var(--arena-primary) 12%,transparent)" }}>
                <LayoutGrid className="h-5 w-5 text-(--arena-primary)" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-(--arena-foreground)">Fase de Grupos</p>
                <p className="text-[11px] text-(--arena-muted)">Classificações por grupo</p>
              </div>
              <ChevronRight className="h-4 w-4 text-(--arena-muted) transition group-hover:translate-x-0.5" />
            </GlassCard>
          </Link>
        )}
        {hasBracket && (
          <Link href={`/torneios/${id}/chave`}>
            <GlassCard
              noPadding
              className="group flex items-center gap-3 px-4 py-3 transition-all hover:scale-[1.01]"
              glow={tournament.status === "active" ? "active" : "none"}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: "color-mix(in srgb,var(--state-active) 15%,transparent)" }}>
                <Network className="h-5 w-5" style={{ color: "var(--state-active)" }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-(--arena-foreground)">
                  {hasGroupStage ? "Mata-mata" : "Ver Chave"}
                </p>
                <p className="text-[11px] text-(--arena-muted)">Bracket ao vivo</p>
              </div>
              <ChevronRight className="h-4 w-4 text-(--arena-muted) transition group-hover:translate-x-0.5" />
            </GlassCard>
          </Link>
        )}

        {/* Lista de participantes */}
        {confirmedParticipants.length > 0 && (
          <div className="space-y-2">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)">
              Participantes
            </p>
            {confirmedParticipants.map((p) => (
              <GlassCard key={p.id} noPadding className="flex items-center gap-3 px-3 py-2.5">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-(--arena-foreground)"
                  style={{ background: "color-mix(in srgb,var(--arena-primary) 15%,transparent)" }}
                >
                  {p.seed ?? "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-(--arena-foreground)">
                    {p.guestName ?? `Jogador #${p.seed ?? p.id.slice(0, 4)}`}
                  </p>
                </div>
                {p.flag && (
                  <span className={`fi fi-${p.flag.toLowerCase()} text-base`} aria-hidden />
                )}
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </ArenaShell>
  );
}
