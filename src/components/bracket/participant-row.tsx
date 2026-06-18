import { cn } from "@/lib/utils";

export type ParticipantVariant = "win" | "lose" | "pending" | "tbd" | "walkover";

interface ParticipantRowProps {
  seed?: number | null;
  flag?: string | null;
  name: string;
  score?: number | null;
  variant?: ParticipantVariant;
  isHighlighted?: boolean;
}

const variantClasses: Record<ParticipantVariant, { row: string; score: string; name: string }> = {
  win: {
    row: "bg-[color-mix(in_srgb,var(--state-played)_8%,transparent)]",
    score: "text-(--state-played) font-bold",
    name: "text-(--arena-foreground) font-semibold",
  },
  lose: {
    row: "opacity-55",
    score: "text-(--arena-muted)",
    name: "text-(--arena-muted)",
  },
  pending: {
    row: "",
    score: "text-(--arena-foreground)",
    name: "text-(--arena-foreground)",
  },
  tbd: {
    row: "opacity-40",
    score: "text-(--state-tbd)",
    name: "text-(--state-tbd) italic",
  },
  walkover: {
    row: "",
    score: "text-(--state-noshow)",
    name: "text-(--arena-foreground)",
  },
};

export function ParticipantRow({
  seed,
  flag,
  name,
  score,
  variant = "pending",
  isHighlighted,
}: ParticipantRowProps) {
  const cls = variantClasses[variant];

  return (
    <div
      className={cn(
        "flex h-[38px] items-center gap-2 px-2",
        cls.row,
        isHighlighted && "animate-arena-glow-pulse",
      )}
    >
      {seed != null && (
        <span
          className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-sm text-[10px] font-bold"
          style={{
            background: "color-mix(in srgb,var(--arena-primary) 15%,transparent)",
            color: "var(--arena-primary)",
          }}
        >
          {seed}
        </span>
      )}

      {flag && (
        <span
          className={`fi fi-${flag.toLowerCase()} shrink-0 text-base`}
          aria-hidden
        />
      )}

      <span className={cn("flex-1 truncate text-[13px]", cls.name)}>
        {name || "A definir"}
      </span>

      {score != null && (
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded text-sm tabular-nums",
            cls.score,
            "bg-[color-mix(in_srgb,#fff_5%,transparent)]",
          )}
        >
          {score}
        </span>
      )}
    </div>
  );
}
