import { cn } from "@/lib/utils";
import { type HTMLAttributes, forwardRef } from "react";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "strong" | "elevated";
  glow?: "none" | "primary" | "active" | "scheduled" | "played";
  noPadding?: boolean;
}

const glowClasses: Record<NonNullable<GlassCardProps["glow"]>, string> = {
  none: "",
  primary: "glow-primary",
  active: "glow-active",
  scheduled: "glow-scheduled",
  played:
    "shadow-[0_0_0_1px_color-mix(in_srgb,var(--state-played)_30%,transparent),0_8px_32px_color-mix(in_srgb,var(--state-played)_15%,transparent)]",
};

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = "default", glow = "none", noPadding, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          variant === "strong" ? "glass-strong" : "glass",
          variant === "elevated" && "shadow-[0_4px_24px_rgba(120,0,200,0.12)]",
          glow !== "none" && glowClasses[glow],
          !noPadding && "p-4",
          "transition-all duration-200",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);

GlassCard.displayName = "GlassCard";
