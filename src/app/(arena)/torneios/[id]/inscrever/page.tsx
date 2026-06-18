"use client";

import { ArenaShell } from "@/components/arena/arena-shell";
import { GlassCard } from "@/components/arena/glass-card";
import { StatusPill } from "@/components/arena/status-pill";
import { FORMAT_META } from "@/lib/tournaments/format-meta";
import { getSeedColor } from "@/lib/tournaments/seed-colors";
import { registerSelf } from "@/app/actions/tournaments";
import { useTournament } from "@/lib/queries/use-tournaments";
import { useParams } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Trophy, Users, Loader2, CheckCircle, AlertCircle,
  ChevronRight, Network, Clock, Lock,
} from "lucide-react";
import type { TournamentParticipant } from "@/lib/tournaments/types";


export default function InscreverPage() {
  const { id } = useParams<{ id: string }>();
  const { data: tournament, isLoading } = useTournament(id);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState<TournamentParticipant | null>(null);

  if (isLoading) {
    return (
      <ArenaShell title="Inscrição" showBack>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-(--arena-primary)" />
        </div>
      </ArenaShell>
    );
  }

  if (!tournament) {
    return (
      <ArenaShell title="Torneio" showBack>
        <p className="py-12 text-center text-sm text-(--arena-muted)">Torneio não encontrado.</p>
      </ArenaShell>
    );
  }

  const fmt = FORMAT_META[tournament.format];
  const confirmed = tournament.participants.filter((p) => p.signupStatus === "confirmed");
  const spotsLeft = tournament.maxParticipants ? tournament.maxParticipants - confirmed.length : null;
  const isFull = spotsLeft !== null && spotsLeft <= 0;
  const isClosed = tournament.status !== "registration";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await registerSelf(id, { name: name.trim() });
        setRegistered(result.participant);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao realizar inscrição");
      }
    });
  }

  // ── Tela de confirmação ──────────────────────────────
  if (registered) {
    const position = confirmed.length + 1;
    const { bg, color, border } = getSeedColor(position);
    return (
      <ArenaShell title="Inscrição confirmada" showBack>
        <div className="flex flex-col gap-5">
          {/* Ícone de sucesso */}
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full"
              style={{ background: "color-mix(in srgb, var(--state-played) 14%, transparent)" }}
            >
              <CheckCircle className="h-10 w-10" style={{ color: "var(--state-played)" }} />
            </div>
            <div className="space-y-1">
              <p className="text-xl font-black text-(--arena-foreground)" style={{ fontFamily: "var(--font-display)" }}>
                Inscrição confirmada!
              </p>
              <p className="text-sm text-(--arena-muted)">
                Você está registrado no <strong>{tournament.name}</strong>
              </p>
            </div>
          </div>

          {/* Card do jogador */}
          <GlassCard noPadding className="flex items-center gap-3 px-4 py-3.5">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-black tabular-nums"
              style={{ background: bg, color, border: `1.5px solid ${border}`, fontFamily: "var(--font-display)" }}
            >
              {position}
            </div>
            <div className="flex-1">
              <p className="font-bold text-(--arena-foreground)">{registered.guestName}</p>
              <p className="text-xs text-(--arena-muted)">Inscrito #{position} de {tournament.maxParticipants ?? "∞"}</p>
            </div>
          </GlassCard>

          {/* Info do torneio */}
          <GlassCard className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)">Detalhes do torneio</p>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: fmt?.bg }}>
                <Trophy className="h-5 w-5" style={{ color: fmt?.color ?? "var(--arena-primary)" }} />
              </div>
              <div>
                <p className="text-sm font-bold text-(--arena-foreground)">{tournament.name}</p>
                <p className="text-xs text-(--arena-muted)">{fmt?.full ?? tournament.format} · MD{tournament.bestOf}</p>
              </div>
            </div>
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2.5"
              style={{ background: "color-mix(in srgb, var(--state-scheduled) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--state-scheduled) 20%, transparent)" }}
            >
              <Clock className="h-4 w-4 shrink-0" style={{ color: "var(--state-scheduled)" }} />
              <p className="text-xs text-(--arena-muted)">
                Aguarde o início. O admin irá fechar as inscrições e gerar a chave.
              </p>
            </div>
          </GlassCard>

          {/* Botões */}
          <div className="flex flex-col gap-2">
            <Link href={`/torneios/${id}`}>
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white transition hover:opacity-90"
                style={{ background: "var(--arena-primary)", boxShadow: "0 4px 14px color-mix(in srgb, var(--arena-primary) 30%, transparent)" }}
              >
                <Network className="h-4 w-4" />
                Ver página do torneio
                <ChevronRight className="h-4 w-4" />
              </button>
            </Link>
            <Link href="/">
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold transition hover:opacity-90"
                style={{ background: "color-mix(in srgb, var(--arena-primary) 10%, transparent)", color: "var(--arena-primary)", border: "1px solid color-mix(in srgb, var(--arena-primary) 20%, transparent)" }}
              >
                Voltar para o início
              </button>
            </Link>
          </div>
        </div>
      </ArenaShell>
    );
  }

  // ── Tela principal ───────────────────────────────────
  return (
    <ArenaShell title="Inscrição" showBack>
      <div className="flex flex-col gap-4">

        {/* Banner do torneio */}
        <GlassCard variant="elevated" className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[inherit]"
            style={{ background: "radial-gradient(ellipse 120% 80% at 80% 50%, color-mix(in srgb, var(--arena-primary) 7%, transparent) 0%, transparent 70%)" }}
          />
          <div className="relative flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: fmt?.bg }}>
              <Trophy className="h-6 w-6" style={{ color: fmt?.color ?? "var(--arena-primary)" }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-black text-(--arena-foreground)" style={{ fontFamily: "var(--font-display)" }}>
                {tournament.name}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="rounded-md px-1.5 py-0.5 text-[10px] font-bold" style={{ background: fmt?.bg, color: fmt?.color, border: `1px solid ${fmt?.border}` }}>
                  {fmt?.short ?? tournament.format}
                </span>
                <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: "color-mix(in srgb, var(--arena-muted) 12%, transparent)", color: "var(--arena-muted)" }}>
                  MD{tournament.bestOf}
                </span>
              </div>
            </div>
            <StatusPill kind={tournament.status} size="md" />
          </div>
        </GlassCard>

        {/* Vagas */}
        <GlassCard noPadding className="flex items-center gap-3 px-4 py-3.5">
          <Users className="h-5 w-5 shrink-0 text-(--arena-primary)" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-(--arena-foreground)">
              {confirmed.length} inscritos
              {tournament.maxParticipants ? ` de ${tournament.maxParticipants}` : ""}
            </p>
            {spotsLeft !== null && (
              <p className="text-xs text-(--arena-muted)">
                {spotsLeft > 0 ? `${spotsLeft} ${spotsLeft === 1 ? "vaga restante" : "vagas restantes"}` : "Vagas esgotadas"}
              </p>
            )}
          </div>
          {spotsLeft !== null && spotsLeft > 0 && (
            <div
              className="h-2 w-24 overflow-hidden rounded-full"
              style={{ background: "color-mix(in srgb, var(--arena-foreground) 8%, transparent)" }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.round((confirmed.length / tournament.maxParticipants!) * 100)}%`,
                  background: "var(--arena-primary)",
                }}
              />
            </div>
          )}
        </GlassCard>

        {/* Inscrições fechadas */}
        {isClosed && (
          <GlassCard className="flex flex-col items-center gap-3 py-10 text-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: "color-mix(in srgb, var(--arena-muted) 10%, transparent)" }}
            >
              <Lock className="h-7 w-7 text-(--arena-muted)" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-(--arena-foreground)">Inscrições fechadas</p>
              <p className="text-sm text-(--arena-muted)">
                {tournament.status === "active" ? "O torneio já começou." :
                 tournament.status === "finished" ? "Este torneio foi encerrado." :
                 "As inscrições ainda não estão abertas."}
              </p>
            </div>
            <Link href={`/torneios/${id}`}>
              <button type="button" className="mt-1 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:opacity-90"
                style={{ background: "color-mix(in srgb, var(--arena-primary) 10%, transparent)", color: "var(--arena-primary)", border: "1px solid color-mix(in srgb, var(--arena-primary) 20%, transparent)" }}>
                Ver torneio
                <ChevronRight className="h-4 w-4" />
              </button>
            </Link>
          </GlassCard>
        )}

        {/* Vagas esgotadas */}
        {!isClosed && isFull && (
          <GlassCard className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "color-mix(in srgb, var(--state-noshow) 10%, transparent)" }}>
              <Users className="h-7 w-7" style={{ color: "var(--state-noshow)" }} />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-(--arena-foreground)">Vagas esgotadas</p>
              <p className="text-sm text-(--arena-muted)">Todas as {tournament.maxParticipants} vagas já foram preenchidas.</p>
            </div>
          </GlassCard>
        )}

        {/* Formulário de inscrição */}
        {!isClosed && !isFull && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">

            {/* Nome */}
            <div className="flex flex-col gap-2">
              <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)">
                Seu nome *
              </p>
              <input
                type="text"
                placeholder="Ex: João Silva"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isPending}
                maxLength={80}
                autoFocus
                required
                className="w-full rounded-2xl px-4 py-3 text-sm font-medium outline-none transition"
                style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--arena-foreground)" }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "color-mix(in srgb, var(--arena-primary) 50%, transparent)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px color-mix(in srgb, var(--arena-primary) 10%, transparent)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--glass-border)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            {/* Participantes atuais */}
            {confirmed.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)">
                  Já inscritos
                </p>
                <div className="flex flex-col gap-1.5">
                  {confirmed.slice(0, 5).map((p, idx) => {
                    const { bg, color, border } = getSeedColor(idx + 1);
                    return (
                      <GlassCard key={p.id} noPadding className="flex items-center gap-3 px-3 py-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                          style={{ background: bg, color, border: `1px solid ${border}` }}>
                          {idx + 1}
                        </div>
                        <p className="flex-1 truncate text-sm font-semibold text-(--arena-foreground)">
                          {p.guestName ?? `Jogador ${idx + 1}`}
                        </p>
                      </GlassCard>
                    );
                  })}
                  {confirmed.length > 5 && (
                    <p className="px-1 text-center text-xs text-(--arena-muted)">
                      +{confirmed.length - 5} outros inscritos
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Erro */}
            {error && (
              <div className="flex items-center gap-2 rounded-2xl px-4 py-3"
                style={{ background: "color-mix(in srgb, var(--state-noshow) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--state-noshow) 25%, transparent)" }}>
                <AlertCircle className="h-4 w-4 shrink-0" style={{ color: "var(--state-noshow)" }} />
                <p className="text-sm" style={{ color: "var(--state-noshow)" }}>{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isPending || !name.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background: "var(--arena-primary)",
                boxShadow: name.trim() ? "0 6px 24px color-mix(in srgb, var(--arena-primary) 40%, transparent)" : "none",
                fontFamily: "var(--font-display)",
                fontSize: "15px",
                letterSpacing: "0.01em",
              }}
            >
              {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trophy className="h-5 w-5" />}
              {isPending ? "Inscrevendo…" : "Me inscrever"}
            </button>

            <p className="text-center text-[11px] text-(--arena-muted)">
              Ao se inscrever você confirma sua participação no torneio.
            </p>
          </form>
        )}
      </div>
    </ArenaShell>
  );
}
