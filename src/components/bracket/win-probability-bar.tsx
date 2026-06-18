"use client";

import { motion, useReducedMotion } from "motion/react";

interface WinProbabilityBarProps {
  pA: number;
  nameA: string;
  nameB: string;
}

export function WinProbabilityBar({ pA, nameA, nameB }: WinProbabilityBarProps) {
  const reduced = useReducedMotion();
  const pB = 100 - pA;
  const aWins = pA >= 50;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[10px] font-semibold text-white/50">
        <span className={aWins ? "text-(--state-active)" : ""}>
          {nameA} {pA}%
        </span>
        <span className={!aWins ? "text-(--state-active)" : ""}>
          {pB}% {nameB}
        </span>
      </div>
      <div
        className="relative h-1.5 overflow-hidden rounded-full"
        style={{ background: "rgba(255,255,255,0.08)" }}
        aria-label={`Probabilidade: ${nameA} ${pA}%, ${nameB} ${pB}%`}
        role="meter"
        aria-valuenow={pA}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <motion.div
          className="absolute inset-y-0 left-0 origin-left rounded-full"
          style={{ background: "var(--state-active)" }}
          initial={{ scaleX: reduced ? pA / 100 : 0 }}
          animate={{ scaleX: pA / 100 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
