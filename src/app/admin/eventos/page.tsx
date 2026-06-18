"use client";

import { ArenaShell } from "@/components/arena/arena-shell";
import { GlassCard } from "@/components/arena/glass-card";
import { useEvents } from "@/lib/queries/use-events";
import Link from "next/link";
import { CalendarDays, Plus, ChevronRight, Loader2, MapPin } from "lucide-react";

function formatDate(iso: string | null): string {
  if (!iso) return "Sem data";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export default function AdminEventosPage() {
  const { data: events, isLoading } = useEvents();

  return (
    <ArenaShell title="Eventos" subtitle="Admin" showBack>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)">
              Eventos com divisões
            </p>
            {!isLoading && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{
                  background: "color-mix(in srgb, var(--arena-primary) 12%, transparent)",
                  color: "var(--arena-primary)",
                }}
              >
                {events?.length ?? 0}
              </span>
            )}
          </div>
          <Link href="/admin/eventos/criar">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white transition hover:opacity-90 active:scale-95"
              style={{
                background: "var(--arena-primary)",
                boxShadow: "0 4px 12px color-mix(in srgb, var(--arena-primary) 30%, transparent)",
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Novo evento
            </button>
          </Link>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-(--arena-primary)" />
          </div>
        )}

        {!isLoading && (!events || events.length === 0) && (
          <GlassCard className="flex flex-col items-center gap-4 py-12 text-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: "color-mix(in srgb, var(--arena-primary) 12%, transparent)" }}
            >
              <CalendarDays className="h-7 w-7 text-(--arena-primary)" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-(--arena-foreground)">Nenhum evento criado</p>
              <p className="text-xs text-(--arena-muted)">
                Use eventos para rodar várias divisões (A/B/C, Absoluto/Veteranos…) no mesmo dia
              </p>
            </div>
            <Link href="/admin/eventos/criar">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
                style={{ background: "var(--arena-primary)" }}
              >
                <Plus className="h-4 w-4" />
                Criar primeiro evento
              </button>
            </Link>
          </GlassCard>
        )}

        {events && events.length > 0 && (
          <div className="flex flex-col gap-2">
            {events.map((ev) => (
              <Link key={ev.id} href={`/admin/eventos/${ev.id}`}>
                <GlassCard
                  noPadding
                  className="group flex items-center gap-3 px-3 py-3 transition-all hover:scale-[1.01]"
                >
                  <div
                    className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl"
                    style={{ background: "color-mix(in srgb, var(--arena-primary) 12%, transparent)" }}
                  >
                    <CalendarDays className="h-5 w-5 text-(--arena-primary)" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-bold text-(--arena-foreground)"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {ev.name}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-(--arena-muted)">
                      <span>{formatDate(ev.eventDate)}</span>
                      {ev.venue && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="h-3 w-3" /> {ev.venue}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-(--arena-muted) transition group-hover:translate-x-0.5" />
                </GlassCard>
              </Link>
            ))}
          </div>
        )}
      </div>
    </ArenaShell>
  );
}
