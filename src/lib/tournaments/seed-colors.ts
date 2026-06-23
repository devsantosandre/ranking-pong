export const SEED_COLORS = [
  { bg: "rgba(164,33,210,0.13)", color: "#a421d2", border: "rgba(164,33,210,0.25)" },
  { bg: "rgba(8,145,178,0.13)",  color: "#0891b2", border: "rgba(8,145,178,0.25)" },
  { bg: "rgba(5,150,105,0.13)",  color: "#059669", border: "rgba(5,150,105,0.25)" },
  { bg: "rgba(217,119,6,0.13)",  color: "#d97706", border: "rgba(217,119,6,0.25)" },
  { bg: "rgba(220,38,38,0.13)",  color: "#dc2626", border: "rgba(220,38,38,0.25)" },
  { bg: "rgba(99,102,241,0.13)", color: "#6366f1", border: "rgba(99,102,241,0.25)" },
  { bg: "rgba(236,72,153,0.13)", color: "#ec4899", border: "rgba(236,72,153,0.25)" },
  { bg: "rgba(20,184,166,0.13)", color: "#14b8a6", border: "rgba(20,184,166,0.25)" },
] as const;

export function getSeedColor(seed: number | null | undefined) {
  const idx = Math.max(0, ((seed ?? 1) - 1)) % SEED_COLORS.length;
  return SEED_COLORS[idx]!;
}
