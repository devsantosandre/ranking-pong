"use client";

import { useState, useEffect } from "react";
import { useEvent } from "@/lib/queries/use-events";
import { useTournament } from "@/lib/queries/use-tournaments";
import { TvBracketView } from "./tv-bracket-view";
import { TvKingView } from "./tv-king-view";
import type { TournamentEventDetail } from "@/lib/tournaments/types";
import { Loader2, RotateCw } from "lucide-react";

interface TvEventViewProps {
  eventId: string;
  initialEvent: TournamentEventDetail;
  rotateSeconds: number;
}

export function TvEventView({ eventId, initialEvent, rotateSeconds }: TvEventViewProps) {
  const { data } = useEvent(eventId, { refetchInterval: 10_000 });
  const event = data ?? initialEvent;
  const divisions = event.divisions;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Divisão ativa derivada no render (sem effect): a selecionada, se ainda existir; senão a primeira.
  const activeId = selectedId && divisions.some((d) => d.id === selectedId)
    ? selectedId
    : (divisions[0]?.id ?? "");
  const setActiveId = setSelectedId;

  // Auto-rotação: prioriza divisões com jogo ao vivo; senão cicla todas.
  useEffect(() => {
    if (!rotateSeconds || divisions.length <= 1) return;
    const timer = setInterval(() => {
      setSelectedId((cur) => {
        const live = divisions.filter((d) => d.hasLiveMatch);
        const ring = live.length > 0 ? live : divisions;
        const idx = ring.findIndex((d) => d.id === cur);
        return (ring[(idx + 1) % ring.length] ?? ring[0])?.id ?? cur;
      });
    }, rotateSeconds * 1000);
    return () => clearInterval(timer);
  }, [rotateSeconds, divisions]);

  const active = divisions.find((d) => d.id === activeId);
  const { data: detail } = useTournament(activeId);

  return (
    <div className="relative min-h-screen bg-black">
      {/* Barra superior — seletor de divisão (overlay, estilo telão) */}
      <div
        className="fixed inset-x-0 top-0 z-50 flex items-center gap-3 px-5 py-2.5"
        style={{ background: "rgba(10,6,18,0.72)", backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <span className="shrink-0 text-sm font-black uppercase tracking-widest text-white/80" style={{ fontFamily: "var(--font-display)" }}>
          {event.name}
        </span>
        <div className="flex flex-1 items-center gap-1.5 overflow-x-auto">
          {divisions.map((d) => {
            const isActive = d.id === activeId;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setActiveId(d.id)}
                className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-bold transition"
                style={isActive
                  ? { background: "#fff", color: "#111" }
                  : { background: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.72)" }}
              >
                {d.hasLiveMatch && (
                  <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: "#f43f5e" }} />
                )}
                {d.divisionLabel ?? d.name}
              </button>
            );
          })}
        </div>
        {rotateSeconds > 0 && (
          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-white/55">
            <RotateCw className="h-3.5 w-3.5" /> {rotateSeconds}s
          </span>
        )}
      </div>

      {/* View da divisão ativa */}
      <div className="pt-[44px]">
        {!active || !detail ? (
          <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-white/60" />
          </div>
        ) : active.format === "king_of_table" ? (
          <TvKingView
            key={active.id}
            tournamentId={active.id}
            initialMatches={detail.matches}
            initialParticipants={detail.participants}
            tournamentName={active.divisionLabel ?? active.name}
            isActive={active.status === "active"}
          />
        ) : (
          <TvBracketView
            key={active.id}
            tournamentId={active.id}
            initialMatches={detail.matches}
            initialParticipants={detail.participants}
            tournamentName={active.divisionLabel ?? active.name}
            isActive={active.status === "active"}
          />
        )}
      </div>
    </div>
  );
}
