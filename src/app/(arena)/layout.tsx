import { type ReactNode } from "react";

export default function ArenaLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="arena min-h-screen"
      style={{ background: "var(--arena-bg-1)" }}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
}
