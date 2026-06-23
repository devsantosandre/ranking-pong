import type { Connector } from "@/lib/tournaments/types";

interface BracketConnectorsProps {
  connectors: Connector[];
  width: number;
  height: number;
}

export function BracketConnectors({ connectors, width, height }: BracketConnectorsProps) {
  if (connectors.length === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      width={width}
      height={height}
      style={{ overflow: "visible" }}
    >
      {connectors.map((c) => (
        <path
          key={`${c.fromId}-${c.toId}`}
          d={c.path}
          fill="none"
          stroke={
            c.active
              ? "color-mix(in srgb, var(--state-active) 50%, transparent)"
              : "rgba(255,255,255,0.12)"
          }
          strokeWidth={c.active ? 2 : 1.5}
          strokeLinecap="round"
          style={{
            strokeDasharray: 400,
            strokeDashoffset: 0,
            animation: "arena-connector-draw 0.5s ease both",
          }}
        />
      ))}
    </svg>
  );
}
