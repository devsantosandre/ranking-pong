"use client";

import { ScoreSheet } from "@/components/tournaments/score-sheet";
import { GlassCard } from "@/components/arena/glass-card";
import { StatusPill } from "@/components/arena/status-pill";
import type { TournamentMatch, TournamentParticipant } from "@/lib/tournaments/types";
import { useRouter } from "next/navigation";
import { Smartphone } from "lucide-react";

interface ScoreAtTableClientProps {
  match: TournamentMatch;
  participants: TournamentParticipant[];
  tournamentId: string;
  bestOf: number;
}

function getParticipantName(id: string | null, participants: TournamentParticipant[]): string {
  if (!id) return "A definir";
  return participants.find((p) => p.id === id)?.guestName ?? "Jogador";
}

export function ScoreAtTableClient({
  match,
  participants,
  tournamentId,
  bestOf,
}: ScoreAtTableClientProps) {
  const router = useRouter();
  const nameA = getParticipantName(match.participantAId, participants);
  const nameB = getParticipantName(match.participantBId, participants);

  return (
    <div className="flex flex-col gap-4">
      {/* Info da partida */}
      <GlassCard variant="elevated" className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" style={{ color: "var(--arena-primary)" }} />
            <p className="text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)">
              Score@Table
            </p>
          </div>
          <StatusPill kind="active" size="md" pulse />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-(--arena-foreground)">
            {nameA}
          </p>
          <p className="text-xs text-(--arena-muted)">vs</p>
          <p className="text-sm font-semibold text-(--arena-foreground)">
            {nameB}
          </p>
        </div>
        <p className="text-center text-[11px] text-(--arena-muted)">
          Mesa {match.tableNo ?? "—"} · Rodada {match.round}
        </p>
      </GlassCard>

      {/* ScoreSheet */}
      <GlassCard>
        <ScoreSheet
          match={match}
          participants={participants}
          tournamentId={tournamentId}
          bestOf={bestOf}
          onClose={() => router.push(`/torneios/${tournamentId}/chave`)}
        />
      </GlassCard>

      <p className="text-center text-[11px] text-(--arena-muted)">
        O resultado será enviado para confirmação do administrador.
      </p>
    </div>
  );
}
