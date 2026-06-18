import { cn } from "@/lib/utils";
import { CheckCircle, Circle, Clock, Play, X } from "lucide-react";

export type StatusKind =
  | "active"
  | "scheduled"
  | "played"
  | "noshow"
  | "tbd"
  | "win"
  | "walkover"
  | "draft"
  | "registration"
  | "finished";

const config: Record<
  StatusKind,
  { label: string; color: string; bg: string; border: string; Icon: typeof Play }
> = {
  active: {
    label: "Ativo",
    color: "text-(--state-active)",
    bg: "bg-[color-mix(in_srgb,var(--state-active)_12%,transparent)]",
    border: "border-[color-mix(in_srgb,var(--state-active)_25%,transparent)]",
    Icon: Play,
  },
  scheduled: {
    label: "Agendado",
    color: "text-(--state-scheduled)",
    bg: "bg-[color-mix(in_srgb,var(--state-scheduled)_12%,transparent)]",
    border: "border-[color-mix(in_srgb,var(--state-scheduled)_25%,transparent)]",
    Icon: Clock,
  },
  played: {
    label: "Jogado",
    color: "text-(--state-played)",
    bg: "bg-[color-mix(in_srgb,var(--state-played)_12%,transparent)]",
    border: "border-[color-mix(in_srgb,var(--state-played)_25%,transparent)]",
    Icon: CheckCircle,
  },
  win: {
    label: "Vitória",
    color: "text-(--state-played)",
    bg: "bg-[color-mix(in_srgb,var(--state-played)_12%,transparent)]",
    border: "border-[color-mix(in_srgb,var(--state-played)_25%,transparent)]",
    Icon: CheckCircle,
  },
  noshow: {
    label: "No-show",
    color: "text-(--state-noshow)",
    bg: "bg-[color-mix(in_srgb,var(--state-noshow)_12%,transparent)]",
    border: "border-[color-mix(in_srgb,var(--state-noshow)_25%,transparent)]",
    Icon: X,
  },
  walkover: {
    label: "W/O",
    color: "text-(--state-noshow)",
    bg: "bg-[color-mix(in_srgb,var(--state-noshow)_12%,transparent)]",
    border: "border-[color-mix(in_srgb,var(--state-noshow)_25%,transparent)]",
    Icon: X,
  },
  tbd: {
    label: "Aguardando",
    color: "text-(--state-tbd)",
    bg: "bg-[color-mix(in_srgb,var(--state-tbd)_12%,transparent)]",
    border: "border-[color-mix(in_srgb,var(--state-tbd)_25%,transparent)]",
    Icon: Circle,
  },
  draft: {
    label: "Rascunho",
    color: "text-(--state-tbd)",
    bg: "bg-[color-mix(in_srgb,var(--state-tbd)_12%,transparent)]",
    border: "border-[color-mix(in_srgb,var(--state-tbd)_25%,transparent)]",
    Icon: Circle,
  },
  registration: {
    label: "Inscrições",
    color: "text-(--state-scheduled)",
    bg: "bg-[color-mix(in_srgb,var(--state-scheduled)_12%,transparent)]",
    border: "border-[color-mix(in_srgb,var(--state-scheduled)_25%,transparent)]",
    Icon: Clock,
  },
  finished: {
    label: "Encerrado",
    color: "text-(--state-played)",
    bg: "bg-[color-mix(in_srgb,var(--state-played)_8%,transparent)]",
    border: "border-[color-mix(in_srgb,var(--state-played)_20%,transparent)]",
    Icon: CheckCircle,
  },
};

interface StatusPillProps {
  kind: StatusKind;
  label?: string;
  size?: "sm" | "md";
  pulse?: boolean;
  className?: string;
}

export function StatusPill({ kind, label, size = "sm", pulse, className }: StatusPillProps) {
  const { label: defaultLabel, color, bg, border, Icon } = config[kind];
  const text = label ?? defaultLabel;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        bg,
        border,
        color,
        pulse && kind === "active" && "animate-arena-glow-pulse",
        className,
      )}
    >
      <Icon className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
      {text}
    </span>
  );
}
