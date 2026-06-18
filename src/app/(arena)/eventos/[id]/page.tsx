import { ArenaShell } from "@/components/arena/arena-shell";
import { GlassCard } from "@/components/arena/glass-card";
import { StatusPill } from "@/components/arena/status-pill";
import { getTournamentRepo } from "@/lib/tournaments/repo";
import { FORMAT_META } from "@/lib/tournaments/format-meta";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Users, ChevronRight, Tv, CalendarDays, MapPin, Trophy } from "lucide-react";

export const dynamic = "force-dynamic";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
}

export default async function EventoPublicoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repo = await getTournamentRepo();
  const event = await repo.getEvent(id);
  if (!event) notFound();

  // Divisões em rascunho não aparecem para o público.
  const divisions = event.divisions.filter((d) => d.status !== "draft");
  const totalPlayers = divisions.reduce((acc, d) => acc + d.participantCount, 0);

  return (
    <ArenaShell title={event.name} subtitle="Torneio" showBack>
      <div className="flex flex-col gap-4">
        <GlassCard className="flex items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 text-[11px] text-(--arena-muted)">
              {event.eventDate && (
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" /> {formatDate(event.eventDate)}
                </span>
              )}
              {event.venue && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {event.venue}
                </span>
              )}
            </div>
            <p className="text-xs text-(--arena-muted)">
              {divisions.length} {divisions.length === 1 ? "categoria" : "categorias"} · {totalPlayers} {totalPlayers === 1 ? "jogador" : "jogadores"}
            </p>
          </div>
          <Link href={`/tv/evento/${event.id}`} target="_blank">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition hover:opacity-90 active:scale-95"
              style={{ background: "color-mix(in srgb, var(--arena-primary) 12%, transparent)", color: "var(--arena-primary)" }}
            >
              <Tv className="h-3.5 w-3.5" /> Ver na TV
            </button>
          </Link>
        </GlassCard>

        <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)">
          Categorias
        </p>

        {divisions.length === 0 && (
          <GlassCard className="py-10 text-center">
            <p className="text-sm text-(--arena-muted)">As categorias aparecem aqui quando começarem</p>
          </GlassCard>
        )}

        <div className="flex flex-col gap-2">
          {divisions.map((d) => {
            const meta = FORMAT_META[d.format];
            return (
              <Link key={d.id} href={`/torneios/${d.id}/chave`}>
                <GlassCard
                  noPadding
                  className="group flex items-center gap-3 px-4 py-3 transition-all hover:scale-[1.01]"
                  glow={d.hasLiveMatch ? "active" : "none"}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: meta?.bg }}>
                    <Trophy className="h-5 w-5" style={{ color: meta?.color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-(--arena-foreground)">
                      {d.divisionLabel ?? d.name}
                    </p>
                    <span className="mt-0.5 flex items-center gap-1 text-[11px] text-(--arena-muted)">
                      <Users className="h-3 w-3" /> {d.participantCount} · {meta?.short ?? d.format}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {d.hasLiveMatch && (
                      <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: "var(--state-noshow)" }} />
                    )}
                    <StatusPill kind={d.status} pulse={d.status === "active"} />
                    <ChevronRight className="h-4 w-4 text-(--arena-muted) transition group-hover:translate-x-0.5" />
                  </div>
                </GlassCard>
              </Link>
            );
          })}
        </div>
      </div>
    </ArenaShell>
  );
}
