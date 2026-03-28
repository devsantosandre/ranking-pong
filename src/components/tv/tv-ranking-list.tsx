"use client";

import { useRef, useEffect, useState, useCallback, type CSSProperties } from "react";
import {
  getPlayerStyle,
  getDivisionNumber,
  isTopThree,
} from "@/lib/divisions";
import type { RankingPlayerWithPosition } from "@/lib/hooks/use-realtime-ranking";

type PositionChange = "up" | "down" | "new" | null;
type PlayerSnapshot = {
  position: number;
  ratingAtual: number | null;
  vitorias: number | null;
  derrotas: number | null;
};

// Função para tocar som de vitória usando Web Audio API
function playVictorySound() {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

    // Criar oscilador para o som
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Configurar o som (tipo de onda e frequência)
    oscillator.type = "sine";

    // Sequência de notas para som de vitória
    const now = audioContext.currentTime;

    // Nota 1: C5
    oscillator.frequency.setValueAtTime(523.25, now);
    // Nota 2: E5
    oscillator.frequency.setValueAtTime(659.25, now + 0.1);
    // Nota 3: G5
    oscillator.frequency.setValueAtTime(783.99, now + 0.2);
    // Nota 4: C6 (final)
    oscillator.frequency.setValueAtTime(1046.50, now + 0.3);

    // Envelope de volume
    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    oscillator.start(now);
    oscillator.stop(now + 0.5);
  } catch {
    // Silenciosamente ignora se não conseguir tocar o som
  }
}

function buildSnapshot(players: RankingPlayerWithPosition[]) {
  const snapshot = new Map<string, PlayerSnapshot>();

  players.forEach((player) => {
    snapshot.set(player.id, {
      position: player.position,
      ratingAtual: player.rating_atual,
      vitorias: player.vitorias,
      derrotas: player.derrotas,
    });
  });

  return snapshot;
}

function hasRankingChanged(
  previousSnapshot: Map<string, PlayerSnapshot>,
  currentSnapshot: Map<string, PlayerSnapshot>
) {
  if (previousSnapshot.size !== currentSnapshot.size) {
    return true;
  }

  for (const [playerId, currentData] of currentSnapshot) {
    const previousData = previousSnapshot.get(playerId);
    if (!previousData) return true;

    if (
      previousData.position !== currentData.position ||
      previousData.ratingAtual !== currentData.ratingAtual ||
      previousData.vitorias !== currentData.vitorias ||
      previousData.derrotas !== currentData.derrotas
    ) {
      return true;
    }
  }

  return false;
}

function hasMatchDrivenStatsChange(
  previousSnapshot: Map<string, PlayerSnapshot>,
  currentSnapshot: Map<string, PlayerSnapshot>
) {
  for (const [playerId, currentData] of currentSnapshot) {
    const previousData = previousSnapshot.get(playerId);
    if (!previousData) continue;

    // Mudanças de vitórias/derrotas são o sinal de partida processada.
    if (
      previousData.vitorias !== currentData.vitorias ||
      previousData.derrotas !== currentData.derrotas
    ) {
      return true;
    }
  }

  return false;
}

function getPositionChanges(
  players: RankingPlayerWithPosition[],
  previousSnapshot: Map<string, PlayerSnapshot>
) {
  const changes = new Map<string, PositionChange>();

  players.forEach((player) => {
    const previousData = previousSnapshot.get(player.id);

    if (!previousData) {
      if (previousSnapshot.size > 0) {
        changes.set(player.id, "new");
      }
      return;
    }

    if (player.position < previousData.position) {
      changes.set(player.id, "up");
      return;
    }

    if (player.position > previousData.position) {
      changes.set(player.id, "down");
    }
  });

  return changes;
}

interface TvRankingListProps {
  players: RankingPlayerWithPosition[];
  viewMode: "grid" | "table";
  soundEnabled?: boolean;
  densityScale?: number;
  focusPlayerIds?: string[];
}

export function TvRankingList({
  players,
  viewMode,
  soundEnabled = true,
  densityScale = 1,
  focusPlayerIds,
}: TvRankingListProps) {
  const previousSnapshotRef = useRef<Map<string, PlayerSnapshot> | null>(null);
  const [positionChanges, setPositionChanges] = useState<Map<string, PositionChange>>(
    () => new Map()
  );
  const focusPlayerSetRef = useRef<Set<string>>(new Set(focusPlayerIds || []));
  const densityStyle = {
    "--tv-density-scale": densityScale,
  } as CSSProperties;
  const applyPositionChanges = useCallback(
    (changes: Map<string, PositionChange>) => {
      setPositionChanges(changes);
    },
    []
  );

  useEffect(() => {
    focusPlayerSetRef.current = new Set(focusPlayerIds || []);
  }, [focusPlayerIds]);

  useEffect(() => {
    const currentSnapshot = buildSnapshot(players);
    const previousSnapshot = previousSnapshotRef.current;

    if (!previousSnapshot) {
      previousSnapshotRef.current = currentSnapshot;
      return;
    }

    if (!hasRankingChanged(previousSnapshot, currentSnapshot)) {
      return;
    }

    // Ignora atualizações que não sejam de partida (evita animações "do nada").
    if (!hasMatchDrivenStatsChange(previousSnapshot, currentSnapshot)) {
      previousSnapshotRef.current = currentSnapshot;
      return;
    }

    const nextChanges = getPositionChanges(players, previousSnapshot);
    const focusPlayerSet = focusPlayerSetRef.current;
    const filteredChanges =
      focusPlayerSet.size > 0
        ? new Map(
            Array.from(nextChanges.entries()).filter(([playerId]) =>
              focusPlayerSet.has(playerId)
            )
          )
        : nextChanges;

    if (filteredChanges.size > 0 && soundEnabled) {
      playVictorySound();
    }

    previousSnapshotRef.current = currentSnapshot;
    const updateTimer = setTimeout(() => {
      applyPositionChanges(filteredChanges);
    }, 0);

    return () => {
      clearTimeout(updateTimer);
    };
  }, [players, soundEnabled, applyPositionChanges]);

  if (viewMode === "table") {
    return (
      <div className="tv-ranking-root" style={densityStyle}>
        <TableView players={players} positionChanges={positionChanges} />
      </div>
    );
  }

  return (
    <div className="tv-ranking-root" style={densityStyle}>
      <GridView players={players} positionChanges={positionChanges} />
    </div>
  );
}

// Grid View Component - Vertical ordering (column-first)
// Estilo igual ao /ranking
function GridView({
  players,
  positionChanges
}: {
  players: RankingPlayerWithPosition[];
  positionChanges: Map<string, PositionChange>;
}) {
  return (
    <div className="tv-ranking-grid-vertical">
      {players.map((player) => {
        const playerStyle = getPlayerStyle(player.position);
        const divisionNumber = getDivisionNumber(player.position);
        const isTop3 = isTopThree(player.position);
        const change = positionChanges.get(player.id);

        const animationClass =
          change === "up"
            ? "animate-tv-slide-up"
            : change === "down"
              ? "animate-tv-slide-down"
              : change === "new"
                ? "animate-tv-highlight"
                : "";

        return (
          <article
            key={player.id}
            className={`
              tv-ranking-item
              tv-ranking-card
              flex items-center justify-between border shadow-sm
              ${playerStyle.border} ${playerStyle.bg}
              ${animationClass}
              transition-all duration-300
            `}
          >
            <div className="tv-ranking-card-main flex items-center">
              {/* Badge com posição */}
              <div
                className={`
                  tv-ranking-position-badge
                  relative flex items-center justify-center rounded-full
                  ${playerStyle.badge}
                  ${isTop3 ? "shadow-sm shadow-orange-500/40" : ""}
                `}
              >
                <span
                  className={`
                    tv-ranking-position-label relative font-bold
                    ${divisionNumber <= 3 || isTop3 ? "text-white drop-shadow" : "text-muted-foreground"}
                  `}
                >
                  {player.position}
                </span>
              </div>

              {/* Info do jogador */}
              <div className="min-w-0">
                <div className="tv-ranking-name-row flex items-center">
                  <p className={`tv-ranking-name truncate font-semibold ${playerStyle.text}`}>
                    {player.displayName}
                  </p>
                  {isTop3 && <span className="tv-ranking-top-icon">🔥</span>}
                  {change && <ChangeIndicator change={change} size="sm" />}
                </div>
                <p className="tv-ranking-stats text-muted-foreground">
                  <span className="text-green-600 font-semibold">{player.vitorias || 0}V</span>
                  {" / "}
                  <span className="text-red-500 font-semibold">{player.derrotas || 0}D</span>
                </p>
              </div>
            </div>

            {/* Pontuação */}
            <div className="text-right flex-shrink-0">
              <p className={`tv-ranking-points font-bold ${playerStyle.text}`}>
                {player.rating_atual ?? 250}
              </p>
              <p className="tv-ranking-points-label text-muted-foreground">pts</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}

// Table View Component - Compact rows
function TableView({
  players,
  positionChanges
}: {
  players: RankingPlayerWithPosition[];
  positionChanges: Map<string, PositionChange>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full tv-table">
        <thead>
          <tr className="border-b border-border/50 bg-muted/30">
            <th className="tv-table-th tv-table-col-position text-center">#</th>
            <th className="tv-table-th text-left">Jogador</th>
            <th className="tv-table-th tv-table-col-score text-center">V</th>
            <th className="tv-table-th tv-table-col-score text-center">D</th>
            <th className="tv-table-th tv-table-col-points text-right">Pts</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => {
            const playerStyle = getPlayerStyle(player.position);
            const isTop3 = isTopThree(player.position);
            const useWhitePositionText = player.position >= 4 && player.position <= 18;
            const change = positionChanges.get(player.id);

            const animationClass =
              change === "up"
                ? "animate-tv-slide-up"
                : change === "down"
                  ? "animate-tv-slide-down"
                  : change === "new"
                    ? "animate-tv-highlight"
                    : "";

            return (
              <tr
                key={player.id}
                className={`
                  tv-table-row
                  border-b border-border/20 last:border-b-0
                  ${isTop3 ? playerStyle.bg : "hover:bg-muted/10"}
                  ${animationClass}
                  transition-all duration-300
                `}
              >
                <td className="tv-table-td text-center">
                  <span
                    className={`
                      inline-flex items-center justify-center rounded-full font-bold
                      tv-table-position
                      ${playerStyle.badge}
                      ${isTop3 ? "shadow-sm shadow-orange-500/30" : ""}
                    `}
                  >
                    <span
                      className={
                        isTop3 || useWhitePositionText
                          ? "text-white drop-shadow-sm"
                          : "text-muted-foreground"
                      }
                    >
                      {player.position}
                    </span>
                  </span>
                </td>
                <td className="tv-table-td">
                  <div className="tv-table-name-row flex min-w-0 items-center">
                    <span className={`tv-table-name truncate font-medium ${playerStyle.text}`}>
                      {player.displayName}
                    </span>
                    {isTop3 && <span className="tv-table-top-icon text-orange-500 flex-shrink-0">🔥</span>}
                    {change && <ChangeIndicator change={change} size="sm" />}
                  </div>
                </td>
                <td className="tv-table-td text-center">
                  <span className="tv-table-value font-semibold text-green-600">
                    {player.vitorias || 0}
                  </span>
                </td>
                <td className="tv-table-td text-center">
                  <span className="tv-table-value font-semibold text-red-500">
                    {player.derrotas || 0}
                  </span>
                </td>
                <td className="tv-table-td text-right">
                  <span className={`tv-table-value font-bold ${playerStyle.text}`}>
                    {player.rating_atual ?? 250}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Change Indicator Component
function ChangeIndicator({ change, size = "md" }: { change: PositionChange; size?: "sm" | "md" }) {
  if (!change) return null;

  const sizeClasses = size === "sm" ? "tv-change-badge-sm" : "tv-change-badge-md";

  return (
    <span
      className={`
        tv-change-badge ${sizeClasses} flex-shrink-0 font-bold rounded inline-flex items-center justify-center
        ${change === "up" ? "bg-green-500/20 text-green-600" : ""}
        ${change === "down" ? "bg-red-500/20 text-red-600" : ""}
        ${change === "new" ? "bg-blue-500/20 text-blue-600" : ""}
      `}
    >
      {change === "up" && "▲"}
      {change === "down" && "▼"}
      {change === "new" && "N"}
    </span>
  );
}
