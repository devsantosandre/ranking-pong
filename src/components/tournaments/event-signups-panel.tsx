"use client";

import { GlassCard } from "@/components/arena/glass-card";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { confirmEventSignup, rejectEventSignup } from "@/app/actions/tournaments";
import { useEventSignups, eventKeys } from "@/lib/queries/use-events";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useTransition } from "react";
import { Loader2, Check, X, Phone, Mail } from "lucide-react";
import type { EventSignup, SignupPaymentStatus } from "@/lib/tournaments/types";

const STATUS_META: Record<SignupPaymentStatus, { label: string; token: string }> = {
  pending: { label: "Pendente", token: "--state-scheduled" },
  confirmed: { label: "Confirmada", token: "--state-played" },
  rejected: { label: "Rejeitada", token: "--state-noshow" },
  expired: { label: "Expirada", token: "--state-tbd" },
};

export function EventSignupsPanel({ eventId }: { eventId: string }) {
  const { data: signups, isLoading } = useEventSignups(eventId);
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [confirmTarget, setConfirmTarget] = useState<EventSignup | null>(null);
  const [rejectTarget, setRejectTarget] = useState<EventSignup | null>(null);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: eventKeys.signups(eventId) });
    queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
  }

  function doConfirm() {
    if (!confirmTarget) return;
    startTransition(async () => {
      await confirmEventSignup(confirmTarget.id, eventId);
      setConfirmTarget(null);
      refresh();
    });
  }
  function doReject() {
    if (!rejectTarget) return;
    startTransition(async () => {
      await rejectEventSignup(rejectTarget.id, eventId);
      setRejectTarget(null);
      refresh();
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-(--arena-primary)" />
      </div>
    );
  }

  if (!signups || signups.length === 0) {
    return (
      <GlassCard className="py-8 text-center">
        <p className="text-sm text-(--arena-muted)">Nenhuma inscrição ainda.</p>
      </GlassCard>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {signups.map((s) => {
          const meta = STATUS_META[s.paymentStatus];
          return (
            <GlassCard key={s.id} noPadding className="flex flex-col gap-2 px-3 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-(--arena-foreground)">{s.fullName}</p>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-(--arena-muted)">
                    {s.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {s.email}</span>}
                    {s.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {s.phone}</span>}
                  </span>
                </div>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{ background: `color-mix(in srgb, var(${meta.token}) 14%, transparent)`, color: `var(${meta.token})` }}>
                  {meta.label}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-(--arena-muted)">
                  {s.divisions.length} divisão{s.divisions.length !== 1 ? "es" : ""}
                  {s.cbtmRating != null && ` · rating ${s.cbtmRating}`}
                  {s.amountCents != null && ` · R$${(s.amountCents / 100).toFixed(0)}`}
                </span>

                {s.paymentStatus === "pending" && (
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => setRejectTarget(s)} disabled={isPending}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition hover:opacity-90 disabled:opacity-40"
                      style={{ background: "color-mix(in srgb, var(--state-noshow) 12%, transparent)", color: "var(--state-noshow)" }}>
                      <X className="h-3 w-3" /> Rejeitar
                    </button>
                    <button type="button" onClick={() => setConfirmTarget(s)} disabled={isPending}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition hover:opacity-90 disabled:opacity-40"
                      style={{ background: "color-mix(in srgb, var(--state-played) 14%, transparent)", color: "var(--state-played)" }}>
                      <Check className="h-3 w-3" /> Confirmar
                    </button>
                  </div>
                )}
              </div>
            </GlassCard>
          );
        })}
      </div>

      <ConfirmModal
        isOpen={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        onConfirm={doConfirm}
        title="Confirmar inscrição"
        description={`Confirmar ${confirmTarget?.fullName ?? ""}? Isto gera os participantes nas divisões escolhidas.`}
        confirmText="Confirmar"
        variant="warning"
        loading={isPending}
      />
      <ConfirmModal
        isOpen={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={doReject}
        title="Rejeitar inscrição"
        description={`Rejeitar ${rejectTarget?.fullName ?? ""}? Nenhum participante será criado.`}
        confirmText="Rejeitar"
        variant="danger"
        loading={isPending}
      />
    </>
  );
}
