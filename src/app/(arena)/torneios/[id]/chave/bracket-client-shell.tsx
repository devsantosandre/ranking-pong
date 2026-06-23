"use client";

import { BracketCanvas } from "@/components/bracket/bracket-canvas";
import { StandingsTable } from "@/components/tournaments/standings-table";
import { useRealtimeBracket } from "@/lib/realtime/use-realtime-bracket";
import { useTournamentBracket, tournamentKeys } from "@/lib/queries/use-tournaments";
import { useQueryClient } from "@tanstack/react-query";
import { computeGroupStandings } from "@/lib/tournaments/standings";
import { participantName } from "@/lib/tournaments/recap";
import { GlassCard } from "@/components/arena/glass-card";
import type { TournamentMatch, TournamentParticipant, GroupStanding } from "@/lib/tournaments/types";
import { useState, useMemo, useCallback } from "react";
import { ScoreSheet } from "@/components/tournaments/score-sheet";
import { Network, X, Medal } from "lucide-react";

interface BracketClientShellProps {
  tournamentId: string;
  initialMatches: TournamentMatch[];
  participants: TournamentParticipant[];
  isLive: boolean;
  bestOf?: number;
  isAdmin?: boolean;
  isRoundRobin?: boolean;
  initialStandings?: GroupStanding[];
}

export function BracketClientShell({
  tournamentId,
  initialMatches,
  participants,
  isLive,
  bestOf = 5,
  isAdmin = false,
  isRoundRobin = false,
  initialStandings = [],
}: BracketClientShellProps) {
  const { data } = useTournamentBracket(tournamentId, { live: isLive });
  const liveMatches = data?.matches ?? initialMatches;
  const [selectedMatch, setSelectedMatch] = useState<TournamentMatch | null>(null);
  const queryClient = useQueryClient();

  useRealtimeBracket(isLive ? tournamentId : "");

  // Após lançar/corrigir/desfazer, força a chave a refazer o fetch (atualização
  // imediata mesmo sem realtime, ex.: modo mock).
  const handleScoreClose = useCallback(() => {
    setSelectedMatch(null);
    queryClient.invalidateQueries({ queryKey: tournamentKeys.bracket(tournamentId) });
    queryClient.invalidateQueries({ queryKey: tournamentKeys.standings(tournamentId) });
  }, [queryClient, tournamentId]);

  const hasGroups = liveMatches.some((m: TournamentMatch) => m.bracket === "group");
  // A disputa de 3º (placement) é renderizada à parte — não entra no canvas
  // (senão ela ficaria sobreposta à final, ambas no round 1).
  const placementMatch = liveMatches.find((m: TournamentMatch) => m.bracket === "placement") ?? null;
  const canvasMatches = liveMatches.filter((m: TournamentMatch) => m.bracket !== "placement");
  const bracketMatches = canvasMatches.filter((m: TournamentMatch) => m.bracket !== "group");
  const hasBracket = bracketMatches.length > 0;

  // Recalcula standings com os dados ao vivo
  const standings = useMemo(() => {
    if (!hasGroups) return initialStandings;
    return computeGroupStandings(liveMatches, participants);
  }, [hasGroups, liveMatches, participants, initialStandings]);

  // Número de vagas por grupo (metade dos participantes do grupo)
  const qualifyingSpots = useMemo(() => {
    if (!hasGroups) return 2;
    const byGroup = new Map<string, number>();
    for (const p of participants) {
      if (p.groupId) byGroup.set(p.groupId, (byGroup.get(p.groupId) ?? 0) + 1);
    }
    const sizes = Array.from(byGroup.values());
    return sizes.length > 0 ? Math.ceil(sizes[0]! / 2) : 2;
  }, [hasGroups, participants]);

  return (
    <div className="flex flex-col gap-6 px-4 py-4 sm:px-6">

      {/* ── Fase de Grupos / Classificação ── */}
      {hasGroups && (
        <section className="flex flex-col gap-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-(--arena-muted)">
            {isRoundRobin ? "Classificação" : "Fase de Grupos"}
          </p>
          <StandingsTable
            standings={standings}
            participants={participants}
            qualifyingSpots={isRoundRobin ? 1 : qualifyingSpots}
          />
        </section>
      )}

      {/* ── Separador Mata-mata (não há em round-robin) ── */}
      {hasGroups && !isRoundRobin && (
        <div className="flex items-center gap-3">
          <div className="h-px flex-1" style={{ background: "var(--glass-border)" }} />
          <div className="flex items-center gap-2">
            <Network className="h-3.5 w-3.5 text-(--arena-muted)" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-(--arena-muted)">
              Mata-mata
            </p>
          </div>
          <div className="h-px flex-1" style={{ background: "var(--glass-border)" }} />
        </div>
      )}

      {/* ── Bracket ── */}
      {hasBracket ? (
        <section>
          <BracketCanvas
            matches={canvasMatches}
            participants={participants}
            live={isLive}
            onMatchClick={isAdmin
              ? (m) => {
                  // Só permite lançar/corrigir quando os dois jogadores já estão definidos.
                  if (m.participantAId && m.participantBId) setSelectedMatch(m);
                }
              : undefined}
          />
          {isLive && (
            <p className="mt-3 text-center text-[11px] text-(--arena-muted)">
              Chave ao vivo — atualiza automaticamente
            </p>
          )}
        </section>
      ) : isRoundRobin ? null : hasGroups ? (
        <p className="py-8 text-center text-sm text-(--arena-muted)">
          Mata-mata será gerado ao encerrar a fase de grupos
        </p>
      ) : (
        <p className="py-8 text-center text-sm text-(--arena-muted)">
          Chave não gerada ainda
        </p>
      )}

      {/* ── Disputa de 3º lugar (renderizada fora do canvas) ── */}
      {placementMatch && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1" style={{ background: "var(--glass-border)" }} />
            <div className="flex items-center gap-2">
              <Medal className="h-3.5 w-3.5" style={{ color: "var(--state-played)" }} />
              <p className="text-[11px] font-bold uppercase tracking-widest text-(--arena-muted)">
                Disputa de 3º lugar
              </p>
            </div>
            <div className="h-px flex-1" style={{ background: "var(--glass-border)" }} />
          </div>
          <PlacementCard
            match={placementMatch}
            participants={participants}
            onClick={
              isAdmin && placementMatch.participantAId && placementMatch.participantBId
                ? () => setSelectedMatch(placementMatch)
                : undefined
            }
          />
        </section>
      )}

      {/* Modal de lançar placar — admin */}
      {isAdmin && selectedMatch && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
          onClick={() => setSelectedMatch(null)}
        >
          <div
            className="arena w-full max-h-[92dvh] overflow-y-auto rounded-t-3xl p-5 sm:max-w-sm sm:rounded-3xl"
            style={{
              background: "var(--arena-bg-1)",
              border: "1px solid var(--glass-border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="font-bold text-(--arena-foreground)" style={{ fontFamily: "var(--font-display)" }}>
                Lançar resultado
              </p>
              <button type="button" onClick={() => setSelectedMatch(null)}
                className="rounded-full p-1.5 transition hover:opacity-70"
                style={{ color: "var(--arena-muted)" }}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <ScoreSheet
              match={selectedMatch}
              participants={participants}
              tournamentId={tournamentId}
              bestOf={bestOf}
              onClose={handleScoreClose}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** Card da disputa de 3º lugar — fora do bracket, clicável p/ admin lançar placar. */
function PlacementCard({
  match,
  participants,
  onClick,
}: {
  match: TournamentMatch;
  participants: TournamentParticipant[];
  onClick?: () => void;
}) {
  const nameOf = (id: string | null) =>
    id ? participantName(participants.find((p) => p.id === id)) : "A definir";
  const bothSet = !!match.participantAId && !!match.participantBId;
  const winnerId = match.winnerParticipantId;

  const row = (id: string | null, score: number | null) => {
    const isWinner = !!winnerId && winnerId === id;
    return (
      <div className="flex items-center justify-between gap-2">
        <span
          className="min-w-0 flex-1 truncate text-sm font-semibold"
          style={{ color: isWinner ? "var(--state-played)" : "var(--arena-foreground)" }}
        >
          {nameOf(id)}
        </span>
        <span className="shrink-0 text-sm font-bold tabular-nums text-(--arena-foreground)">
          {score ?? "–"}
        </span>
      </div>
    );
  };

  return (
    <GlassCard
      noPadding
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      className={`flex flex-col gap-1.5 px-4 py-3 ${
        onClick ? "cursor-pointer hover:scale-[1.01] hover:bg-(--glass-bg-hover)" : ""
      }`}
    >
      {row(match.participantAId, match.scoreA)}
      <div className="h-px" style={{ background: "var(--glass-border)" }} />
      {row(match.participantBId, match.scoreB)}
      {!bothSet && (
        <p className="pt-0.5 text-[10px] text-(--arena-muted)">
          Aguardando o fim das semifinais
        </p>
      )}
    </GlassCard>
  );
}
