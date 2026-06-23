"use client";

import Link from "next/link";
import { useEvent } from "@/lib/queries/use-events";
import { Home, LayoutGrid } from "lucide-react";

interface DivisionSwitcherProps {
  eventId: string;
  currentTournamentId: string;
  /** admin → /admin/torneios/[id] + link p/ hub. public → /torneios/[id]/chave + link p/ evento. */
  variant: "admin" | "public";
}

/**
 * Barra de troca rápida entre divisões de um mesmo evento.
 * Só renderiza quando o torneio pertence a um evento (eventId).
 */
export function DivisionSwitcher({ eventId, currentTournamentId, variant }: DivisionSwitcherProps) {
  const { data: event } = useEvent(eventId);
  if (!event || event.divisions.length <= 1) return null;

  const hubHref = variant === "admin" ? `/admin/eventos/${eventId}` : `/eventos/${eventId}`;
  const divHref = (id: string) =>
    variant === "admin" ? `/admin/torneios/${id}` : `/torneios/${id}/chave`;

  return (
    <div
      className="flex items-center gap-1.5 overflow-x-auto rounded-2xl p-1.5"
      style={{ background: "color-mix(in srgb, var(--arena-primary) 6%, transparent)" }}
    >
      <Link href={hubHref} className="shrink-0">
        <span
          className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition hover:opacity-80"
          style={{ background: "var(--glass-bg)", color: "var(--arena-muted)" }}
          title="Voltar ao torneio"
        >
          {variant === "admin" ? <Home className="h-3.5 w-3.5" /> : <LayoutGrid className="h-3.5 w-3.5" />}
        </span>
      </Link>
      {event.divisions.map((d) => {
        const active = d.id === currentTournamentId;
        return (
          <Link key={d.id} href={divHref(d.id)} className="shrink-0">
            <span
              className="flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-[11px] font-bold transition"
              style={active
                ? { background: "var(--glass-bg-strong)", color: "var(--arena-primary)", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }
                : { background: "transparent", color: "var(--arena-muted)" }}
            >
              {d.hasLiveMatch && (
                <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "var(--state-noshow)" }} />
              )}
              {d.divisionLabel ?? d.name}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
