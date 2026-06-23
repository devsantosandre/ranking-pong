import { ArenaShell } from "@/components/arena/arena-shell";
import { GlassCard } from "@/components/arena/glass-card";
import { StatusPill } from "@/components/arena/status-pill";
import { LiveDot } from "@/components/arena/live-dot";
import { getTournamentRepo } from "@/lib/tournaments/repo";
import type { Tournament, EventListItem, TournamentStatus } from "@/lib/tournaments/types";
import Link from "next/link";
import { Trophy, ChevronRight, History } from "lucide-react";

const formatLabels: Record<Tournament["format"], string> = {
  single_elimination: "Eliminatória simples",
  double_elimination: "Eliminatória dupla",
  round_robin: "Pontos corridos",
  groups_knockout: "Grupos + mata-mata",
  swiss: "Sistema Suíço",
  scorecard: "Scorecard",
  americano: "Americano",
  king_of_table: "Rei da Mesa",
  league: "Liga",
};

export const dynamic = "force-dynamic";

// Para o jogador, evento (com categorias) e torneio avulso são a mesma coisa:
// ele só quer saber o ESTADO. Por isso a tela é agrupada por status, não por
// estrutura. Cada entrada é um torneio OU um evento, com um status comum.
type Entry =
  | { kind: "tournament"; status: TournamentStatus; tournament: Tournament }
  | { kind: "event"; status: TournamentStatus; event: EventListItem };

/** Timestamp para ordenar (encerramento do torneio / data do evento). */
function entryTime(e: Entry): number {
  if (e.kind === "tournament") {
    return new Date(e.tournament.finishedAt ?? e.tournament.createdAt).getTime();
  }
  return new Date(e.event.eventDate ?? e.event.createdAt).getTime();
}

/** Data curta pt-BR (dd/mm/aaaa) ou null se inválida. */
function shortDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("pt-BR");
}

export default async function TorneiosPage() {
  const repo = await getTournamentRepo();
  const [tournaments, events] = await Promise.all([
    repo.listTournaments(),
    repo.listEvents(),
  ]);

  // Rascunhos ficam de fora da visão do jogador (admin ainda configurando).
  const entries: Entry[] = [
    ...events
      .filter((e) => e.status !== "draft")
      .map((event): Entry => ({ kind: "event", status: event.status, event })),
    ...tournaments
      .filter((t) => t.status !== "draft")
      .map((tournament): Entry => ({ kind: "tournament", status: tournament.status, tournament })),
  ];

  const inProgress = entries.filter((e) => e.status === "active");
  const open = entries.filter((e) => e.status === "registration");
  // Encerrados: do mais recente para o mais antigo (data de encerramento).
  const closed = entries
    .filter((e) => e.status === "finished")
    .sort((a, b) => entryTime(b) - entryTime(a));

  const lastChampion = tournaments
    .filter((t) => t.status === "finished" && t.championName)
    .sort(
      (a, b) =>
        new Date(b.finishedAt ?? b.createdAt).getTime() -
        new Date(a.finishedAt ?? a.createdAt).getTime(),
    )[0];

  const hasAny = entries.length > 0;

  return (
    <ArenaShell title="Torneios" showBack={false}>
      <div className="flex flex-col gap-5">

        {/* Resumo */}
        {hasAny && (
          <GlassCard variant="strong" className="space-y-3">
            <div className="grid grid-cols-3 divide-x divide-(--glass-border)">
              <SummaryStat value={inProgress.length} label="Em andamento" accent="var(--state-active)" />
              <SummaryStat value={open.length} label="Inscrições" accent="var(--state-scheduled)" />
              <SummaryStat value={closed.length} label="Encerrados" accent="var(--state-played)" />
            </div>
            {lastChampion && (
              <Link
                href="/torneios/historico"
                className="group flex items-center gap-2 rounded-xl px-3 py-2"
                style={{ background: "color-mix(in srgb,var(--state-scheduled) 8%,transparent)" }}
              >
                <Trophy className="h-4 w-4 shrink-0" style={{ color: "var(--state-scheduled)" }} />
                <p className="min-w-0 flex-1 truncate text-xs text-(--arena-muted)">
                  Último campeão:{" "}
                  <span className="font-semibold text-(--arena-foreground)">
                    {lastChampion.championName}
                  </span>
                </p>
                <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold" style={{ color: "var(--state-scheduled)" }}>
                  <History className="h-3.5 w-3.5" /> Histórico
                </span>
              </Link>
            )}
          </GlassCard>
        )}

        {/* Em andamento */}
        <EntrySection title="Em andamento" entries={inProgress} />

        {/* Inscrições abertas */}
        <EntrySection title="Inscrições abertas" entries={open} />

        {/* Encerrados */}
        <EntrySection title="Encerrados" entries={closed} />

        {/* Empty — rascunhos não contam (invisíveis para o jogador) */}
        {!hasAny && (
          <GlassCard className="flex flex-col items-center gap-4 py-12 text-center">
            <Trophy className="h-10 w-10 text-(--arena-muted)" />
            <p className="text-sm text-(--arena-muted)">Nenhum torneio ainda</p>
          </GlassCard>
        )}
      </div>
    </ArenaShell>
  );
}

function EntrySection({ title, entries }: { title: string; entries: Entry[] }) {
  if (entries.length === 0) return null;
  return (
    <section className="space-y-2">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)">
        {title}
      </p>
      {/* Cards num flex gap-2 (não space-y): os <Link> são <a> inline e
          margin-top do space-y não os afasta corretamente. */}
      <div className="flex flex-col gap-2">
        {entries.map((entry) =>
          entry.kind === "event" ? (
            <EventCard key={`ev-${entry.event.id}`} event={entry.event} />
          ) : (
            <TournamentCard key={entry.tournament.id} tournament={entry.tournament} />
          ),
        )}
      </div>
    </section>
  );
}

function SummaryStat({ value, label, accent }: { value: number; label: string; accent: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-1">
      <p
        className="text-2xl font-bold tabular-nums"
        style={{ color: accent, fontFamily: "var(--font-display)" }}
      >
        {value}
      </p>
      <p className="text-center text-[10px] uppercase tracking-wide text-(--arena-muted)">{label}</p>
    </div>
  );
}

/** Card base compartilhado por torneio avulso e evento — visual idêntico. */
function EntryCard({
  href,
  name,
  subtitle,
  status,
  live,
  dateLabel,
}: {
  href: string;
  name: string;
  subtitle: string;
  status: TournamentStatus;
  live?: boolean;
  dateLabel?: string | null;
}) {
  return (
    <Link href={href}>
      <GlassCard
        noPadding
        className="group flex items-center gap-3 px-4 py-3 transition-all hover:scale-[1.01] hover:bg-(--glass-bg-hover)"
        glow={status === "active" ? "active" : "none"}
      >
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "color-mix(in srgb,var(--arena-primary) 15%,transparent)" }}
        >
          <Trophy className="h-5 w-5" style={{ color: "var(--arena-primary)" }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-(--arena-foreground)">{name}</p>
          {subtitle && (
            <p className="mt-0.5 truncate text-[11px] text-(--arena-muted)">{subtitle}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {live && <LiveDot />}
          <div className="flex flex-col items-end gap-1">
            <StatusPill kind={status} label={live ? "Ao vivo" : undefined} />
            {dateLabel && (
              <span className="text-[10px] tabular-nums text-(--arena-muted)">{dateLabel}</span>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-(--arena-muted) transition group-hover:translate-x-0.5" />
        </div>
      </GlassCard>
    </Link>
  );
}

function TournamentCard({ tournament: t }: { tournament: Tournament }) {
  const subtitle = `${formatLabels[t.format]}${t.bestOf > 1 ? ` · MD${t.bestOf}` : ""}`;
  // Encerrado: mostra o dia em que terminou (à direita), para situar quando foi.
  const dateLabel = t.status === "finished" ? shortDate(t.finishedAt ?? t.createdAt) : null;
  return <EntryCard href={`/torneios/${t.id}`} name={t.name} subtitle={subtitle} status={t.status} dateLabel={dateLabel} />;
}

function EventCard({ event: ev }: { event: EventListItem }) {
  // 1 categoria → direto pra chave; 2+ → página do evento com as categorias.
  const href =
    ev.categoriesCount <= 1 && ev.firstCategoryId
      ? `/torneios/${ev.firstCategoryId}/chave`
      : `/eventos/${ev.id}`;
  const subtitle =
    ev.categoriesCount > 1 ? `${ev.categoriesCount} categorias` : ev.venue ?? "";
  const dateLabel = ev.status === "finished" ? shortDate(ev.eventDate ?? ev.createdAt) : null;
  return (
    <EntryCard href={href} name={ev.name} subtitle={subtitle} status={ev.status} live={ev.hasLiveMatch} dateLabel={dateLabel} />
  );
}
