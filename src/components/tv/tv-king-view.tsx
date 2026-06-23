"use client";

import { useMemo, useState, useEffect } from "react";
import { useTournamentBracket } from "@/lib/queries/use-tournaments";
import type { TournamentMatch, TournamentParticipant } from "@/lib/tournaments/types";
import { Crown, Sword, Trophy, Flame } from "lucide-react";

interface TvKingViewProps {
  tournamentId: string;
  initialMatches: TournamentMatch[];
  initialParticipants: TournamentParticipant[];
  tournamentName: string;
  isActive: boolean;
}

function participantName(p: TournamentParticipant | undefined): string {
  if (!p) return "A definir";
  return p.guestName ?? `Jogador ${p.seed ?? "?"}`;
}

export function TvKingView({
  tournamentId,
  initialMatches,
  initialParticipants,
  tournamentName,
}: TvKingViewProps) {
  const { data } = useTournamentBracket(tournamentId);
  const liveMatches = (data?.matches ?? initialMatches) as TournamentMatch[];
  const participants = (data?.participants ?? initialParticipants) as TournamentParticipant[];

  // Determinar rei atual: quem tem mais vitórias consecutivas
  const { king, challenger, reigns, history } = useMemo(() => {
    const finished = [...liveMatches]
      .filter((m) => m.status === "finished" && m.winnerParticipantId)
      .sort((a, b) => (a.finishedAt ?? "").localeCompare(b.finishedAt ?? ""));

    let currentKingId: string | null = null;
    let consecutiveWins = 0;
    const reignHistory: Array<{ kingId: string; wins: number }> = [];

    for (const m of finished) {
      const winner = m.winnerParticipantId!;
      if (!currentKingId) {
        currentKingId = winner;
        consecutiveWins = 1;
      } else if (winner === currentKingId) {
        consecutiveWins++;
      } else {
        reignHistory.push({ kingId: currentKingId, wins: consecutiveWins });
        currentKingId = winner;
        consecutiveWins = 1;
      }
    }

    const king = participants.find((p) => p.id === currentKingId);

    // Próximo desafiante: scheduled match com rei envolvido, ou qualquer pending
    const nextMatch = liveMatches.find(
      (m) =>
        (m.status === "in_progress" || m.status === "scheduled") &&
        m.participantAId &&
        m.participantBId,
    );
    const challengerId =
      nextMatch && currentKingId
        ? nextMatch.participantAId === currentKingId
          ? nextMatch.participantBId
          : nextMatch.participantAId
        : null;
    const challenger = participants.find((p) => p.id === challengerId);

    return { king, challenger, reigns: consecutiveWins, history: reignHistory };
  }, [liveMatches, participants]);

  // Animação de brilho pulsante no rei
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setPulse((v) => !v), 2500);
    return () => clearInterval(t);
  }, []);

  const totalMatches = liveMatches.filter((m) => m.status === "finished").length;

  return (
    <div
      className="arena dark flex min-h-screen flex-col items-center justify-center overflow-hidden"
      style={{ background: "var(--arena-bg-1)" }}
    >
      {/* Ambient */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 50%, color-mix(in srgb,var(--arena-primary) 10%,transparent) 0%,transparent 70%)",
        }}
        aria-hidden
      />

      {/* Nome do torneio */}
      <p className="relative z-10 mb-8 text-sm font-semibold uppercase tracking-widest text-white/30">
        {tournamentName}
      </p>

      {king ? (
        <>
          {/* Trono do Rei */}
          <div className="relative z-10 flex flex-col items-center gap-6">
            {/* Ícone + reinos */}
            <div className="flex flex-col items-center gap-3">
              <div
                className="relative flex h-28 w-28 items-center justify-center rounded-3xl transition-all duration-1000"
                style={{
                  background: "color-mix(in srgb,var(--arena-primary) 20%,transparent)",
                  border: "2px solid color-mix(in srgb,var(--arena-primary) 40%,transparent)",
                  boxShadow: pulse
                    ? "0 0 60px color-mix(in srgb,var(--arena-primary) 50%,transparent)"
                    : "0 0 20px color-mix(in srgb,var(--arena-primary) 20%,transparent)",
                }}
              >
                <Crown
                  className="h-16 w-16 transition-all duration-1000"
                  style={{
                    color: "var(--arena-primary)",
                    filter: pulse ? "drop-shadow(0 0 12px var(--arena-primary))" : "none",
                  }}
                />
                {reigns >= 3 && (
                  <div className="absolute -right-2 -top-2">
                    <Flame className="h-6 w-6 text-orange-400" />
                  </div>
                )}
              </div>

              <div className="text-center">
                <p
                  className="text-5xl font-black tracking-tight text-white"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {participantName(king)}
                </p>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <Trophy className="h-4 w-4" style={{ color: "var(--arena-primary)" }} />
                  <p className="text-lg font-bold tabular-nums" style={{ color: "var(--arena-primary)" }}>
                    {reigns} {reigns === 1 ? "reinado" : "reinados"} consecutivos
                  </p>
                </div>
              </div>
            </div>

            {/* VS Challenger */}
            {challenger && (
              <div className="flex items-center gap-6 rounded-2xl border border-white/10 bg-white/5 px-8 py-5 backdrop-blur-md">
                <p className="text-sm text-white/40">PRÓXIMO DESAFIO</p>
                <div className="flex items-center gap-3">
                  <Sword className="h-5 w-5 text-white/40" />
                  <p className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
                    {participantName(challenger)}
                  </p>
                </div>
              </div>
            )}

            {/* Histórico de reinados */}
            {history.length > 0 && (
              <div className="mt-4 flex items-center gap-3">
                {history.slice(-5).map((h, i) => {
                  const p = participants.find((pt) => pt.id === h.kingId);
                  return (
                    <div
                      key={i}
                      className="flex flex-col items-center gap-1 opacity-40"
                    >
                      <Crown className="h-3 w-3 text-white" />
                      <p className="max-w-[72px] truncate text-center text-[10px] text-white">
                        {participantName(p)}
                      </p>
                      <p className="text-[10px] tabular-nums text-white/50">×{h.wins}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Contador total */}
          <p className="relative z-10 mt-12 text-sm tabular-nums text-white/20">
            {totalMatches} partidas jogadas
          </p>
        </>
      ) : (
        <div className="relative z-10 flex flex-col items-center gap-4 text-center">
          <Crown className="h-20 w-20 text-white/20" />
          <p className="text-3xl font-bold text-white/40" style={{ fontFamily: "var(--font-display)" }}>
            Aguardando primeiro desafio
          </p>
        </div>
      )}
    </div>
  );
}
