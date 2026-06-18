import { StatusPill } from "@/components/arena/status-pill";
import { Clock } from "lucide-react";

const roundLabel = (round: number): string => {
  // round=1 → Final, round=2 → Semifinal, etc.
  const fromFinal = round - 1;
  if (fromFinal === 0) return "Final";
  if (fromFinal === 1) return "Semifinal";
  if (fromFinal === 2) return "Quartas de Final";
  if (fromFinal === 3) return "Oitavas de Final";
  return `Rodada ${round}`;
};

interface RoundHeaderProps {
  round: number;
  totalRounds?: number;
  deadlineAt?: string | null;
  activeMatchCount?: number;
}

export function RoundHeader({ round, deadlineAt, activeMatchCount }: RoundHeaderProps) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span
        className="text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: "var(--arena-muted)" }}
      >
        {roundLabel(round)}
      </span>
      {activeMatchCount != null && activeMatchCount > 0 && (
        <StatusPill kind="active" label={`${activeMatchCount} em jogo`} pulse />
      )}
      {deadlineAt && (
        <span
          className="flex items-center gap-1 text-[10px]"
          style={{ color: "var(--state-scheduled)" }}
        >
          <Clock className="h-3 w-3" />
          {new Date(deadlineAt).toLocaleDateString("pt-BR")}
        </span>
      )}
    </div>
  );
}
