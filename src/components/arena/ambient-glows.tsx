"use client";

import { cn } from "@/lib/utils";

interface AmbientGlowsProps {
  className?: string;
  intensity?: "low" | "medium" | "high";
}

export function AmbientGlows({ className, intensity = "medium" }: AmbientGlowsProps) {
  const opacityMap = { low: "opacity-20", medium: "opacity-30", high: "opacity-45" };

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-0 overflow-hidden",
        opacityMap[intensity],
        className,
      )}
      aria-hidden
    >
      {/* Blob roxo — canto superior esquerdo */}
      <div
        className="absolute -top-32 -left-24 h-[480px] w-[480px] rounded-full"
        style={{
          background: "radial-gradient(circle, #c04bff 0%, transparent 70%)",
          filter: "blur(72px)",
          animation: "arena-ambient-float 14s ease-in-out infinite",
          willChange: "transform",
        }}
      />
      {/* Blob ciano — canto inferior direito */}
      <div
        className="absolute -bottom-24 -right-20 h-[360px] w-[360px] rounded-full"
        style={{
          background: "radial-gradient(circle, #22d3ee 0%, transparent 70%)",
          filter: "blur(80px)",
          animation: "arena-ambient-float 18s ease-in-out infinite reverse",
          willChange: "transform",
        }}
      />
      {/* Blob roxo-escuro — centro */}
      <div
        className="absolute top-1/2 left-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)",
          filter: "blur(90px)",
          animation: "arena-ambient-float 22s ease-in-out infinite",
          willChange: "transform",
        }}
      />
    </div>
  );
}
