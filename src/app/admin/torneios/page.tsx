"use client";

import { ArenaShell } from "@/components/arena/arena-shell";
import { GlassCard } from "@/components/arena/glass-card";
import { StatusPill } from "@/components/arena/status-pill";
import { FORMAT_META } from "@/lib/tournaments/format-meta";
import { useTournaments } from "@/lib/queries/use-tournaments";
import { useEvents } from "@/lib/queries/use-events";
import Link from "next/link";
import {
  Trophy, Plus, ChevronRight, Loader2, Layers,
  Network, GitBranch, RotateCw, Crown,
} from "lucide-react";
import type { TournamentFormat } from "@/lib/tournaments/types";

const FORMAT_ICONS: Partial<Record<TournamentFormat, typeof Trophy>> = {
  single_elimination: Network,
  double_elimination: GitBranch,
  round_robin: RotateCw,
  groups_knockout: Layers,
  king_of_table: Crown,
};

export default function AdminTorneiosPage() {
  // Agrupadores (com categorias) + torneios avulsos legados.
  const { data: events, isLoading: loadingEvents } = useEvents();
  const { data: tournaments, isLoading: loadingTournaments } = useTournaments();
  const isLoading = loadingEvents || loadingTournaments;
  const total = (events?.length ?? 0) + (tournaments?.length ?? 0);

  return (
    <ArenaShell title="Torneios" subtitle="Admin" showBack>
      <div className="flex flex-col gap-4">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)">
              Todos os torneios
            </p>
            {!isLoading && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: "color-mix(in srgb, var(--arena-primary) 12%, transparent)", color: "var(--arena-primary)" }}
              >
                {total}
              </span>
            )}
          </div>
          <Link href="/admin/torneios/criar">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white transition hover:opacity-90 active:scale-95"
              style={{ background: "var(--arena-primary)", boxShadow: "0 4px 12px color-mix(in srgb, var(--arena-primary) 30%, transparent)" }}
            >
              <Plus className="h-3.5 w-3.5" />
              Novo torneio
            </button>
          </Link>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-(--arena-primary)" />
          </div>
        )}

        {!isLoading && total === 0 && (
          <GlassCard className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: "color-mix(in srgb, var(--arena-primary) 12%, transparent)" }}>
              <Trophy className="h-7 w-7 text-(--arena-primary)" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-(--arena-foreground)">Nenhum torneio criado</p>
              <p className="text-xs text-(--arena-muted)">Crie o primeiro para começar</p>
            </div>
            <Link href="/admin/torneios/criar">
              <button type="button"
                className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
                style={{ background: "var(--arena-primary)" }}>
                <Plus className="h-4 w-4" />
                Criar primeiro torneio
              </button>
            </Link>
          </GlassCard>
        )}

        {total > 0 && (
          <div className="flex flex-col gap-2">
            {/* Torneios com categorias (agrupadores) */}
            {events?.map((ev) => {
              // Achata: 1 categoria → vai direto pra configuração; 2+ → hub do torneio.
              const href = ev.categoriesCount <= 1 && ev.firstCategoryId
                ? `/admin/torneios/${ev.firstCategoryId}`
                : `/admin/eventos/${ev.id}`;
              return (
                <Link key={ev.id} href={href}>
                  <GlassCard noPadding className="group flex items-center gap-3 px-3 py-3 transition-all hover:scale-[1.01]">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: "color-mix(in srgb, var(--arena-primary) 12%, transparent)" }}>
                      <Trophy className="h-5 w-5 text-(--arena-primary)" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-(--arena-foreground)" style={{ fontFamily: "var(--font-display)" }}>
                        {ev.name}
                      </p>
                      {ev.categoriesCount > 1 && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                            style={{ background: "color-mix(in srgb, var(--arena-primary) 10%, transparent)", color: "var(--arena-primary)" }}>
                            {ev.categoriesCount} categorias
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {ev.hasLiveMatch && (
                        <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: "var(--state-noshow)" }} />
                      )}
                      <ChevronRight className="h-4 w-4 text-(--arena-muted) transition group-hover:translate-x-0.5" />
                    </div>
                  </GlassCard>
                </Link>
              );
            })}

            {/* Torneios avulsos (legado) */}
            {tournaments?.map((t) => {
              const meta = FORMAT_META[t.format];
              const Icon = FORMAT_ICONS[t.format] ?? Trophy;
              return (
                <Link key={t.id} href={`/admin/torneios/${t.id}`}>
                  <GlassCard noPadding className="group flex items-center gap-3 px-3 py-3 transition-all hover:scale-[1.01]">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: meta?.bg }}>
                      <Icon className="h-5 w-5" style={{ color: meta?.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-(--arena-foreground)" style={{ fontFamily: "var(--font-display)" }}>
                        {t.name}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{ background: meta?.bg, color: meta?.color, border: `1px solid ${meta?.border}` }}>
                          {meta?.short ?? t.format}
                        </span>
                        <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{ background: "color-mix(in srgb, var(--arena-muted) 12%, transparent)", color: "var(--arena-muted)" }}>
                          MD{t.bestOf}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusPill kind={t.status} pulse={t.status === "active"} />
                      <ChevronRight className="h-4 w-4 text-(--arena-muted) transition group-hover:translate-x-0.5" />
                    </div>
                  </GlassCard>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </ArenaShell>
  );
}
