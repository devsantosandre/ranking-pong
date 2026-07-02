"use client";

import { GlassCard } from "@/components/arena/glass-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createEventSignup } from "@/app/actions/tournaments";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, CheckCircle, AlertCircle, CheckSquare, Square, Clock, UserPlus } from "lucide-react";
import type { PaymentMode } from "@/lib/tournaments/types";

export interface SignupDivisionOption {
  id: string;
  label: string;
  levelDescription: string | null;
  startTime: string | null;
}

interface Props {
  eventId: string;
  divisions: SignupDivisionOption[];
  paymentMode: PaymentMode;
  prices?: Record<string, number>;
}

export function EventSignupForm({ eventId, divisions, paymentMode, prices }: Props) {
  const [isPending, startTransition] = useTransition();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [club, setClub] = useState("");
  const [cbtmRating, setCbtmRating] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [agreedRules, setAgreedRules] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const price = prices?.[String(selected.size)];

  function toggleDivision(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 2) next.add(id);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (selected.size < 1) { setError("Escolha ao menos 1 divisão."); return; }
    if (!agreedRules) { setError("É necessário concordar com as regras."); return; }
    const rating = cbtmRating.trim() ? Number(cbtmRating) : undefined;
    startTransition(async () => {
      const res = await createEventSignup(eventId, {
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        club: club.trim() || undefined,
        cbtmAffiliated: rating != null,
        cbtmRating: rating,
        divisions: [...selected],
        agreedRules,
        notes: notes.trim() || undefined,
      });
      if (res.error) { setError(res.error); return; }
      setDone(true);
    });
  }

  if (done) {
    const confirmedNow = paymentMode === "free";
    return (
      <GlassCard className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: "color-mix(in srgb, var(--state-played) 15%, transparent)" }}>
          <CheckCircle className="h-7 w-7" style={{ color: "var(--state-played)" }} />
        </div>
        <div className="space-y-1">
          <p className="text-base font-bold text-(--arena-foreground)">Inscrição recebida!</p>
          <p className="text-sm text-(--arena-muted)">
            {confirmedNow
              ? "Sua inscrição está confirmada. Nos vemos na mesa!"
              : "Assim que o pagamento for confirmado pela organização, sua vaga estará garantida."}
          </p>
        </div>
        <Link href={`/eventos/${eventId}`}>
          <span className="rounded-xl px-4 py-2 text-sm font-semibold text-(--arena-primary)"
            style={{ background: "color-mix(in srgb, var(--arena-primary) 12%, transparent)" }}>
            Voltar ao evento
          </span>
        </Link>
      </GlassCard>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <GlassCard className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">Nome completo *</Label>
          <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} disabled={isPending} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isPending} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone (com DDD)</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={isPending} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="club">Clube</Label>
            <Input id="club" value={club} onChange={(e) => setClub(e.target.value)} disabled={isPending} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rating">Rating CBTM (se filiado)</Label>
            <Input id="rating" type="number" inputMode="numeric" value={cbtmRating} onChange={(e) => setCbtmRating(e.target.value)} disabled={isPending} />
          </div>
        </div>
      </GlassCard>

      {/* Divisões (até 2) */}
      <div className="flex flex-col gap-2">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)">
          Escolha até 2 divisões
        </p>
        {divisions.map((d) => {
          const isSelected = selected.has(d.id);
          const disabled = isPending || (!isSelected && selected.size >= 2);
          return (
            <button key={d.id} type="button" onClick={() => toggleDivision(d.id)} disabled={disabled}
              className="w-full text-left disabled:opacity-50">
              <GlassCard noPadding className="flex items-center gap-3 px-3 py-3 transition-all hover:scale-[1.005]"
                style={isSelected ? { background: "color-mix(in srgb, var(--arena-primary) 10%, transparent)" } : undefined}>
                <span className="shrink-0" style={{ color: isSelected ? "var(--arena-primary)" : "var(--arena-muted)" }}>
                  {isSelected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-(--arena-foreground)">{d.label}</p>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-(--arena-muted)">
                    {d.levelDescription && <span>{d.levelDescription}</span>}
                    {d.startTime && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {d.startTime}</span>}
                  </span>
                </div>
              </GlassCard>
            </button>
          );
        })}
      </div>

      {/* Preço */}
      {price != null && (
        <p className="px-1 text-sm text-(--arena-muted)">
          Valor: <span className="font-bold text-(--arena-foreground)">R${price}</span>
          {paymentMode === "manual" && " — pagamento combinado com a organização."}
        </p>
      )}

      {/* Concordância */}
      <GlassCard noPadding className="px-3 py-3">
        <button type="button" onClick={() => setAgreedRules((v) => !v)} className="flex w-full items-center gap-3 text-left">
          <span className="shrink-0" style={{ color: agreedRules ? "var(--state-played)" : "var(--arena-muted)" }}>
            {agreedRules ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
          </span>
          <span className="text-sm text-(--arena-foreground)">Li e concordo com as regras do evento *</span>
        </button>
      </GlassCard>

      <div className="space-y-2">
        <Label htmlFor="notes">Observação (opcional)</Label>
        <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={isPending} />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl p-3 text-sm"
          style={{ background: "color-mix(in srgb, var(--state-noshow) 10%, transparent)", color: "var(--state-noshow)" }}>
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <button type="submit" disabled={isPending}
        className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-(--primary-foreground) transition hover:opacity-90 active:scale-[0.99] disabled:opacity-40"
        style={{ background: "var(--arena-primary)" }}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        Enviar inscrição
      </button>
    </form>
  );
}
