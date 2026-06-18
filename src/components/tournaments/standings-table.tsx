"use client";

import { motion } from "motion/react";
import type { GroupStanding, TournamentParticipant } from "@/lib/tournaments/types";
import { cn } from "@/lib/utils";

interface StandingsTableProps {
  standings: GroupStanding[];
  participants: TournamentParticipant[];
  qualifyingSpots?: number;
}

function getParticipantName(participantId: string, participants: TournamentParticipant[]): string {
  const p = participants.find((p) => p.id === participantId);
  return p?.guestName ?? `Jogador ${p?.seed ?? "?"}`;
}

function getParticipantFlag(participantId: string, participants: TournamentParticipant[]): string | null {
  return participants.find((p) => p.id === participantId)?.flag ?? null;
}

export function StandingsTable({
  standings,
  participants,
  qualifyingSpots = 2,
}: StandingsTableProps) {
  if (standings.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-white/40">
        Nenhuma partida de grupo registrada ainda
      </p>
    );
  }

  // Agrupar por grupo
  const byGroup = new Map<string, GroupStanding[]>();
  for (const row of standings) {
    const list = byGroup.get(row.groupId) ?? [];
    list.push(row);
    byGroup.set(row.groupId, list);
  }
  const groups = Array.from(byGroup.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="flex flex-col gap-4">
      {groups.map(([groupId, rows], gi) => (
        <div key={groupId} className="glass overflow-hidden rounded-2xl">
          {/* Cabeçalho do grupo */}
          <div
            className="flex items-center justify-between border-b border-white/8 px-4 py-2.5"
            style={{ background: "color-mix(in srgb,var(--arena-primary) 8%,transparent)" }}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/60">
              Grupo {String.fromCharCode(65 + gi)}
            </p>
            <div className="flex gap-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">
              <span className="w-6 text-center">J</span>
              <span className="w-6 text-center">V</span>
              <span className="w-6 text-center">D</span>
              <span className="w-8 text-center">Sets</span>
              <span className="w-6 text-center">Pts</span>
            </div>
          </div>

          {/* Linhas */}
          {rows.map((row, i) => {
            const isQualifying = row.position <= qualifyingSpots;
            const name = getParticipantName(row.participantId, participants);
            const flag = getParticipantFlag(row.participantId, participants);

            return (
              <motion.div
                key={row.participantId}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={cn(
                  "flex items-center gap-3 border-b border-white/5 px-4 py-2.5 last:border-0 transition-colors",
                  isQualifying && "bg-[color-mix(in_srgb,var(--state-played)_5%,transparent)]",
                )}
              >
                {/* Posição */}
                <div
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold",
                    isQualifying
                      ? "text-(--state-played) bg-[color-mix(in_srgb,var(--state-played)_15%,transparent)]"
                      : "text-white/40 bg-white/5",
                  )}
                >
                  {row.position}
                </div>

                {/* Jogador */}
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {flag && <span className={`fi fi-${flag.toLowerCase()} text-sm`} aria-hidden />}
                  <span
                    className={cn(
                      "truncate text-sm font-semibold",
                      isQualifying ? "text-white" : "text-white/60",
                    )}
                  >
                    {name}
                  </span>
                  {isQualifying && (
                    <span
                      className="shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                      style={{
                        background: "color-mix(in srgb,var(--state-played) 15%,transparent)",
                        color: "var(--state-played)",
                      }}
                    >
                      Q
                    </span>
                  )}
                </div>

                {/* Stats */}
                <div className="flex gap-3 text-xs tabular-nums text-white/40">
                  <span className="w-6 text-center">{row.wins + row.losses}</span>
                  <span className="w-6 text-center text-(--state-played)">{row.wins}</span>
                  <span className="w-6 text-center text-(--state-noshow)">{row.losses}</span>
                  <span className="w-8 text-center">
                    {row.setsWon}-{row.setsLost}
                  </span>
                  <span className="w-6 text-center font-bold text-white/70">{row.points}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
