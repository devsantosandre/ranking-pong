"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { computeBracketLayout } from "@/lib/tournaments/bracket-layout";
import { BracketCanvas } from "@/components/bracket/bracket-canvas";
import { useRealtimeBracket } from "@/lib/realtime/use-realtime-bracket";
import { useTournamentBracket } from "@/lib/queries/use-tournaments";
import type { TournamentMatch, TournamentParticipant } from "@/lib/tournaments/types";
import { Trophy, Wifi, ZoomIn, ZoomOut, Maximize2, CheckCircle2, Clock } from "lucide-react";

const SCALE_STEP = 0.08;
const SCALE_MIN = 0.2;
const SCALE_MAX = 2.0;
const ANTI_BURNIN_PX = 3;
const ANTI_BURNIN_INTERVAL = 8000;

interface TvBracketViewProps {
  tournamentId: string;
  initialMatches: TournamentMatch[];
  initialParticipants: TournamentParticipant[];
  tournamentName: string;
  isActive: boolean;
}

export function TvBracketView({
  tournamentId,
  initialMatches,
  initialParticipants,
  tournamentName,
  isActive,
}: TvBracketViewProps) {
  const { data } = useTournamentBracket(tournamentId, { live: isActive });
  const liveMatches: TournamentMatch[] = (data?.matches ?? initialMatches) as TournamentMatch[];
  const participants: TournamentParticipant[] = (data?.participants ?? initialParticipants) as TournamentParticipant[];

  useRealtimeBracket(isActive ? tournamentId : "");

  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null); // null = auto-fit
  const [autoFit, setAutoFit] = useState(true);

  // Anti burn-in: drift offset
  const [burnOffset, setBurnOffset] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const t = setInterval(() => {
      setBurnOffset({
        x: (Math.floor(Math.random() * (ANTI_BURNIN_PX * 2 + 1)) - ANTI_BURNIN_PX),
        y: (Math.floor(Math.random() * (ANTI_BURNIN_PX * 2 + 1)) - ANTI_BURNIN_PX),
      });
    }, ANTI_BURNIN_INTERVAL);
    return () => clearInterval(t);
  }, []);

  const layout = useMemo(() => computeBracketLayout(liveMatches), [liveMatches]);

  // Calcular fit automático baseado no tamanho do container
  const computeFitScale = useCallback(() => {
    if (!containerRef.current || layout.totalWidth === 0 || layout.totalHeight === 0) return 1;
    const { clientWidth: cw, clientHeight: ch } = containerRef.current;
    const PADDING_TV = 48;
    const HEADER_H = 36; // round headers
    const fitW = (cw - PADDING_TV * 2) / layout.totalWidth;
    const fitH = (ch - PADDING_TV * 2 - HEADER_H) / layout.totalHeight;
    return Math.min(fitW, fitH, SCALE_MAX);
  }, [layout]);

  // Auto-fit ao redimensionar ou quando layout muda
  useEffect(() => {
    if (!autoFit) return;
    const update = () => setScale(computeFitScale());
    update();
    const obs = new ResizeObserver(update);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [autoFit, computeFitScale]);

  const currentScale = scale ?? computeFitScale();

  const zoomIn = () => {
    setAutoFit(false);
    setScale((s) => Math.min((s ?? computeFitScale()) + SCALE_STEP, SCALE_MAX));
  };
  const zoomOut = () => {
    setAutoFit(false);
    setScale((s) => Math.max((s ?? computeFitScale()) - SCALE_STEP, SCALE_MIN));
  };
  const resetFit = () => {
    setAutoFit(true);
    setScale(null);
  };

  // Métricas
  const knockoutMatches = liveMatches.filter((m) => m.bracket !== "group");
  const activeMatchCount = knockoutMatches.filter((m) => m.status === "in_progress").length;
  const finishedCount = knockoutMatches.filter((m) => m.status === "finished").length;

  // Ticker: últimas partidas finalizadas + próximas agendadas
  const tickerItems = useMemo(() => {
    const finished = [...liveMatches]
      .filter((m) => m.status === "finished" && m.winnerParticipantId)
      .slice(-5)
      .map((m) => {
        const winner = participants.find((p) => p.id === m.winnerParticipantId);
        const winnerName = winner?.guestName ?? `Jogador ${winner?.seed ?? "?"}`;
        return `✓ ${winnerName} venceu`;
      });

    const upcoming = liveMatches
      .filter((m) => m.status === "scheduled" && m.participantAId && m.participantBId)
      .slice(0, 3)
      .map((m) => {
        const pA = participants.find((p) => p.id === m.participantAId);
        const pB = participants.find((p) => p.id === m.participantBId);
        const nameA = pA?.guestName ?? `Jogador ${pA?.seed ?? "?"}`;
        const nameB = pB?.guestName ?? `Jogador ${pB?.seed ?? "?"}`;
        return `Próx: ${nameA} × ${nameB}`;
      });

    return [...finished, ...upcoming];
  }, [liveMatches, participants]);

  return (
    <div className="arena dark flex min-h-screen flex-col" style={{ background: "var(--arena-bg-1)" }}>
      {/* Ambient glow de fundo */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% -5%, color-mix(in srgb,var(--arena-primary) 15%,transparent) 0%,transparent 65%)",
        }}
        aria-hidden
      />
      {activeMatchCount > 0 && (
        <div
          className="pointer-events-none fixed inset-0 transition-opacity duration-1000"
          style={{
            background:
              "radial-gradient(ellipse 40% 30% at 50% 50%, color-mix(in srgb,var(--state-active) 6%,transparent) 0%,transparent 70%)",
          }}
          aria-hidden
        />
      )}

      {/* Header */}
      <header className="relative z-20 flex shrink-0 items-center justify-between border-b border-white/10 bg-black/30 px-6 py-3 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: "color-mix(in srgb,var(--arena-primary) 18%,transparent)" }}
          >
            <Trophy className="h-5 w-5" style={{ color: "var(--arena-primary)" }} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
              {tournamentName}
            </h1>
            <p className="text-[11px] text-white/40 tabular-nums">
              {finishedCount}/{knockoutMatches.length} partidas concluídas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Partidas em jogo */}
          {activeMatchCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--state-active)] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--state-active)]" />
              </span>
              <span className="text-sm font-bold tabular-nums text-[var(--state-active)]">
                {activeMatchCount} ao vivo
              </span>
            </div>
          )}

          {isActive && <Wifi className="h-4 w-4 text-white/30" />}

          {/* Controles de zoom */}
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              onClick={zoomOut}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"
              title="Diminuir"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={resetFit}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"
              title="Ajustar à tela"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={zoomIn}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"
              title="Ampliar"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>
          <span className="min-w-[3rem] text-right text-xs tabular-nums text-white/30">
            {Math.round(currentScale * 100)}%
          </span>
        </div>
      </header>

      {/* Bracket — área principal */}
      <main
        ref={containerRef}
        className="relative z-10 flex-1 overflow-hidden"
        style={{ transition: "background 1s" }}
      >
        <div
          style={{
            transform: `scale(${currentScale}) translate(${burnOffset.x}px, ${burnOffset.y}px)`,
            transformOrigin: "top left",
            transition: "transform 8s linear",
            width: layout.totalWidth > 0 ? layout.totalWidth + 96 : "100%",
          }}
        >
          <BracketCanvas
            matches={liveMatches}
            participants={participants}
            live={isActive}
            showProbability={false}
          />
        </div>
      </main>

      {/* Ticker inferior */}
      {tickerItems.length > 0 && (
        <footer className="relative z-20 shrink-0 overflow-hidden border-t border-white/10 bg-black/40 backdrop-blur-md">
          <div className="flex items-center gap-0 py-2">
            <div
              className="shrink-0 flex items-center gap-2 px-4 text-[11px] font-bold uppercase tracking-widest"
              style={{ color: "var(--arena-primary)" }}
            >
              <Clock className="h-3 w-3" />
              Resultados
            </div>
            <div className="relative flex-1 overflow-hidden">
              <div
                className="flex animate-tv-ticker gap-8 whitespace-nowrap text-[11px] text-white/50"
                style={{ animationDuration: `${Math.max(12, tickerItems.length * 6)}s` }}
              >
                {[...tickerItems, ...tickerItems].map((item, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 shrink-0 text-white/20" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
