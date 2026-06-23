"use client";

import { useRef, useMemo, useCallback, useState } from "react";
import { computeBracketLayout } from "@/lib/tournaments/bracket-layout";
import type { TournamentMatch, TournamentParticipant } from "@/lib/tournaments/types";
import { MatchCard } from "./match-card";
import { BracketConnectors } from "./bracket-connectors";
import { RoundHeader } from "./round-header";

interface BracketCanvasProps {
  matches: TournamentMatch[];
  participants: TournamentParticipant[];
  ratings?: Map<string, number>;
  onMatchClick?: (match: TournamentMatch) => void;
  showProbability?: boolean;
  live?: boolean;
}

const CARD_W = 270;
const CARD_H = 84;
const COL_GAP = 120;
const HEADER_H = 36;
const PADDING = 24;

export function BracketCanvas({
  matches,
  participants,
  ratings,
  onMatchClick,
  showProbability = true,
  live,
}: BracketCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);

  const layout = useMemo(() => computeBracketLayout(matches), [matches]);

  const rounds = useMemo(() => {
    const map = new Map<number, TournamentMatch[]>();
    // Excluir partidas de grupo — só renderizar o mata-mata
    for (const m of matches.filter((m) => m.bracket !== "group")) {
      const list = map.get(m.round) ?? [];
      list.push(m);
      map.set(m.round, list);
    }
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
  }, [matches]);

  const totalRounds = rounds.length;
  const maxRound = rounds[0]?.[0] ?? 1;

  const canvasW = layout.totalWidth + PADDING * 2;
  const canvasH = layout.totalHeight + HEADER_H + PADDING * 2;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setIsPanning(true);
    panStart.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: containerRef.current.scrollLeft,
      scrollTop: containerRef.current.scrollTop,
    };
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning || !panStart.current || !containerRef.current) return;
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      containerRef.current.scrollLeft = panStart.current.scrollLeft - dx;
      containerRef.current.scrollTop = panStart.current.scrollTop - dy;
    },
    [isPanning],
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    panStart.current = null;
  }, []);

  if (matches.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center">
        <p className="text-sm" style={{ color: "var(--arena-muted)" }}>
          Chave não gerada ainda
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative overflow-auto"
      style={{ cursor: isPanning ? "grabbing" : "grab", WebkitOverflowScrolling: "touch" }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        className="relative"
        style={{ width: canvasW, height: canvasH, minWidth: canvasW }}
      >
        {/* Round headers */}
        {rounds.map(([round, roundMatches]) => {
          const x = (maxRound - round) * (CARD_W + COL_GAP) + PADDING;
          const activeCount = roundMatches.filter((m) => m.status === "in_progress").length;
          const deadline = roundMatches.find((m) => m.deadlineAt)?.deadlineAt;
          return (
            <div key={round} className="absolute top-0" style={{ left: x, width: CARD_W }}>
              <RoundHeader
                round={round}
                totalRounds={totalRounds}
                deadlineAt={deadline}
                activeMatchCount={activeCount}
              />
            </div>
          );
        })}

        {/* SVG connectors */}
        <div className="absolute" style={{ top: HEADER_H + PADDING, left: PADDING }}>
          <BracketConnectors
            connectors={layout.connectors}
            width={layout.totalWidth}
            height={layout.totalHeight}
          />
        </div>

        {/* Match cards */}
        {layout.matches.map((m) => (
          <div
            key={m.id}
            className="absolute"
            style={{ left: m.x + PADDING, top: m.y + HEADER_H + PADDING }}
          >
            <MatchCard
              match={m}
              participants={participants}
              ratings={ratings}
              onClick={onMatchClick}
              showProbability={showProbability}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
