"use client";

import { GlassCard } from "@/components/arena/glass-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateEventInfo, updateDivisionInfo } from "@/app/actions/tournaments";
import { eventKeys } from "@/lib/queries/use-events";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";
import type { EventInfo, PaymentMode, TournamentEventDetail } from "@/lib/tournaments/types";

export function EventInfoEditor({ event, onClose }: { event: TournamentEventDetail; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const info = event.info;
  const [description, setDescription] = useState(info?.description ?? "");
  const [deadline, setDeadline] = useState(info?.registrationDeadline ?? "");
  const [contactPhone, setContactPhone] = useState(info?.contactPhone ?? "");
  const [prizeInfo, setPrizeInfo] = useState(info?.prizeInfo ?? "");
  const [mode, setMode] = useState<PaymentMode>(info?.payment?.mode === "free" ? "free" : "manual");
  const [price1, setPrice1] = useState(info?.payment?.prices?.["1"]?.toString() ?? "");
  const [price2, setPrice2] = useState(info?.payment?.prices?.["2"]?.toString() ?? "");
  // Campos por divisão (horário/nível).
  const [divFields, setDivFields] = useState(
    () => new Map(event.divisions.map((d) => [d.id, { startTime: d.startTime ?? "", levelDescription: d.levelDescription ?? "" }])),
  );

  function setDiv(id: string, patch: { startTime?: string; levelDescription?: string }) {
    setDivFields((prev) => {
      const next = new Map(prev);
      next.set(id, { ...next.get(id)!, ...patch });
      return next;
    });
  }

  function handleSave() {
    setError(null);
    const prices: Record<string, number> = {};
    if (price1.trim()) prices["1"] = Number(price1);
    if (price2.trim()) prices["2"] = Number(price2);
    const payload: EventInfo = {
      description: description.trim() || undefined,
      registrationDeadline: deadline.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      prizeInfo: prizeInfo.trim() || undefined,
      payment: { mode, ...(Object.keys(prices).length ? { prices } : {}) },
    };
    startTransition(async () => {
      try {
        await updateEventInfo(event.id, payload);
        // Salva os campos de cada divisão que mudaram.
        for (const d of event.divisions) {
          const f = divFields.get(d.id)!;
          if (f.startTime !== (d.startTime ?? "") || f.levelDescription !== (d.levelDescription ?? "")) {
            await updateDivisionInfo(d.id, event.id, {
              startTime: f.startTime.trim() || null,
              levelDescription: f.levelDescription.trim() || null,
            });
          }
        }
        await queryClient.invalidateQueries({ queryKey: eventKeys.detail(event.id) });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao salvar informações.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className="arena flex max-h-[92dvh] w-full flex-col overflow-y-auto rounded-t-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-lg sm:rounded-3xl sm:pb-5"
        style={{ background: "var(--arena-bg-1)", border: "1px solid var(--glass-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="text-base font-bold text-(--arena-foreground)" style={{ fontFamily: "var(--font-display)" }}>
            Informações do evento
          </p>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-(--arena-muted) hover:opacity-70">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="desc">Descrição (aceita **negrito**)</Label>
            <textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
              className="w-full rounded-xl px-3 py-2 text-sm text-(--arena-foreground)"
              style={{ background: "color-mix(in srgb, var(--arena-foreground) 5%, transparent)", border: "1px solid var(--glass-border)" }} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="deadline">Prazo de inscrição</Label>
              <Input id="deadline" value={deadline} onChange={(e) => setDeadline(e.target.value)} placeholder="ex.: 01/05" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact">Contato</Label>
              <Input id="contact" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="(61) 90000-0000" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prize">Premiação (aceita **negrito**)</Label>
            <textarea id="prize" value={prizeInfo} onChange={(e) => setPrizeInfo(e.target.value)} rows={2}
              className="w-full rounded-xl px-3 py-2 text-sm text-(--arena-foreground)"
              style={{ background: "color-mix(in srgb, var(--arena-foreground) 5%, transparent)", border: "1px solid var(--glass-border)" }} />
          </div>

          {/* Pagamento */}
          <div className="space-y-2">
            <Label>Pagamento</Label>
            <div className="flex gap-2">
              {(["manual", "free"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMode(m)}
                  className="flex-1 rounded-xl px-3 py-2 text-xs font-bold transition"
                  style={mode === m
                    ? { background: "var(--arena-primary)", color: "var(--primary-foreground)" }
                    : { background: "color-mix(in srgb, var(--arena-foreground) 6%, transparent)", color: "var(--arena-muted)" }}>
                  {m === "manual" ? "Manual (admin confirma)" : "Gratuito"}
                </button>
              ))}
            </div>
            {mode === "manual" && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label htmlFor="p1" className="text-[11px]">Preço 1 divisão (R$)</Label>
                  <Input id="p1" type="number" inputMode="numeric" value={price1} onChange={(e) => setPrice1(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="p2" className="text-[11px]">Preço 2 divisões (R$)</Label>
                  <Input id="p2" type="number" inputMode="numeric" value={price2} onChange={(e) => setPrice2(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {/* Horário/nível por divisão */}
          {event.divisions.length > 0 && (
            <div className="space-y-2">
              <Label>Horário e nível por divisão</Label>
              <div className="flex flex-col gap-2">
                {event.divisions.map((d) => {
                  const f = divFields.get(d.id)!;
                  return (
                    <GlassCard key={d.id} noPadding className="flex flex-col gap-2 px-3 py-2.5">
                      <p className="text-xs font-semibold text-(--arena-foreground)">{d.divisionLabel ?? d.name}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Input value={f.startTime} onChange={(e) => setDiv(d.id, { startTime: e.target.value })} placeholder="Horário (10h20)" />
                        <Input value={f.levelDescription} onChange={(e) => setDiv(d.id, { levelDescription: e.target.value })} placeholder="Nível" />
                      </div>
                    </GlassCard>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm" style={{ color: "var(--state-noshow)" }}>{error}</p>
          )}

          <button type="button" onClick={handleSave} disabled={isPending}
            className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-(--primary-foreground) transition hover:opacity-90 disabled:opacity-40"
            style={{ background: "var(--arena-primary)" }}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar informações
          </button>
        </div>
      </div>
    </div>
  );
}
