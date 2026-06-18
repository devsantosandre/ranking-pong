import { ArenaShell } from "@/components/arena/arena-shell";
import { GlassCard } from "@/components/arena/glass-card";
import { StatusPill } from "@/components/arena/status-pill";
import { getTournamentRepo } from "@/lib/tournaments/repo";
import type { Tournament } from "@/lib/tournaments/types";
import Link from "next/link";
import { Trophy, ChevronRight, CalendarDays } from "lucide-react";

const formatLabels: Record<Tournament["format"], string> = {
  single_elimination: "Eliminatória simples",
  double_elimination: "Eliminatória dupla",
  round_robin: "Round-robin",
  groups_knockout: "Grupos + mata-mata",
  swiss: "Sistema Suíço",
  scorecard: "Scorecard",
  americano: "Americano",
  king_of_table: "Rei da Mesa",
  league: "Liga",
};

export const dynamic = "force-dynamic";

export default async function TorneiosPage() {
  const repo = await getTournamentRepo();
  const [tournaments, events] = await Promise.all([
    repo.listTournaments(),
    repo.listEvents(),
  ]);

  const active = tournaments.filter((t) => t.status === "active");
  const registration = tournaments.filter((t) => t.status === "registration");
  const finished = tournaments.filter((t) => t.status === "finished");
  const draft = tournaments.filter((t) => t.status === "draft");

  return (
    <ArenaShell title="Torneios" showBack={false}>
      <div className="flex flex-col gap-5">

        {/* Eventos (várias divisões) */}
        {events.length > 0 && (
          <section className="space-y-2">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)">
              Eventos
            </p>
            {events.map((ev) => (
              <Link key={ev.id} href={`/eventos/${ev.id}`}>
                <GlassCard
                  noPadding
                  className="group flex items-center gap-3 px-4 py-3 transition-all hover:scale-[1.01] hover:bg-(--glass-bg-hover)"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: "color-mix(in srgb,var(--arena-primary) 15%,transparent)" }}
                  >
                    <CalendarDays className="h-5 w-5" style={{ color: "var(--arena-primary)" }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-(--arena-foreground)">{ev.name}</p>
                    {ev.venue && <p className="mt-0.5 text-[11px] text-(--arena-muted)">{ev.venue}</p>}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-(--arena-muted) transition group-hover:translate-x-0.5" />
                </GlassCard>
              </Link>
            ))}
          </section>
        )}

        {/* Ativos */}
        {active.length > 0 && (
          <section className="space-y-2">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)">
              Em andamento
            </p>
            {active.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </section>
        )}

        {/* Inscrições abertas */}
        {registration.length > 0 && (
          <section className="space-y-2">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)">
              Inscrições abertas
            </p>
            {registration.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </section>
        )}

        {/* Encerrados */}
        {finished.length > 0 && (
          <section className="space-y-2">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)">
              Encerrados
            </p>
            {finished.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </section>
        )}

        {/* Rascunhos — visíveis só com link direto */}
        {draft.length > 0 && (
          <section className="space-y-2">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)">
              Rascunhos
            </p>
            {draft.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </section>
        )}

        {tournaments.length === 0 && (
          <div className="flex h-40 flex-col items-center justify-center gap-2">
            <Trophy className="h-10 w-10 text-(--arena-muted)" />
            <p className="text-sm text-(--arena-muted)">Nenhum torneio ainda</p>
          </div>
        )}
      </div>
    </ArenaShell>
  );
}

function TournamentCard({ tournament: t }: { tournament: Tournament }) {
  const statusMap: Record<Tournament["status"], "active" | "registration" | "finished" | "draft"> = {
    active: "active",
    registration: "registration",
    finished: "finished",
    draft: "draft",
  };

  return (
    <Link href={`/torneios/${t.id}`}>
      <GlassCard
        noPadding
        className="group flex items-center gap-3 px-4 py-3 transition-all hover:scale-[1.01] hover:bg-(--glass-bg-hover)"
        glow={t.status === "active" ? "active" : "none"}
      >
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "color-mix(in srgb,var(--arena-primary) 15%,transparent)" }}
        >
          <Trophy className="h-5 w-5" style={{ color: "var(--arena-primary)" }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-(--arena-foreground)">{t.name}</p>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-[11px] text-(--arena-muted)">
              {formatLabels[t.format]}
            </span>
            {t.bestOf > 1 && (
              <span className="text-[11px] text-(--arena-muted)">· MD{t.bestOf}</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusPill kind={statusMap[t.status]} />
          <ChevronRight
            className="h-4 w-4 text-(--arena-muted) transition group-hover:translate-x-0.5"
          />
        </div>
      </GlassCard>
    </Link>
  );
}
