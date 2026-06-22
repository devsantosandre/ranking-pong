"use client";

import { ArenaShell } from "@/components/arena/arena-shell";
import { GlassCard } from "@/components/arena/glass-card";
import { StatusPill } from "@/components/arena/status-pill";
import { useEvent, eventKeys } from "@/lib/queries/use-events";
import { addDivision } from "@/app/actions/tournaments";
import { FORMAT_META } from "@/lib/tournaments/format-meta";
import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  Loader2, Plus, Tv, Users, ChevronRight, Settings2, X, AlertCircle, Check,
  Network, GitBranch, RotateCw, Layers, Crown, Trophy,
} from "lucide-react";
import type { TournamentFormat } from "@/lib/tournaments/types";

const FORMAT_ICONS: Partial<Record<TournamentFormat, typeof Trophy>> = {
  single_elimination: Network,
  double_elimination: GitBranch,
  round_robin: RotateCw,
  groups_knockout: Layers,
  king_of_table: Crown,
};

const DIVISION_FORMATS: { value: TournamentFormat; label: string }[] = [
  { value: "single_elimination", label: "Eliminatória simples" },
  { value: "groups_knockout", label: "Grupos + mata-mata" },
  { value: "round_robin", label: "Pontos corridos" },
  { value: "king_of_table", label: "Rei da Mesa" },
];
const BEST_OF = [1, 3, 5, 7] as const;

export default function EventoHubPage() {
  const { id } = useParams<{ id: string }>();
  const { data: event, isLoading } = useEvent(id);
  const [showModal, setShowModal] = useState(false);

  const totalPlayers = event?.divisions.reduce((acc, d) => acc + d.participantCount, 0) ?? 0;

  return (
    <ArenaShell title={event?.name ?? "Torneio"} subtitle="Admin" showBack>
      <div className="flex flex-col gap-4">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-(--arena-primary)" />
          </div>
        )}

        {!isLoading && !event && (
          <GlassCard className="py-12 text-center">
            <p className="text-sm font-bold text-(--arena-foreground)">Torneio não encontrado</p>
          </GlassCard>
        )}

        {event && (
          <>
            {/* Resumo + ações */}
            <GlassCard className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-(--arena-muted)">
                  {event.divisions.length} {event.divisions.length === 1 ? "categoria" : "categorias"} · {totalPlayers} {totalPlayers === 1 ? "jogador" : "jogadores"}
                </p>
              </div>
              <Link href={`/tv/evento/${event.id}`} target="_blank">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition hover:opacity-90 active:scale-95"
                  style={{
                    background: "color-mix(in srgb, var(--arena-primary) 12%, transparent)",
                    color: "var(--arena-primary)",
                  }}
                >
                  <Tv className="h-3.5 w-3.5" />
                  TV do torneio
                </button>
              </Link>
            </GlassCard>

            {/* Categorias */}
            <div className="flex items-center justify-between px-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)">
                Categorias
              </p>
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white transition hover:opacity-90 active:scale-95"
                style={{
                  background: "var(--arena-primary)",
                  boxShadow: "0 4px 12px color-mix(in srgb, var(--arena-primary) 30%, transparent)",
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Nova categoria
              </button>
            </div>

            {event.divisions.length === 0 && (
              <GlassCard className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ background: "color-mix(in srgb, var(--arena-primary) 12%, transparent)" }}>
                  <Layers className="h-6 w-6 text-(--arena-primary)" />
                </div>
                <p className="text-sm font-bold text-(--arena-foreground)">Nenhuma categoria ainda</p>
                <p className="max-w-xs text-xs text-(--arena-muted)">
                  Adicione categorias como A · Avançados, B · Intermediários… Cada uma tem formato e chave próprios.
                </p>
              </GlassCard>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              {event.divisions.map((d) => {
                const meta = FORMAT_META[d.format];
                const Icon = FORMAT_ICONS[d.format] ?? Trophy;
                return (
                  <GlassCard key={d.id} className="flex flex-col gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                        style={{ background: meta?.bg }}>
                        <Icon className="h-5 w-5" style={{ color: meta?.color }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-(--arena-foreground)"
                          style={{ fontFamily: "var(--font-display)" }}>
                          {d.divisionLabel ?? d.name}
                        </p>
                        <p className="text-[11px] text-(--arena-muted)">{meta?.short ?? d.format}</p>
                      </div>
                      {d.hasLiveMatch && (
                        <span className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                          style={{ background: "color-mix(in srgb, var(--state-noshow) 14%, transparent)", color: "var(--state-noshow)" }}>
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "var(--state-noshow)" }} />
                          AO VIVO
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-(--arena-muted)">
                        <Users className="h-3.5 w-3.5" /> {d.participantCount} inscritos
                      </span>
                      <StatusPill kind={d.status} pulse={d.status === "active"} />
                    </div>

                    <Link href={`/admin/torneios/${d.id}`}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition hover:opacity-90 active:scale-[0.98]"
                        style={{
                          background: "color-mix(in srgb, var(--arena-primary) 10%, transparent)",
                          color: "var(--arena-primary)",
                        }}
                      >
                        <Settings2 className="h-3.5 w-3.5" /> Configurar
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </Link>
                  </GlassCard>
                );
              })}
            </div>
          </>
        )}
      </div>

      {showModal && event && (
        <NewDivisionModal eventId={event.id} onClose={() => setShowModal(false)} />
      )}
    </ArenaShell>
  );
}

function NewDivisionModal({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [format, setFormat] = useState<TournamentFormat>("single_elimination");
  const [bestOf, setBestOf] = useState(3);

  function handleSubmit() {
    setError(null);
    if (!label.trim()) { setError("Dê um nome para a categoria (ex.: A · Avançados)."); return; }
    startTransition(async () => {
      try {
        await addDivision(eventId, { label: label.trim(), format, bestOf });
        await queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao criar categoria.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
      onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl p-5 sm:rounded-3xl"
        style={{ background: "var(--popover)", border: "1px solid var(--glass-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="text-base font-bold text-(--arena-foreground)" style={{ fontFamily: "var(--font-display)" }}>
            Nova categoria
          </p>
          <button type="button" onClick={onClose} className="text-(--arena-muted) hover:text-(--arena-foreground)">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="div-label" className="px-1 text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)">
              Nome da categoria
            </label>
            <input
              id="div-label" type="text" placeholder="Ex: A · Avançados"
              value={label} onChange={(e) => setLabel(e.target.value)}
              disabled={isPending} maxLength={60} autoFocus
              className="w-full rounded-2xl px-4 py-3 text-sm font-medium outline-none"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--arena-foreground)" }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)">Formato</p>
            <div className="grid grid-cols-2 gap-2">
              {DIVISION_FORMATS.map((f) => {
                const meta = FORMAT_META[f.value];
                const Icon = FORMAT_ICONS[f.value] ?? Trophy;
                const sel = format === f.value;
                return (
                  <button
                    key={f.value} type="button" onClick={() => setFormat(f.value)} disabled={isPending}
                    className="flex items-center gap-2 rounded-xl p-2.5 text-left transition"
                    style={{
                      background: sel ? `color-mix(in srgb, ${meta?.color} 10%, var(--glass-bg))` : "var(--glass-bg)",
                      border: sel ? `1.5px solid ${meta?.border}` : "1px solid var(--glass-border)",
                    }}
                  >
                    <Icon className="h-4 w-4 shrink-0" style={{ color: meta?.color }} />
                    <span className="text-[11px] font-bold text-(--arena-foreground)">{f.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)">Sets por partida</p>
            <div className="grid grid-cols-4 gap-2">
              {BEST_OF.map((n) => {
                const sel = bestOf === n;
                return (
                  <button
                    key={n} type="button" onClick={() => setBestOf(n)} disabled={isPending}
                    className="flex items-center justify-center rounded-xl py-2.5 text-sm font-black tabular-nums transition"
                    style={sel
                      ? { background: "var(--arena-primary)", color: "#fff" }
                      : { background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--arena-muted)" }}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl px-3 py-2"
              style={{ background: "color-mix(in srgb, var(--state-noshow) 8%, transparent)" }}>
              <AlertCircle className="h-4 w-4 shrink-0" style={{ color: "var(--state-noshow)" }} />
              <p className="text-xs" style={{ color: "var(--state-noshow)" }}>{error}</p>
            </div>
          )}

          <button
            type="button" onClick={handleSubmit} disabled={isPending || !label.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white transition hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
            style={{ background: "var(--arena-primary)" }}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {isPending ? "Criando…" : "Adicionar categoria"}
          </button>
        </div>
      </div>
    </div>
  );
}
