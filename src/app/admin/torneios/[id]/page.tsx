"use client";

import { ArenaShell } from "@/components/arena/arena-shell";
import { GlassCard } from "@/components/arena/glass-card";
import { StatusPill } from "@/components/arena/status-pill";
import { BracketCanvas } from "@/components/bracket/bracket-canvas";
import { SeedingBoard } from "@/components/tournaments/seeding-board";
import { GroupDistributionBoard } from "@/components/tournaments/group-distribution-board";
import { DivisionSwitcher } from "@/components/tournaments/division-switcher";
import { ScoreSheet } from "@/components/tournaments/score-sheet";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import {
  addParticipants, removeParticipant, saveSeeding,
  generateBracket, openRegistration, closeRegistration, finishTournament, configureGroups,
} from "@/app/actions/tournaments";
import { getSeedColor } from "@/lib/tournaments/seed-colors";
import { FORMAT_META } from "@/lib/tournaments/format-meta";
import { useTournament, useTournamentStandings, tournamentKeys } from "@/lib/queries/use-tournaments";
import { useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useState, useTransition, useEffect } from "react";
import type { TournamentParticipant, TournamentMatch, TournamentDetail, GroupStanding } from "@/lib/tournaments/types";
import {
  Users, Network, ListOrdered, Play, Trophy,
  Loader2, CheckCircle, UserPlus, RotateCcw,
  X, Tv, Swords, ChevronRight, Medal,
  CheckCheck, Crown, ClipboardList, LayoutGrid, AlertTriangle,
} from "lucide-react";
import Link from "next/link";

type Tab = "inscritos" | "seeding" | "grupos" | "chave" | "placar";

const FORMATS_WITH_GROUPS = new Set(["groups_knockout"]);

function buildTabs(format: string): { id: Tab; label: string; Icon: typeof Users }[] {
  const base: { id: Tab; label: string; Icon: typeof Users }[] = [
    { id: "inscritos", label: "Inscritos", Icon: Users },
    { id: "seeding",   label: "Seeds",    Icon: ListOrdered },
  ];
  if (FORMATS_WITH_GROUPS.has(format)) base.push({ id: "grupos", label: "Grupos", Icon: LayoutGrid });
  base.push({ id: "chave", label: "Chave", Icon: Network });
  base.push({ id: "placar", label: "Placar", Icon: Play });
  return base;
}

export default function AdminTournamentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: tournament, isLoading } = useTournament(id);
  const { data: standings } = useTournamentStandings(id);
  const [tab, setTab] = useState<Tab>("inscritos");
  const [isPending, startTransition] = useTransition();
  const [generateConfirmOpen, setGenerateConfirmOpen] = useState(false);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<TournamentMatch | null>(null);
  const [localParticipants, setLocalParticipants] = useState<TournamentParticipant[] | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: tournamentKeys.detail(id) });
    queryClient.invalidateQueries({ queryKey: tournamentKeys.list() });
    queryClient.invalidateQueries({ queryKey: tournamentKeys.standings(id) });
  }

  if (isLoading) {
    return (
      <ArenaShell title="Torneio" showBack>
        <div className="flex items-center justify-center py-20">
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
  const seedingOrder = localParticipants ?? confirmed;
  const hasGroups = FORMATS_WITH_GROUPS.has(tournament.format);
  const groupMatches = tournament.matches.filter((m) => m.bracket === "group");
  const knockoutMatches = tournament.matches.filter((m) => m.bracket !== "group");
  const hasBracket = knockoutMatches.length > 0;
  const allGroupMatchesDone = groupMatches.length > 0 && groupMatches.every((m) => m.status === "finished");
  const TABS = buildTabs(tournament.format);
  const pendingMatches = tournament.matches.filter(
    (m) => (m.status === "pending" || m.status === "scheduled") && m.participantAId && m.participantBId && m.bracket !== "group",
  );
  const finishedMatches = tournament.matches.filter((m) => m.status === "finished" && (m.scoreA !== null || m.scoreB !== null) && m.bracket !== "group");
  const finalMatch = hasBracket && knockoutMatches.length > 0 ? knockoutMatches.reduce((b, m) => m.round < b.round ? m : b, knockoutMatches[0]!) : null;
  const hasFinalWinner = !!finalMatch?.winnerParticipantId;
  const champion = hasFinalWinner ? tournament.participants.find((p) => p.id === finalMatch!.winnerParticipantId) : null;

  async function handleGenerate() {
    startTransition(async () => {
      await generateBracket(id);
      setGenerateConfirmOpen(false);
      invalidate();
      setTab("chave");
    });
  }
  async function handleFinish() {
    const kMatches = tournament!.matches.filter((m) => m.bracket !== "group");
    if (!kMatches.length) return;
    const finalMatch = kMatches.reduce((best, m) => (m.round < best.round ? m : best), kMatches[0]!);
    const winnerId = finalMatch?.winnerParticipantId;
    if (!winnerId) return;
    startTransition(async () => {
      await finishTournament(id, winnerId);
      invalidate();
      setFinishConfirmOpen(false);
      router.push("/admin/torneios");
    });
  }
  async function handleSaveSeeding() {
    startTransition(async () => {
      await saveSeeding(id, seedingOrder.map((p, i) => ({ participantId: p.id, seed: i + 1 })));
      setLocalParticipants(null);
      invalidate();
    });
  }
  async function handleRemove(participantId: string) {
    startTransition(async () => {
      await removeParticipant(participantId, id);
      invalidate();
    });
  }

  return (
    <>
      <ArenaShell title={tournament.name} subtitle="Admin" showBack>
        <div className="flex flex-col gap-4">

          {/* ── Banner ── */}
          <GlassCard variant="elevated" className="relative overflow-hidden">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[inherit]"
              style={{
                background: "radial-gradient(ellipse 140% 80% at 90% 50%, color-mix(in srgb, var(--arena-primary) 8%, transparent) 0%, transparent 70%)",
              }}
            />
            <div className="relative flex items-center gap-3">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                style={{ background: fmt?.bg }}
              >
                <Trophy className="h-6 w-6" style={{ color: fmt?.color ?? "var(--arena-primary)" }} />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className="rounded-md px-2 py-0.5 text-[11px] font-bold"
                    style={{ background: fmt?.bg, color: fmt?.color, border: `1px solid ${fmt?.border}` }}
                  >
                    {fmt?.short ?? tournament.format}
                  </span>
                  <span
                    className="rounded-md px-2 py-0.5 text-[11px] font-semibold"
                    style={{
                      background: "color-mix(in srgb, var(--arena-muted) 12%, transparent)",
                      color: "var(--arena-muted)",
                    }}
                  >
                    MD{tournament.bestOf}
                  </span>
                </div>
                <p className="text-[11px] text-(--arena-muted)">
                  <span
                    className="font-black tabular-nums text-(--arena-foreground)"
                    style={{ fontFamily: "var(--font-display)", fontSize: "13px" }}
                  >
                    {confirmed.length}
                  </span>
                  {tournament.maxParticipants ? ` / ${tournament.maxParticipants}` : ""} jogadores
                </p>
              </div>
              <StatusPill kind={tournament.status} size="md" pulse={tournament.status === "active"} />
            </div>
          </GlassCard>

          {/* ── Banner campeão ── */}
          {tournament.status === "finished" && champion && (
            <GlassCard className="relative overflow-hidden">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-[inherit]"
                style={{ background: "radial-gradient(ellipse 120% 80% at 50% 50%, rgba(217,119,6,0.10) 0%, transparent 70%)" }}
              />
              <div className="relative flex flex-col items-center gap-2 py-2 text-center">
                <Crown className="h-8 w-8" style={{ color: "#d97706" }} />
                <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#d97706" }}>
                  Campeão
                </p>
                <p className="text-xl font-black text-(--arena-foreground)" style={{ fontFamily: "var(--font-display)" }}>
                  {champion.guestName ?? "Campeão"}
                </p>
                <p className="text-xs text-(--arena-muted)">
                  {finalMatch && finalMatch.scoreA !== null ? `${finalMatch.scoreA} × ${finalMatch.scoreB}` : "na final"}
                </p>
              </div>
            </GlassCard>
          )}

          {/* ── Ações ── */}
          {tournament.status !== "finished" && (
            <div className="flex flex-wrap gap-2">

              {/* DRAFT: abrir inscrições */}
              {tournament.status === "draft" && !hasBracket && (
                <button type="button"
                  onClick={() => startTransition(async () => { await openRegistration(id); invalidate(); })}
                  disabled={isPending}
                  className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-40"
                  style={{ background: "color-mix(in srgb, var(--arena-primary) 10%, transparent)", color: "var(--arena-primary)", border: "1px solid color-mix(in srgb, var(--arena-primary) 25%, transparent)" }}
                >
                  Abrir inscrições
                </button>
              )}

              {/* DRAFT com bracket: iniciar torneio diretamente */}
              {tournament.status === "draft" && hasBracket && (
                <button type="button"
                  onClick={() => startTransition(async () => { await closeRegistration(id); invalidate(); })}
                  disabled={isPending}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                  style={{ background: "var(--arena-primary)", boxShadow: "0 4px 12px color-mix(in srgb, var(--arena-primary) 30%, transparent)" }}
                >
                  <Play className="h-4 w-4" />
                  Iniciar torneio
                </button>
              )}

              {/* REGISTRATION: fechar inscrições */}
              {tournament.status === "registration" && (
                <button type="button"
                  onClick={() => startTransition(async () => { await closeRegistration(id); invalidate(); })}
                  disabled={isPending}
                  className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-40"
                  style={{ background: "color-mix(in srgb, var(--arena-primary) 10%, transparent)", color: "var(--arena-primary)", border: "1px solid color-mix(in srgb, var(--arena-primary) 25%, transparent)" }}
                >
                  Fechar inscrições
                </button>
              )}

              {/* DRAFT ou REGISTRATION + ≥2 jogadores + sem chave: gerar chave */}
              {(tournament.status === "draft" || tournament.status === "registration") &&
                confirmed.length >= 2 && !hasBracket && (
                  <button type="button"
                    onClick={() => setGenerateConfirmOpen(true)}
                    disabled={isPending}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                    style={{ background: "var(--arena-primary)", boxShadow: "0 4px 12px color-mix(in srgb, var(--arena-primary) 30%, transparent)" }}
                  >
                    <Network className="h-4 w-4" />
                    Gerar chave
                  </button>
                )}

              {/* REGISTRATION com chave gerada: iniciar torneio */}
              {tournament.status === "registration" && hasBracket && (
                <button type="button"
                  onClick={() => startTransition(async () => { await closeRegistration(id); invalidate(); })}
                  disabled={isPending}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                  style={{ background: "var(--arena-primary)", boxShadow: "0 4px 12px color-mix(in srgb, var(--arena-primary) 30%, transparent)" }}
                >
                  <Play className="h-4 w-4" />
                  Iniciar torneio
                </button>
              )}

              {/* ACTIVE: TV + Encerrar */}
              {tournament.status === "active" && (
                <>
                  <Link href={`/torneios/${id}/chave`} target="_blank" rel="noopener noreferrer">
                    <button type="button"
                      className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:opacity-90"
                      style={{ background: "color-mix(in srgb, var(--arena-primary) 10%, transparent)", color: "var(--arena-primary)", border: "1px solid color-mix(in srgb, var(--arena-primary) 25%, transparent)" }}
                    >
                      <Network className="h-4 w-4" />
                      Ver chave
                    </button>
                  </Link>
                  <Link href={`/tv/torneio/${id}`} target="_blank" rel="noopener noreferrer">
                    <button type="button"
                      className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:opacity-90"
                      style={{ background: "color-mix(in srgb, var(--arena-primary) 10%, transparent)", color: "var(--arena-primary)", border: "1px solid color-mix(in srgb, var(--arena-primary) 25%, transparent)" }}
                    >
                      <Tv className="h-4 w-4" />
                      TV
                    </button>
                  </Link>
                  <button type="button"
                    onClick={() => setFinishConfirmOpen(true)}
                    disabled={isPending || !hasFinalWinner}
                    title={!hasFinalWinner ? "Jogue todas as partidas até a final primeiro" : "Encerrar torneio e registrar campeão"}
                    className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    style={hasFinalWinner
                      ? { background: "color-mix(in srgb, var(--state-played) 12%, transparent)", color: "var(--state-played)", border: "1px solid color-mix(in srgb, var(--state-played) 25%, transparent)" }
                      : { background: "color-mix(in srgb, var(--arena-muted) 10%, transparent)", color: "var(--arena-muted)", border: "1px solid color-mix(in srgb, var(--arena-muted) 20%, transparent)" }
                    }
                  >
                    <Crown className="h-4 w-4" />
                    {hasFinalWinner ? "Encerrar" : "Encerrar…"}
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── Seletor de divisão (quando o torneio pertence a um evento) ── */}
          {tournament.eventId && (
            <DivisionSwitcher
              eventId={tournament.eventId}
              currentTournamentId={tournament.id}
              variant="admin"
            />
          )}

          {/* ── Tabs ── */}
          <div
            className="grid rounded-2xl p-1"
            style={{
              gridTemplateColumns: `repeat(${TABS.length}, 1fr)`,
              background: "color-mix(in srgb, var(--arena-primary) 8%, transparent)",
            }}
          >
            {TABS.map(({ id: tabId, label, Icon }) => (
              <button
                key={tabId}
                type="button"
                onClick={() => setTab(tabId)}
                className="flex flex-col items-center gap-0.5 rounded-xl py-2 px-1 transition-all"
                style={
                  tab === tabId
                    ? {
                        background: "var(--glass-bg-strong)",
                        color: "var(--arena-primary)",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                      }
                    : {
                        background: "transparent",
                        color: "var(--arena-muted)",
                      }
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="text-[10px] font-bold leading-none">{label}</span>
              </button>
            ))}
          </div>

          {/* ── Tab: Inscritos ── */}
          {tab === "inscritos" && (
            <div className="flex flex-col gap-2">


              <div className="flex items-center justify-between px-1">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)">
                  Confirmados
                </p>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{
                    background: "color-mix(in srgb, var(--arena-primary) 12%, transparent)",
                    color: "var(--arena-primary)",
                  }}
                >
                  {confirmed.length}{tournament.maxParticipants ? ` / ${tournament.maxParticipants}` : ""}
                </span>
              </div>

              {confirmed.length === 0 ? (
                <GlassCard className="flex flex-col items-center gap-2 py-10 text-center">
                  <Users className="h-8 w-8 text-(--arena-muted)" style={{ opacity: 0.4 }} />
                  <p className="text-sm text-(--arena-muted)">Nenhum inscrito ainda</p>
                </GlassCard>
              ) : (
                confirmed.map((p, idx) => {
                  const { bg, color, border } = getSeedColor(p.seed ?? idx + 1);
                  return (
                    <GlassCard
                      key={p.id}
                      noPadding
                      className="group flex items-center gap-3 px-3 py-2.5"
                    >
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums"
                        style={{ background: bg, color, border: `1px solid ${border}` }}
                      >
                        {p.seed ?? idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-(--arena-foreground)">
                          {p.guestName ?? `Participante ${p.seed ?? idx + 1}`}
                        </p>
                      </div>
                      {p.flag && (
                        <span className={`fi fi-${p.flag.toLowerCase()} shrink-0 text-sm`} aria-hidden />
                      )}
                      {tournament.status !== "active" && (
                        <button
                          type="button"
                          onClick={() => handleRemove(p.id)}
                          disabled={isPending}
                          className="shrink-0 rounded-lg p-1.5 opacity-0 transition hover:opacity-100 group-hover:opacity-60 disabled:cursor-not-allowed"
                          style={{ color: "var(--state-noshow)" }}
                          aria-label={`Remover ${p.guestName ?? "participante"}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </GlassCard>
                  );
                })
              )}

              {tournament.status !== "active" && tournament.status !== "finished" && (
                <AddParticipantsPanel tournamentId={id} disabled={isPending} onSuccess={invalidate} />
              )}
            </div>
          )}

          {/* ── Tab: Seeding ── */}
          {tab === "seeding" && (
            <div className="flex flex-col gap-3">
              <p className="px-1 text-xs text-(--arena-muted)">
                Ordene os jogadores do mais forte ao mais fraco. Na hora de distribuir os grupos, o sistema coloca automaticamente um jogador forte em cada grupo.
              </p>
              <SeedingBoard
                participants={seedingOrder}
                onChange={setLocalParticipants}
                disabled={isPending || hasBracket}
              />
              {localParticipants && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setLocalParticipants(null)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition hover:opacity-90"
                    style={{
                      background: "color-mix(in srgb, var(--arena-muted) 10%, transparent)",
                      color: "var(--arena-muted)",
                      border: "1px solid color-mix(in srgb, var(--arena-muted) 20%, transparent)",
                    }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Descartar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSeeding}
                    disabled={isPending}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                    style={{ background: "var(--arena-primary)" }}
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    Salvar seeds
                  </button>
                </div>
              )}
              {hasBracket && (
                <p className="text-center text-xs text-(--arena-muted)">
                  Chave já gerada — seeds bloqueados.
                </p>
              )}
            </div>
          )}

          {/* ── Tab: Grupos ── */}
          {tab === "grupos" && hasGroups && (
            <GroupsTab
              tournament={tournament}
              confirmed={confirmed}
              standings={standings ?? []}
              isPending={isPending}
              onMatchClick={setSelectedMatch}
              onGroupsConfigured={invalidate}
            />
          )}

          {/* ── Tab: Chave ── */}
          {tab === "chave" && (
            <div className="flex flex-col gap-3">
              {hasBracket ? (
                <>
                  {/* Bracket inline com scroll horizontal */}
                  <GlassCard noPadding className="overflow-hidden">
                    <div className="overflow-x-auto p-3">
                      <BracketCanvas
                        matches={tournament.matches}
                        participants={tournament.participants}
                        onMatchClick={(m) => {
                          // Permite lançar e também corrigir resultado já lançado.
                          if (m.participantAId && m.participantBId) {
                            setSelectedMatch(m);
                          }
                        }}
                        showProbability={false}
                      />
                    </div>
                  </GlassCard>
                  {/* Link para a página completa em tela cheia */}
                  <Link href={`/torneios/${id}/chave`} target="_blank" rel="noopener noreferrer">
                    <GlassCard noPadding className="group flex items-center gap-3 px-4 py-3 transition-all hover:scale-[1.005]">
                      <Network className="h-4 w-4 text-(--arena-primary)" />
                      <p className="flex-1 text-sm font-semibold text-(--arena-foreground)">Abrir chave em tela cheia</p>
                      <ChevronRight className="h-4 w-4 text-(--arena-muted) transition group-hover:translate-x-0.5" />
                    </GlassCard>
                  </Link>
                </>
              ) : (
                <GlassCard className="flex flex-col items-center gap-3 py-12 text-center">
                  <Network className="h-10 w-10 text-(--arena-muted)" style={{ opacity: 0.35 }} />
                  <div>
                    <p className="text-sm font-semibold text-(--arena-foreground)">Chave não gerada</p>
                    <p className="text-xs text-(--arena-muted)">
                      {confirmed.length < 2 ? "Adicione ao menos 2 jogadores" : "Pronto para gerar"}
                    </p>
                  </div>
                  {confirmed.length >= 2 && !hasGroups && (
                    <button
                      type="button"
                      onClick={() => setGenerateConfirmOpen(true)}
                      disabled={isPending}
                      className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                      style={{ background: "var(--arena-primary)" }}
                    >
                      <Network className="h-4 w-4" />
                      Gerar chave agora
                    </button>
                  )}
                  {hasGroups && !hasBracket && (
                    <p className="text-sm text-(--arena-muted)">
                      Finalize a fase de grupos para gerar o mata-mata.
                    </p>
                  )}
                </GlassCard>
              )}
            </div>
          )}

          {/* ── Tab: Placar ── */}
          {tab === "placar" && (
            <div className="flex flex-col gap-3">

              {/* Partidas a jogar */}
              {pendingMatches.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)">
                    A jogar
                  </p>
                  {pendingMatches.map((m) => {
                    const partA = tournament.participants.find((p) => p.id === m.participantAId);
                    const partB = tournament.participants.find((p) => p.id === m.participantBId);
                    const nameA = partA?.guestName ?? `Seed ${partA?.seed ?? "?"}`;
                    const nameB = partB?.guestName ?? `Seed ${partB?.seed ?? "?"}`;
                    const cA = getSeedColor(partA?.seed ?? 1);
                    const cB = getSeedColor(partB?.seed ?? 2);
                    const roundLabel = m.round === 1 ? "Final" : m.round === 2 ? "Semifinal" : m.round === 3 ? "Quartas de Final" : m.round === 4 ? "Oitavas de Final" : `Rodada ${m.round}`;
                    return (
                      <button key={m.id} type="button" onClick={() => setSelectedMatch(m)} className="w-full text-left">
                        <GlassCard noPadding className="group flex items-center gap-3 px-3.5 py-3 transition-all hover:scale-[1.01]">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums"
                            style={{ background: cA.bg, color: cA.color, border: `1px solid ${cA.border}` }}>
                            {partA?.seed ?? "?"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-(--arena-foreground)">
                              {nameA} <span className="text-(--arena-muted)">×</span> {nameB}
                            </p>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-(--arena-muted)">{roundLabel}</p>
                          </div>
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums"
                            style={{ background: cB.bg, color: cB.color, border: `1px solid ${cB.border}` }}>
                            {partB?.seed ?? "?"}
                          </div>
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition group-hover:scale-110"
                            style={{ background: "color-mix(in srgb, var(--arena-primary) 12%, transparent)" }}>
                            <Play className="h-3.5 w-3.5 text-(--arena-primary)" />
                          </div>
                        </GlassCard>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Vazio */}
              {pendingMatches.length === 0 && finishedMatches.length === 0 && (
                <GlassCard className="flex flex-col items-center gap-2 py-12 text-center">
                  <Swords className="h-8 w-8 text-(--arena-muted)" style={{ opacity: 0.35 }} />
                  <p className="text-sm text-(--arena-muted)">
                    {hasBracket ? "Todas as partidas finalizadas!" : "Gere a chave primeiro"}
                  </p>
                </GlassCard>
              )}

              {/* Partidas encerradas */}
              {finishedMatches.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)">
                    Resultados
                  </p>
                  {finishedMatches
                    .slice()
                    .sort((a, b) => b.round - a.round)
                    .map((m) => {
                      const partA = tournament.participants.find((p) => p.id === m.participantAId);
                      const partB = tournament.participants.find((p) => p.id === m.participantBId);
                      const nameA = partA?.guestName ?? `Seed ${partA?.seed ?? "?"}`;
                      const nameB = partB?.guestName ?? `Seed ${partB?.seed ?? "?"}`;
                      const cA = getSeedColor(partA?.seed ?? 1);
                      const cB = getSeedColor(partB?.seed ?? 2);
                      const isWinnerA = m.winnerParticipantId === m.participantAId;
                      const roundLabel = m.round === 1 ? "Final" : m.round === 2 ? "Semifinal" : m.round === 3 ? "Quartas de Final" : m.round === 4 ? "Oitavas de Final" : `Rodada ${m.round}`;
                      return (
                        <GlassCard key={m.id} noPadding className="flex items-center gap-3 px-3.5 py-3">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums"
                            style={{ background: cA.bg, color: cA.color, border: `1px solid ${cA.border}`, opacity: isWinnerA ? 1 : 0.45 }}>
                            {partA?.seed ?? "?"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-(--arena-foreground)">
                              <span style={{ fontWeight: isWinnerA ? 800 : 400 }}>{nameA}</span>
                              {" "}<span className="text-(--arena-muted)">×</span>{" "}
                              <span style={{ fontWeight: !isWinnerA ? 800 : 400 }}>{nameB}</span>
                            </p>
                            <p className="text-[10px] text-(--arena-muted)">{roundLabel}</p>
                          </div>
                          <div className="shrink-0 text-center">
                            <p className="font-black tabular-nums text-(--arena-foreground)" style={{ fontFamily: "var(--font-display)", fontSize: "15px" }}>
                              {m.scoreA ?? 0} <span className="text-(--arena-muted)" style={{ fontWeight: 400 }}>–</span> {m.scoreB ?? 0}
                            </p>
                          </div>
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums"
                            style={{ background: cB.bg, color: cB.color, border: `1px solid ${cB.border}`, opacity: !isWinnerA ? 1 : 0.45 }}>
                            {partB?.seed ?? "?"}
                          </div>
                        </GlassCard>
                      );
                    })}
                </div>
              )}

              {/* Próximos passos quando todas finalizadas */}
              {hasBracket && pendingMatches.length === 0 && !hasFinalWinner && finishedMatches.length > 0 && (
                <GlassCard className="flex items-center gap-3 py-3">
                  <CheckCheck className="h-5 w-5 shrink-0 text-(--arena-primary)" />
                  <p className="text-sm text-(--arena-muted)">Todas as partidas foram registradas.</p>
                </GlassCard>
              )}
              {hasFinalWinner && champion && (
                <GlassCard className="flex items-center gap-3">
                  <Medal className="h-6 w-6 shrink-0" style={{ color: "#d97706" }} />
                  <div>
                    <p className="text-sm font-bold text-(--arena-foreground)">{champion.guestName} venceu!</p>
                    <p className="text-xs text-(--arena-muted)">Acesse as ações acima para encerrar o torneio.</p>
                  </div>
                </GlassCard>
              )}
            </div>
          )}
        </div>
      </ArenaShell>

      {/* Score Sheet Modal */}
      {selectedMatch && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm sm:items-center sm:justify-center"
          onClick={() => setSelectedMatch(null)}
        >
          <div
            className="arena w-full max-w-sm rounded-t-3xl p-5 sm:rounded-3xl"
            style={{
              background: "var(--glass-bg-strong)",
              border: "1px solid var(--glass-border)",
              backdropFilter: "blur(20px)",
              boxShadow: "0 -8px 40px rgba(100,0,160,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="font-bold text-(--arena-foreground)" style={{ fontFamily: "var(--font-display)" }}>
                Lançar resultado
              </p>
              <button
                type="button"
                onClick={() => setSelectedMatch(null)}
                className="rounded-full p-1.5 transition hover:opacity-70"
                style={{ color: "var(--arena-muted)" }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ScoreSheet
              match={selectedMatch}
              participants={tournament.participants}
              tournamentId={id}
              bestOf={tournament.bestOf}
              onClose={() => { setSelectedMatch(null); invalidate(); }}
            />
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={generateConfirmOpen}
        onClose={() => setGenerateConfirmOpen(false)}
        onConfirm={handleGenerate}
        title="Gerar chave do torneio"
        description={`A chave será gerada com ${confirmed.length} participantes. Após gerar, os seeds não podem ser alterados.`}
        confirmText="Gerar chave"
        variant="warning"
        loading={isPending}
      />
      <ConfirmModal
        isOpen={finishConfirmOpen}
        onClose={() => setFinishConfirmOpen(false)}
        onConfirm={handleFinish}
        title="Encerrar torneio"
        description={(() => {
          const kk = tournament.matches.filter((m) => m.bracket !== "group");
          const finalMatch = kk.length > 0 ? kk.reduce((b, m) => m.round < b.round ? m : b, kk[0]!) : null;
          const winnerId = finalMatch?.winnerParticipantId;
          const champ = winnerId ? tournament.participants.find((p) => p.id === winnerId) : null;
          if (champ) {
            return `Campeão: ${champ.guestName ?? "Jogador"}. O torneio será encerrado e este resultado registrado permanentemente.`;
          }
          return "A final ainda não foi jogada. Jogue todas as partidas antes de encerrar.";
        })()}
        confirmText="Encerrar torneio"
        variant="danger"
        loading={isPending}
      />
    </>
  );
}

function GroupsTab({
  tournament, confirmed, standings, isPending, onMatchClick, onGroupsConfigured,
}: {
  tournament: TournamentDetail;
  confirmed: TournamentParticipant[];
  standings: GroupStanding[];
  isPending: boolean;
  onMatchClick: (m: TournamentMatch) => void;
  onGroupsConfigured: () => void;
}) {
  const groupIds = Array.from(new Set(tournament.participants.map((p) => p.groupId).filter(Boolean))) as string[];
  const groupMatches = tournament.matches.filter((m) => m.bracket === "group");
  const [numGroups, setNumGroups] = useState(
    Math.max(2, Math.min(8, Math.floor(confirmed.length / 3))),
  );
  const [isConfiguring, startConfiguring] = useTransition();

  function computePreview(n: number) {
    const labels = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
    const seeded = [...confirmed].sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999));
    const groups = new Map<string, TournamentParticipant[]>(labels.map((l) => [l, []]));
    seeded.forEach((p, i) => {
      const round = Math.floor(i / n);
      const pos = i % n;
      const idx = round % 2 === 0 ? pos : n - 1 - pos;
      groups.get(labels[idx]!)!.push(p);
    });
    return groups;
  }

  const confirmedKey = confirmed.map((p) => p.id).sort().join(",");
  const [editableGroups, setEditableGroups] = useState(() => computePreview(numGroups));

  useEffect(() => {
    setEditableGroups(computePreview(numGroups));
  // confirmedKey garante que a distribuição é refeita se a lista de participantes mudar
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numGroups, confirmedKey]);

  async function handleConfigureGroups() {
    const assignments: { participantId: string; groupId: string }[] = [];
    for (const [label, players] of editableGroups) {
      for (const p of players) {
        assignments.push({ participantId: p.id, groupId: label });
      }
    }
    startConfiguring(async () => {
      await configureGroups(tournament.id, assignments);
      onGroupsConfigured();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Classificação por grupo */}
      {groupIds.map((gId) => {
        const groupStandings = standings.filter((s) => s.groupId === gId).sort((a, b) => a.position - b.position);
        const gMatches = groupMatches.filter((m) => m.groupId === gId);
        const pendingInGroup = gMatches.filter((m) => m.status !== "finished");
        const groupDone = gMatches.length > 0 && pendingInGroup.length === 0;

        return (
          <div key={gId} className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)">
                Grupo {gId}
              </p>
              {groupDone ? (
                <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{ background: "color-mix(in srgb,var(--state-played) 12%,transparent)", color: "var(--state-played)" }}>
                  <CheckCheck className="h-3 w-3" /> Classificados no mata-mata
                </span>
              ) : (
                <span className="text-[10px] text-(--arena-muted)">
                  {pendingInGroup.length} partida{pendingInGroup.length !== 1 ? "s" : ""} restante{pendingInGroup.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Tabela de classificação */}
            <GlassCard noPadding className="overflow-hidden">
              <div className="flex items-center gap-2 border-b px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-(--arena-muted)"
                style={{ borderColor: "var(--glass-border)" }}>
                <span className="w-5">#</span>
                <span className="flex-1">Jogador</span>
                <span className="w-8 text-center">V</span>
                <span className="w-8 text-center">D</span>
                <span className="w-12 text-center">Sets</span>
                <span className="w-10 text-center">Pts</span>
              </div>
              {groupStandings.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-(--arena-muted)">Nenhum resultado ainda</p>
              ) : groupStandings.map((s, idx) => {
                const part = tournament.participants.find((p) => p.id === s.participantId);
                const { bg, color, border } = getSeedColor(idx + 1);
                return (
                  <div key={s.participantId} className="flex items-center gap-2 px-3 py-2.5"
                    style={{ borderTop: idx > 0 ? `1px solid var(--glass-border)` : undefined }}>
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                      style={{ background: bg, color, border: `1px solid ${border}` }}>
                      {s.position}
                    </div>
                    <span className="flex-1 truncate text-sm font-semibold text-(--arena-foreground)">
                      {part?.guestName ?? `Jogador ${s.participantId}`}
                    </span>
                    <span className="w-8 text-center text-sm tabular-nums" style={{ color: "var(--state-played)" }}>{s.wins}</span>
                    <span className="w-8 text-center text-sm tabular-nums" style={{ color: "var(--state-noshow)" }}>{s.losses}</span>
                    <span className="w-12 text-center text-xs tabular-nums text-(--arena-muted)">{s.setsWon}–{s.setsLost}</span>
                    <span className="w-10 text-center text-sm font-black tabular-nums text-(--arena-foreground)"
                      style={{ fontFamily: "var(--font-display)" }}>{s.points}</span>
                  </div>
                );
              })}
            </GlassCard>

            {/* Partidas do grupo */}
            {gMatches.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {gMatches.map((m) => {
                  const partA = tournament.participants.find((p) => p.id === m.participantAId);
                  const partB = tournament.participants.find((p) => p.id === m.participantBId);
                  const cA = getSeedColor(partA?.seed ?? 1);
                  const cB = getSeedColor(partB?.seed ?? 2);
                  const done = m.status === "finished";
                  const isWinnerA = m.winnerParticipantId === m.participantAId;
                  return (
                    <button key={m.id} type="button" onClick={() => onMatchClick(m)}
                      className="w-full cursor-pointer text-left"
                      title={done ? "Toque para corrigir o resultado" : "Toque para lançar o resultado"}>
                      <GlassCard noPadding className="group flex items-center gap-3 px-3 py-2.5 transition-all hover:scale-[1.005]">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                          style={{ background: cA.bg, color: cA.color, border: `1px solid ${cA.border}`, opacity: done && !isWinnerA ? 0.45 : 1 }}>
                          {partA?.seed ?? "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-(--arena-foreground)">
                            <span style={{ fontWeight: done && isWinnerA ? 800 : 400 }}>{partA?.guestName ?? "?"}</span>
                            {" "}<span className="text-(--arena-muted)">×</span>{" "}
                            <span style={{ fontWeight: done && !isWinnerA ? 800 : 400 }}>{partB?.guestName ?? "?"}</span>
                          </p>
                        </div>
                        {done ? (
                          <span className="shrink-0 font-black tabular-nums text-(--arena-foreground)"
                            style={{ fontFamily: "var(--font-display)", fontSize: "13px" }}>
                            {m.scoreA} – {m.scoreB}
                          </span>
                        ) : (
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                            style={{ background: "color-mix(in srgb, var(--arena-primary) 12%, transparent)" }}>
                            <Play className="h-3 w-3 text-(--arena-primary)" />
                          </div>
                        )}
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                          style={{ background: cB.bg, color: cB.color, border: `1px solid ${cB.border}`, opacity: done && isWinnerA ? 0.45 : 1 }}>
                          {partB?.seed ?? "?"}
                        </div>
                      </GlassCard>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {groupIds.length === 0 && groupMatches.length === 0 && (
        <div className="flex flex-col gap-4">
          {/* Seletor de número de grupos */}
          <GlassCard className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "color-mix(in srgb,var(--arena-primary) 12%,transparent)" }}>
                <LayoutGrid className="h-5 w-5 text-(--arena-primary)" />
              </div>
              <div>
                <p className="text-sm font-bold text-(--arena-foreground)">Configurar grupos</p>
                <p className="text-xs text-(--arena-muted)">{confirmed.length} jogadores confirmados</p>
              </div>
            </div>

            {/* Número de grupos */}
            {(() => {
              const maxG = Math.min(Math.floor(confirmed.length / 2), 8);
              const groupOptions = Array.from({ length: maxG - 1 }, (_, i) => i + 2);

              const minSizeSel = Math.floor(confirmed.length / numGroups);
              const spotsSel = Math.max(1, Math.ceil(minSizeSel / 2));
              const totalSel = numGroups * spotsSel;
              const validSel = totalSel > 0 && (totalSel & (totalSel - 1)) === 0;
              const equalSel = confirmed.length % numGroups === 0;

              const validOptions = groupOptions.filter((n) => {
                const s = Math.max(1, Math.ceil(Math.floor(confirmed.length / n) / 2));
                const t = n * s;
                return t > 0 && (t & (t - 1)) === 0;
              });

              return (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-(--arena-muted)">Número de grupos</p>

                  <div className="flex flex-wrap gap-2">
                    {groupOptions.map((n) => {
                      const minSize = Math.floor(confirmed.length / n);
                      const spots = Math.max(1, Math.ceil(minSize / 2));
                      const total = n * spots;
                      const valid = total > 0 && (total & (total - 1)) === 0;
                      const equal = confirmed.length % n === 0;
                      const isSelected = numGroups === n;

                      let bg: string, fg: string;
                      if (isSelected) {
                        bg = valid ? "var(--arena-primary)" : "#b45309";
                        fg = "#fff";
                      } else {
                        bg = "color-mix(in srgb,var(--arena-muted) 10%,transparent)";
                        fg = valid ? "var(--arena-foreground)" : "var(--arena-muted)";
                      }

                      const sizeMin = Math.floor(confirmed.length / n);
                      const sizeMax = Math.ceil(confirmed.length / n);
                      const tooltipSize = equal
                        ? `Todos os grupos terão exatamente ${sizeMin} jogadores`
                        : `Os grupos terão ${sizeMin} ou ${sizeMax} jogadores`;
                      const tooltipBracket = valid
                        ? `${total} jogadores avançam para o mata-mata — chaveamento completo`
                        : `${total} jogadores avançariam para o mata-mata — número incompatível com o chaveamento`;
                      const tooltip = `${tooltipSize}. ${tooltipBracket}.`;

                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setNumGroups(n)}
                          className="relative flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold transition"
                          style={{ background: bg, color: fg }}
                          title={tooltip}
                        >
                          {n}
                          {/* Badge verde: todos os grupos com o mesmo número de jogadores */}
                          {equal && (
                            <span className="absolute -left-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full"
                              style={{ background: "#22c55e" }}>
                              <CheckCircle className="h-2.5 w-2.5 text-white" />
                            </span>
                          )}
                          {/* Badge laranja: número de classificados incompatível com o mata-mata */}
                          {!valid && (
                            <span className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-amber-500">
                              <AlertTriangle className="h-2 w-2 text-white" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Legenda compacta */}
                  <div className="flex items-center gap-4 text-[10px] text-(--arena-muted)">
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <CheckCircle className="h-3 w-3 shrink-0" style={{ color: "#22c55e" }} />
                      grupos iguais
                    </span>
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" />
                      mata-mata incompleto
                    </span>
                  </div>

                  {/* Descrição do estado atual */}
                  {!validSel ? (
                    <div className="flex items-start gap-2 rounded-xl p-3" style={{ background: "color-mix(in srgb,#b45309 10%,transparent)", border: "1px solid color-mix(in srgb,#b45309 30%,transparent)" }}>
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#b45309" }} />
                      <div>
                        <p className="text-[11px] font-bold" style={{ color: "#b45309" }}>
                          Esta divisão deixa o mata-mata incompleto
                        </p>
                        <p className="text-[11px] text-(--arena-muted) mt-0.5">
                          Com {numGroups} grupos, {totalSel} jogadores avançariam — número que não fecha o chaveamento corretamente.
                          {validOptions.length > 0 && (
                            <> Use {validOptions.join(" ou ")} grupo{validOptions.length > 1 ? "s" : ""} para que o mata-mata fique completo.</>
                          )}
                        </p>
                      </div>
                    </div>
                  ) : equalSel ? (
                    <p className="text-[11px]" style={{ color: "#22c55e" }}>
                      {numGroups} grupos de {Math.floor(confirmed.length / numGroups)} jogadores cada —{" "}
                      {totalSel} avançam para o mata-mata. Divisão perfeita.
                    </p>
                  ) : (
                    <p className="text-[11px] text-(--arena-muted)">
                      Os grupos terão {Math.floor(confirmed.length / numGroups)} ou {Math.ceil(confirmed.length / numGroups)} jogadores.{" "}
                      {totalSel} avançam para o mata-mata. O chaveamento fecha corretamente.
                    </p>
                  )}
                </div>
              );
            })()}

            {(() => {
              const minSize = Math.floor(confirmed.length / numGroups);
              const spots = Math.max(1, Math.ceil(minSize / 2));
              const total = numGroups * spots;
              const valid = total > 0 && (total & (total - 1)) === 0;
              return (
                <button
                  type="button"
                  onClick={handleConfigureGroups}
                  disabled={isConfiguring || isPending || confirmed.length < numGroups * 2 || !valid}
                  className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                  style={{ background: "var(--arena-primary)", boxShadow: "0 4px 12px color-mix(in srgb,var(--arena-primary) 30%,transparent)" }}
                >
                  {isConfiguring ? <Loader2 className="h-4 w-4 animate-spin" /> : <LayoutGrid className="h-4 w-4" />}
                  Distribuir e gerar partidas
                </button>
              );
            })()}
          </GlassCard>

          {/* Board drag-and-drop — breakout para tela cheia */}
          <div className="flex items-center justify-between px-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)">
              Distribuição dos grupos
            </p>
            <p className="text-[11px] text-(--arena-muted)">Arraste para ajustar</p>
          </div>
          <div
            style={{
              width: "100vw",
              marginLeft: "calc(50% - 50vw)",
              paddingLeft: "clamp(0.75rem, 4vw, 2rem)",
              paddingRight: "clamp(0.75rem, 4vw, 2rem)",
            }}
          >
            <GroupDistributionBoard groups={editableGroups} onChange={setEditableGroups} />
          </div>
        </div>
      )}
    </div>
  );
}

function AddParticipantsPanel({
  tournamentId, disabled, onSuccess,
}: { tournamentId: string; disabled: boolean; onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [adding, startTransition] = useTransition();

  const parsedNames = bulkText
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  function handleAdd() {
    if (!name.trim()) return;
    startTransition(async () => {
      await addParticipants(tournamentId, [{ guestName: name.trim() }]);
      setName("");
      onSuccess();
    });
  }

  function handleBulkImport() {
    if (!parsedNames.length) return;
    startTransition(async () => {
      await addParticipants(tournamentId, parsedNames.map((n) => ({ guestName: n })));
      setBulkText("");
      setBulkMode(false);
      onSuccess();
    });
  }

  const inputStyle = {
    background: "var(--glass-bg)",
    border: "1px solid var(--glass-border)",
    color: "var(--arena-foreground)",
  };

  const focusHandlers = {
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      e.currentTarget.style.borderColor = "color-mix(in srgb, var(--arena-primary) 50%, transparent)";
      e.currentTarget.style.boxShadow = "0 0 0 3px color-mix(in srgb, var(--arena-primary) 10%, transparent)";
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      e.currentTarget.style.borderColor = "var(--glass-border)";
      e.currentTarget.style.boxShadow = "none";
    },
  };

  return (
    <div className="flex flex-col gap-2 pt-1">
      {!bulkMode ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Nome do jogador..."
            disabled={disabled || adding}
            maxLength={80}
            className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium outline-none transition"
            style={inputStyle}
            {...focusHandlers}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={disabled || adding || !name.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "var(--arena-primary)", boxShadow: "0 2px 8px color-mix(in srgb, var(--arena-primary) 25%, transparent)" }}
            aria-label="Adicionar jogador"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={"Um nome por linha (ou separados por vírgula):\nCarlos Almeida\nAndré Santos\nLucas Ferreira"}
            disabled={disabled || adding}
            rows={5}
            className="w-full resize-none rounded-xl px-4 py-3 text-sm font-medium outline-none transition"
            style={inputStyle}
            {...focusHandlers}
          />
          {parsedNames.length > 0 && (
            <p className="px-1 text-xs text-(--arena-muted)">
              {parsedNames.length} {parsedNames.length === 1 ? "nome detectado" : "nomes detectados"}:{" "}
              <span className="font-medium text-(--arena-foreground)">{parsedNames.slice(0, 3).join(", ")}{parsedNames.length > 3 ? "…" : ""}</span>
            </p>
          )}
          <button
            type="button"
            onClick={handleBulkImport}
            disabled={disabled || adding || parsedNames.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "var(--arena-primary)", boxShadow: "0 2px 8px color-mix(in srgb, var(--arena-primary) 25%, transparent)" }}
          >
            {adding
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Importando…</>
              : <><ClipboardList className="h-4 w-4" /> Importar {parsedNames.length > 0 ? parsedNames.length : ""} {parsedNames.length === 1 ? "jogador" : "jogadores"}</>
            }
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => { setBulkMode((v) => !v); setName(""); setBulkText(""); }}
        disabled={disabled || adding}
        className="self-start text-xs font-semibold transition hover:opacity-80 disabled:opacity-40"
        style={{ color: "var(--arena-primary)" }}
      >
        {bulkMode ? "← Adicionar um por um" : "Importar lista de nomes"}
      </button>
    </div>
  );
}
