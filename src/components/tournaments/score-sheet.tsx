"use client";

import { useState, useTransition } from "react";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { reportResult, revertResult } from "@/app/actions/tournaments";
import type { TournamentMatch, TournamentParticipant } from "@/lib/tournaments/types";
import { getSeedColor } from "@/lib/tournaments/seed-colors";
import { ChevronRight, Minus, Plus, RotateCcw, Undo2 } from "lucide-react";

interface ScoreSheetProps {
  match: TournamentMatch;
  participants: TournamentParticipant[];
  tournamentId: string;
  bestOf: number;
  readOnly?: boolean;
  onClose?: () => void;
}

function findParticipant(participants: TournamentParticipant[], id: string | null) {
  return participants.find((p) => p.id === id);
}

export function ScoreSheet({ match, participants, tournamentId, bestOf, readOnly = false, onClose }: ScoreSheetProps) {
  const winsNeeded = Math.ceil(bestOf / 2);

  // Fase de grupos captura o placar de cada set (para o desempate ITTF). Mata-mata não.
  const captureSets = match.bracket === "group";

  const [scoreA, setScoreA] = useState(match.scoreA ?? 0);
  const [scoreB, setScoreB] = useState(match.scoreB ?? 0);
  const [setScores, setSetScores] = useState<Array<[number, number]>>(
    () => (match.sets ?? []).map(([a, b]) => [a, b] as [number, number]),
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [revertOpen, setRevertOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const partA = findParticipant(participants, match.participantAId);
  const partB = findParticipant(participants, match.participantBId);
  const nameA = partA?.guestName ?? "Jogador A";
  const nameB = partB?.guestName ?? "Jogador B";

  const colorA = getSeedColor(partA?.seed ?? 1);
  const colorB = getSeedColor(partB?.seed ?? 2);

  const winnerIsA = scoreA === winsNeeded;
  const winnerIsB = scoreB === winsNeeded;
  const totalSets = scoreA + scoreB;

  // Placar por set (fase de grupos): uma linha por set decidido.
  const setRows: Array<[number, number]> = captureSets
    ? Array.from({ length: totalSets }, (_, i) => setScores[i] ?? ([0, 0] as [number, number]))
    : [];
  function updateSet(index: number, side: 0 | 1, value: number) {
    setSetScores((prev) => {
      const next = Array.from({ length: totalSets }, (_, i) => prev[i] ?? ([0, 0] as [number, number]));
      const pair: [number, number] = [...next[index]!];
      pair[side] = Math.max(0, value);
      next[index] = pair;
      return next;
    });
  }
  const setPointsValid = ([a, b]: [number, number]) => {
    const hi = Math.max(a, b);
    const lo = Math.min(a, b);
    return a !== b && hi >= 11 && hi - lo >= 2;
  };
  const setAWins = setRows.filter(([a, b]) => a > b).length;
  const setBWins = setRows.filter(([a, b]) => b > a).length;
  const setsOk =
    !captureSets ||
    (totalSets > 0 && setRows.every(setPointsValid) && setAWins === scoreA && setBWins === scoreB);

  // Só é possível lançar placar com os dois jogadores definidos.
  const hasBothPlayers = !!match.participantAId && !!match.participantBId;
  const validResult =
    hasBothPlayers &&
    totalSets <= bestOf &&
    (winnerIsA || winnerIsB) &&
    !(winnerIsA && winnerIsB) &&
    setsOk;

  // Edição: partida já finalizada sendo corrigida.
  const isEditing = match.status === "finished";
  const newWinnerId = winnerIsA ? match.participantAId : winnerIsB ? match.participantBId : null;
  const winnerChanges = isEditing && newWinnerId !== null && match.winnerParticipantId !== newWinnerId;

  function handleConfirm() {
    setActionError(null);
    startTransition(async () => {
      const result = await reportResult(match.id, {
        scoreA,
        scoreB,
        ...(captureSets ? { sets: setRows } : {}),
      });
      setConfirmOpen(false);
      if (result.error) {
        setActionError(result.error);
      } else {
        onClose?.();
      }
    });
  }

  function handleRevert() {
    setActionError(null);
    startTransition(async () => {
      const result = await revertResult(match.id, tournamentId);
      setRevertOpen(false);
      if (result.error) {
        setActionError(result.error);
      } else {
        onClose?.();
      }
    });
  }

  // Há fases seguintes que serão recalculadas ao desfazer?
  const hasDownstream = match.nextMatchId !== null && match.winnerParticipantId !== null;

  return (
    <>
      <div className="flex flex-col gap-5">
        {/* Aviso: torneio encerrado */}
        {readOnly && (
          <div
            className="rounded-xl px-3 py-2.5 text-center text-xs font-semibold"
            style={{
              background: "color-mix(in srgb, var(--arena-muted) 10%, transparent)",
              color: "var(--arena-muted)",
              border: "1px solid color-mix(in srgb, var(--arena-muted) 20%, transparent)",
            }}
          >
            Torneio encerrado — apenas visualização. Reabra o torneio para editar.
          </div>
        )}

        {/* Erro de ação */}
        {actionError && (
          <div
            className="rounded-xl px-3 py-2.5 text-center text-xs font-semibold"
            style={{
              background: "color-mix(in srgb, var(--state-noshow) 12%, transparent)",
              color: "var(--state-noshow)",
            }}
          >
            {actionError}
          </div>
        )}

        {/* Aviso de edição */}
        {isEditing && !readOnly && (
          <div
            className="flex items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-bold"
            style={{
              background: "color-mix(in srgb, var(--state-scheduled) 12%, transparent)",
              color: "var(--state-scheduled)",
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Corrigindo um resultado já lançado
          </div>
        )}

        {/* Subtítulo */}
        <p
          className="text-center text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--arena-muted)" }}
        >
          Melhor de {bestOf} · {winsNeeded} sets para vencer
        </p>

        {/* Placar — dois jogadores */}
        <div className="flex items-stretch gap-3">
          <PlayerScore
            name={nameA}
            score={scoreA}
            seedColor={colorA}
            isWinner={winnerIsA}
            isLoser={winnerIsB}
            onIncrement={() => setScoreA((s) => Math.min(s + 1, winsNeeded))}
            onDecrement={() => setScoreA((s) => Math.max(s - 1, 0))}
            disabled={isPending}
          />

          {/* Divisor VS */}
          <div className="flex shrink-0 flex-col items-center justify-center gap-1">
            <span
              className="text-lg font-black"
              style={{ color: "color-mix(in srgb, var(--arena-foreground) 20%, transparent)" }}
            >
              ×
            </span>
          </div>

          <PlayerScore
            name={nameB}
            score={scoreB}
            seedColor={colorB}
            isWinner={winnerIsB}
            isLoser={winnerIsA}
            onIncrement={() => setScoreB((s) => Math.min(s + 1, winsNeeded))}
            onDecrement={() => setScoreB((s) => Math.max(s - 1, 0))}
            disabled={isPending}
          />
        </div>

        {/* Dots de sets */}
        <div className="flex items-center justify-center gap-1.5">
          {Array.from({ length: bestOf }).map((_, i) => {
            const filledA = i < scoreA;
            const filledB = i >= scoreA && i < scoreA + scoreB;
            return (
              <div
                key={i}
                className="h-2.5 w-2.5 rounded-full transition-all"
                style={{
                  background: filledA
                    ? colorA.color
                    : filledB
                      ? colorB.color
                      : "color-mix(in srgb, var(--arena-foreground) 10%, transparent)",
                  transform: (filledA || filledB) ? "scale(1.15)" : "scale(1)",
                }}
              />
            );
          })}
        </div>

        {/* Placar por set — fase de grupos (desempate ITTF) */}
        {captureSets && totalSets > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-center text-[11px] font-semibold uppercase tracking-wider text-(--arena-muted)">
              Pontos de cada set
            </p>
            {setRows.map((pair, i) => {
              const ok = setPointsValid(pair);
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-10 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-(--arena-muted)">
                    Set {i + 1}
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={pair[0]}
                    disabled={isPending || readOnly}
                    onChange={(e) => updateSet(i, 0, Number(e.target.value))}
                    className="w-full min-w-0 flex-1 rounded-lg px-2 py-1.5 text-center text-sm font-bold tabular-nums outline-none"
                    style={{
                      background: "color-mix(in srgb, var(--arena-foreground) 5%, var(--arena-bg-2))",
                      border: `1.5px solid ${pair[0] > pair[1] ? colorA.color : "color-mix(in srgb, var(--arena-foreground) 8%, transparent)"}`,
                      color: "var(--arena-foreground)",
                    }}
                    aria-label={`Pontos de ${nameA} no set ${i + 1}`}
                  />
                  <span className="text-xs text-(--arena-muted)">×</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={pair[1]}
                    disabled={isPending || readOnly}
                    onChange={(e) => updateSet(i, 1, Number(e.target.value))}
                    className="w-full min-w-0 flex-1 rounded-lg px-2 py-1.5 text-center text-sm font-bold tabular-nums outline-none"
                    style={{
                      background: "color-mix(in srgb, var(--arena-foreground) 5%, var(--arena-bg-2))",
                      border: `1.5px solid ${pair[1] > pair[0] ? colorB.color : "color-mix(in srgb, var(--arena-foreground) 8%, transparent)"}`,
                      color: "var(--arena-foreground)",
                    }}
                    aria-label={`Pontos de ${nameB} no set ${i + 1}`}
                  />
                  <span
                    className="w-3 shrink-0 text-center text-xs"
                    style={{ color: pair[0] === 0 && pair[1] === 0 ? "transparent" : ok ? "var(--state-played)" : "var(--state-noshow)" }}
                    aria-hidden
                  >
                    {ok ? "✓" : "!"}
                  </span>
                </div>
              );
            })}
            {!setsOk && (
              <p className="text-center text-[10px] text-(--state-noshow)">
                Cada set precisa de um vencedor com ≥ 11 pontos e vantagem de 2, e o total de sets deve bater com o placar.
              </p>
            )}
          </div>
        )}

        {/* Ações */}
        {!readOnly && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setScoreA(0); setScoreB(0); }}
            disabled={isPending || (scoreA === 0 && scoreB === 0)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: "color-mix(in srgb, var(--arena-foreground) 6%, transparent)",
              color: "var(--arena-muted)",
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Resetar
          </button>
          <button
            type="button"
            disabled={!validResult || isPending}
            onClick={() => setConfirmOpen(true)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold text-white transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: validResult ? "var(--arena-primary)" : "color-mix(in srgb, var(--arena-primary) 40%, transparent)",
              boxShadow: validResult ? "0 4px 14px color-mix(in srgb, var(--arena-primary) 35%, transparent)" : "none",
            }}
          >
            {isEditing ? "Salvar" : "Confirmar"} {scoreA}×{scoreB}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        )}

        {/* Desfazer — só quando a partida já foi lançada e torneio não encerrado */}
        {isEditing && !readOnly && (
          <button
            type="button"
            onClick={() => setRevertOpen(true)}
            disabled={isPending}
            className="flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition hover:opacity-90 disabled:opacity-40"
            style={{
              background: "color-mix(in srgb, var(--state-noshow) 8%, transparent)",
              color: "var(--state-noshow)",
            }}
          >
            <Undo2 className="h-3.5 w-3.5" />
            Desfazer partida (voltar para não jogada)
          </button>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        title={isEditing ? "Corrigir resultado" : "Confirmar resultado"}
        description={
          `${nameA} ${scoreA} × ${scoreB} ${nameB}.` +
          (winnerChanges
            ? " O vencedor mudou — as partidas seguintes que dependiam do resultado anterior serão recalculadas."
            : " O vencedor avançará automaticamente.")
        }
        confirmText={isEditing ? "Salvar correção" : "Salvar resultado"}
        variant={winnerChanges ? "danger" : "default"}
        loading={isPending}
      />

      <ConfirmModal
        isOpen={revertOpen}
        onClose={() => setRevertOpen(false)}
        onConfirm={handleRevert}
        title="Desfazer partida"
        description={
          `${nameA} × ${nameB} voltará a ficar como não jogada.` +
          (hasDownstream
            ? " As partidas seguintes que dependiam deste resultado também serão recalculadas."
            : "")
        }
        confirmText="Desfazer"
        variant="danger"
        loading={isPending}
      />
    </>
  );
}

interface PlayerScoreProps {
  name: string;
  score: number;
  seedColor: { bg: string; color: string; border: string };
  isWinner: boolean;
  isLoser: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
  disabled: boolean;
}

function PlayerScore({
  name,
  score,
  seedColor,
  isWinner,
  isLoser,
  onIncrement,
  onDecrement,
  disabled,
}: PlayerScoreProps) {
  return (
    <div
      className="flex flex-1 flex-col items-center gap-3 rounded-2xl p-3 transition-all"
      style={{
        background: isWinner
          ? `color-mix(in srgb, ${seedColor.color} 12%, var(--arena-bg-2))`
          : "color-mix(in srgb, var(--arena-foreground) 4%, var(--arena-bg-2))",
        border: isWinner
          ? `1.5px solid color-mix(in srgb, ${seedColor.color} 30%, transparent)`
          : "1.5px solid color-mix(in srgb, var(--arena-foreground) 8%, transparent)",
      }}
    >
      {/* Avatar */}
      <div
        className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold"
        style={{ background: seedColor.bg, color: seedColor.color, border: `1px solid ${seedColor.border}` }}
      >
        {name.slice(0, 2).toUpperCase()}
      </div>

      {/* Nome */}
      <p
        className="w-full truncate text-center text-xs font-semibold"
        style={{ color: isWinner ? seedColor.color : "var(--arena-foreground)" }}
      >
        {name}
      </p>

      {/* Score */}
      <p
        className="text-4xl font-black tabular-nums leading-none transition-all"
        style={{
          fontFamily: "var(--font-display)",
          color: isWinner ? seedColor.color : isLoser ? "color-mix(in srgb, var(--arena-foreground) 35%, transparent)" : "var(--arena-foreground)",
        }}
      >
        {score}
      </p>

      {/* Controles */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onDecrement}
          disabled={disabled || score === 0}
          className="flex h-8 w-8 items-center justify-center rounded-xl transition hover:opacity-90 disabled:opacity-30"
          style={{
            background: "color-mix(in srgb, var(--arena-foreground) 8%, transparent)",
            color: "var(--arena-muted)",
          }}
          aria-label="Diminuir"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onIncrement}
          disabled={disabled || isWinner}
          className="flex h-8 w-8 items-center justify-center rounded-xl text-white transition hover:opacity-90 disabled:opacity-30"
          style={{ background: seedColor.color }}
          aria-label="Aumentar"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
