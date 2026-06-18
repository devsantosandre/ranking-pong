"use client";

import { cn } from "@/lib/utils";
import { ParticipantRow } from "./participant-row";
import { WinProbabilityBar } from "./win-probability-bar";
import type { TournamentMatch, TournamentParticipant } from "@/lib/tournaments/types";
import { winProbability } from "@/lib/tournaments/win-probability";

interface MatchCardProps {
  match: TournamentMatch;
  participants: TournamentParticipant[];
  ratings?: Map<string, number>;
  onClick?: (match: TournamentMatch) => void;
  showProbability?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

function getParticipant(
  participantId: string | null,
  participants: TournamentParticipant[],
): TournamentParticipant | null {
  if (!participantId) return null;
  return participants.find((p) => p.id === participantId) ?? null;
}

function getParticipantName(p: TournamentParticipant | null): string {
  if (!p) return "A definir";
  return p.guestName ?? `Jogador ${p.seed ?? "?"}`;
}

export function MatchCard({
  match,
  participants,
  ratings,
  onClick,
  showProbability,
  style,
  className,
}: MatchCardProps) {
  const isActive = match.status === "in_progress";
  const isPlayed = match.status === "finished";

  const partA = getParticipant(match.participantAId, participants);
  const partB = getParticipant(match.participantBId, participants);
  const nameA = getParticipantName(partA);
  const nameB = getParticipantName(partB);

  const winnerIsA = match.winnerParticipantId === match.participantAId;
  const winnerIsB = match.winnerParticipantId === match.participantBId;

  const variantA = isPlayed ? (winnerIsA ? "win" : "lose") : match.participantAId ? "pending" : "tbd";
  const variantB = isPlayed ? (winnerIsB ? "win" : "lose") : match.participantBId ? "pending" : "tbd";

  const ratingA = partA?.userId && ratings ? (ratings.get(partA.userId) ?? 1000) : 1000;
  const ratingB = partB?.userId && ratings ? (ratings.get(partB.userId) ?? 1000) : 1000;
  const pA = Math.round(winProbability(ratingA, ratingB) * 100);

  const showBar =
    showProbability &&
    !isPlayed &&
    match.participantAId &&
    match.participantBId &&
    pA !== 50;

  return (
    <div
      style={{ width: 270, ...style }}
      className={cn(
        "glass overflow-hidden cursor-pointer transition-all duration-150",
        "hover:brightness-110 hover:scale-[1.01]",
        isActive && "animate-arena-glow-pulse",
        isActive && "border-[color-mix(in_srgb,var(--state-active)_40%,transparent)]",
        className,
      )}
      onClick={() => onClick?.(match)}
    >
      <ParticipantRow
        seed={partA?.seed}
        flag={partA?.flag}
        name={nameA}
        score={match.scoreA}
        variant={variantA}
      />

      <div className="h-px w-full" style={{ background: "var(--glass-border)" }} />

      <ParticipantRow
        seed={partB?.seed}
        flag={partB?.flag}
        name={nameB}
        score={match.scoreB}
        variant={variantB}
      />

      {/* Barra de probabilidade */}
      {showBar && (
        <div className="px-3 pb-2 pt-1">
          <WinProbabilityBar pA={pA} nameA={nameA} nameB={nameB} />
        </div>
      )}

      {/* Barra ativa */}
      {isActive && (
        <div className="h-0.5 w-full" style={{ background: "var(--state-active)" }} />
      )}
    </div>
  );
}
