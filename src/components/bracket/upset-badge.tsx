"use client";

import { motion, useReducedMotion } from "motion/react";

interface UpsetBadgeProps {
  winnerName: string;
}

export function UpsetBadge({ winnerName }: UpsetBadgeProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial={reduced ? false : { scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{
        background: "color-mix(in srgb,#f5a524 15%,transparent)",
        border: "1px solid color-mix(in srgb,#f5a524 35%,transparent)",
        color: "#f5a524",
      }}
    >
      <span>🔥</span>
      ZEBRA
      <span className="ml-0.5 text-white/50 font-normal normal-case tracking-normal">
        {winnerName} eliminou o favorito
      </span>
    </motion.div>
  );
}
