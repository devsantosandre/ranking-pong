"use client";

import { ArenaShell } from "@/components/arena/arena-shell";
import { createEvent } from "@/app/actions/tournaments";
import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { Loader2, CalendarDays, AlertCircle } from "lucide-react";

const inputStyle = {
  background: "var(--glass-bg)",
  border: "1px solid var(--glass-border)",
  color: "var(--arena-foreground)",
} as const;

function focusRing(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = "color-mix(in srgb, var(--arena-primary) 50%, transparent)";
  e.currentTarget.style.boxShadow = "0 0 0 3px color-mix(in srgb, var(--arena-primary) 10%, transparent)";
}
function blurRing(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = "var(--glass-border)";
  e.currentTarget.style.boxShadow = "none";
}

export default function CriarEventoPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [venue, setVenue] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("O nome do evento é obrigatório."); return; }
    startTransition(async () => {
      try {
        const result = await createEvent({
          name: name.trim(),
          eventDate: eventDate || undefined,
          venue: venue.trim() || undefined,
        });
        if (result?.event?.id) router.push(`/admin/eventos/${result.event.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao criar evento.");
      }
    });
  }

  return (
    <ArenaShell title="Novo Evento" showBack>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <p className="rounded-2xl px-4 py-3 text-xs text-(--arena-muted)"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          Um evento agrupa várias <strong className="text-(--arena-foreground)">divisões</strong> rodando no mesmo dia
          (ex.: A/B/C por nível, ou Absoluto/Veteranos/Feminino). Cada divisão é uma competição completa e independente —
          você adiciona as divisões no próximo passo.
        </p>

        <div className="flex flex-col gap-2">
          <label htmlFor="ev-name" className="px-1 text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)">
            Nome do evento *
          </label>
          <input
            id="ev-name" type="text" placeholder="Ex: Rachão de Sábado"
            value={name} onChange={(e) => setName(e.target.value)}
            disabled={isPending} maxLength={100} autoFocus
            className="w-full rounded-2xl px-4 py-3 text-sm font-medium outline-none transition"
            style={inputStyle} onFocus={focusRing} onBlur={blurRing}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="ev-date" className="px-1 text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)">
            Data
          </label>
          <input
            id="ev-date" type="date"
            value={eventDate} onChange={(e) => setEventDate(e.target.value)}
            disabled={isPending}
            className="w-full rounded-2xl px-4 py-3 text-sm font-medium outline-none transition"
            style={inputStyle} onFocus={focusRing} onBlur={blurRing}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="ev-venue" className="px-1 text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)">
            Local (opcional)
          </label>
          <input
            id="ev-venue" type="text" placeholder="Ex: Escola de Tênis de Mesa"
            value={venue} onChange={(e) => setVenue(e.target.value)}
            disabled={isPending} maxLength={120}
            className="w-full rounded-2xl px-4 py-3 text-sm font-medium outline-none transition"
            style={inputStyle} onFocus={focusRing} onBlur={blurRing}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-2xl px-4 py-3"
            style={{
              background: "color-mix(in srgb, var(--state-noshow) 8%, transparent)",
              border: "1px solid color-mix(in srgb, var(--state-noshow) 25%, transparent)",
            }}>
            <AlertCircle className="h-4 w-4 shrink-0" style={{ color: "var(--state-noshow)" }} />
            <p className="text-sm" style={{ color: "var(--state-noshow)" }}>{error}</p>
          </div>
        )}

        <button
          type="submit" disabled={isPending || !name.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            background: "var(--arena-primary)",
            boxShadow: name.trim() ? "0 6px 20px color-mix(in srgb, var(--arena-primary) 35%, transparent)" : "none",
          }}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
          {isPending ? "Criando…" : "Criar evento"}
        </button>
      </form>
    </ArenaShell>
  );
}
