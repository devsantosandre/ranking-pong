"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import confetti from "canvas-confetti";

interface ChampionCelebrationProps {
  championName: string;
  onDismiss?: () => void;
}

export function ChampionCelebration({ championName, onDismiss }: ChampionCelebrationProps) {
  const reduced = useReducedMotion();
  const firedRef = useRef(false);

  useEffect(() => {
    if (reduced || firedRef.current) return;
    firedRef.current = true;

    const burst = () => {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.55 },
        colors: ["#c04bff", "#22d3ee", "#f5a524", "#ffffff", "#2dd4a7"],
        startVelocity: 35,
        gravity: 0.8,
        scalar: 1.1,
        ticks: 180,
      });
    };

    // Timeline: pequeno delay → burst inicial → segundo burst
    const t1 = setTimeout(burst, 400);
    const t2 = setTimeout(burst, 900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [reduced]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onDismiss}
    >
      <motion.div
        initial={reduced ? {} : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 22, delay: 0.1 }}
        className="flex flex-col items-center gap-4 rounded-3xl border border-white/10 p-8 text-center"
        style={{
          background: "color-mix(in srgb,var(--arena-bg-2) 95%,transparent)",
          backdropFilter: "blur(24px)",
          maxWidth: 320,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <motion.div
          animate={reduced ? {} : { rotate: [0, -8, 8, -8, 0] }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="text-6xl"
          aria-hidden
        >
          🏆
        </motion.div>
        <div className="space-y-1">
          <p
            className="text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--state-scheduled)" }}
          >
            Campeão do torneio
          </p>
          <p
            className="text-2xl font-bold"
            style={{ color: "var(--arena-foreground)", fontFamily: "var(--font-display)" }}
          >
            {championName}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-2 rounded-full border border-white/10 px-5 py-2 text-sm font-semibold text-white/70 transition hover:border-white/25 hover:text-white"
        >
          Fechar
        </button>
      </motion.div>
    </motion.div>
  );
}
