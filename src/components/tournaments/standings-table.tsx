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
      <p className="py-6 text-center text-sm text-(--arena-muted)">
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
      {groups.map(([groupId, rows], gi) => {
        // Pontos de vitória que empataram entre 2+ jogadores → a ordem entre eles
        // saiu do desempate oficial ITTF (razão de sets → razão de pontos de game).
        const pointsCount = new Map<number, number>();
        for (const r of rows) pointsCount.set(r.points, (pointsCount.get(r.points) ?? 0) + 1);
        const tiedPoints = new Set(Array.from(pointsCount.entries()).filter(([, c]) => c > 1).map(([p]) => p));

        return (
        <div
          key={groupId}
          className="glass overflow-hidden rounded-2xl"
          style={{ border: "1px solid var(--glass-border)" }}
        >
          {/* Cabeçalho do grupo */}
          <div
            className="flex items-center justify-between px-4 py-2.5"
            style={{
              background: "color-mix(in srgb,var(--arena-primary) 8%,transparent)",
              borderBottom: "1px solid var(--glass-border)",
            }}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest text-(--arena-primary)">
              Grupo {String.fromCharCode(65 + gi)}
            </p>
            <div className="flex gap-3 text-[10px] font-semibold uppercase tracking-widest text-(--arena-muted)">
              <span className="w-6 text-center">J</span>
              <span className="w-6 text-center">V</span>
              <span className="w-6 text-center">D</span>
              <span className="w-8 text-center">Sets</span>
              <span className="w-10 text-center" title="Pontos de game (ganhos–perdidos)">PG</span>
              <span className="w-6 text-center">Pts</span>
            </div>
          </div>

          {/* Linhas */}
          {rows.map((row, i) => {
            const isQualifying = row.position <= qualifyingSpots;
            const name = getParticipantName(row.participantId, participants);
            const flag = getParticipantFlag(row.participantId, participants);
            const tieBroken = tiedPoints.has(row.points);

            return (
              <motion.div
                key={row.participantId}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors"
                style={{
                  borderBottom: i < rows.length - 1 ? "1px solid var(--glass-border)" : "none",
                  background: isQualifying
                    ? "color-mix(in srgb,var(--state-played) 7%,transparent)"
                    : "transparent",
                }}
              >
                {/* Posição */}
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold"
                  style={
                    isQualifying
                      ? { color: "var(--state-played)", background: "color-mix(in srgb,var(--state-played) 15%,transparent)" }
                      : { color: "var(--arena-muted)", background: "color-mix(in srgb,var(--arena-foreground) 7%,transparent)" }
                  }
                >
                  {row.position}
                </div>

                {/* Jogador */}
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {flag && <span className={`fi fi-${flag.toLowerCase()} text-sm`} aria-hidden />}
                  <span
                    className={cn(
                      "truncate text-sm",
                      isQualifying ? "font-bold" : "font-semibold",
                    )}
                    style={{ color: isQualifying ? "var(--arena-foreground)" : "var(--arena-muted)" }}
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
                  {tieBroken && (
                    <span
                      className="shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                      style={{
                        background: "color-mix(in srgb,var(--state-scheduled) 15%,transparent)",
                        color: "var(--state-scheduled)",
                      }}
                      title="Empate em pontos — posição definida pelo desempate ITTF (razão de sets → razão de pontos de game)"
                    >
                      D
                    </span>
                  )}
                </div>

                {/* Stats */}
                <div className="flex gap-3 text-xs tabular-nums text-(--arena-muted)">
                  <span className="w-6 text-center">{row.wins + row.losses}</span>
                  <span className="w-6 text-center" style={{ color: "var(--state-played)" }}>{row.wins}</span>
                  <span className="w-6 text-center" style={{ color: "var(--state-noshow)" }}>{row.losses}</span>
                  <span className="w-8 text-center">
                    {row.setsWon}-{row.setsLost}
                  </span>
                  <span className="w-10 text-center">
                    {row.gamePointsWon}-{row.gamePointsLost}
                  </span>
                  <span className="w-6 text-center font-bold text-(--arena-foreground)">{row.points}</span>
                </div>
              </motion.div>
            );
          })}

          {/* Legenda: critério de desempate */}
          {tiedPoints.size > 0 && (
            <p
              className="px-4 py-2 text-[10px] leading-snug text-(--arena-muted)"
              style={{ borderTop: "1px solid var(--glass-border)" }}
            >
              <span className="font-bold text-(--state-scheduled)">D</span> = empate em pontos, posição definida
              pelo desempate ITTF (razão de sets → razão de pontos de game, só entre os empatados). PG = pontos de game.
            </p>
          )}
        </div>
        );
      })}
    </div>
  );
}
