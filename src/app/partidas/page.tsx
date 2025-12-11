"use client";

import { AppShell } from "@/components/app-shell";
import {
  confirmMatch,
  type MatchEntry,
  updateOutcome,
  useMatchStore,
} from "@/lib/match-store";
import { useAuth } from "@/lib/auth-store";
import { useState } from "react";

const statusBadge: Record<
  MatchEntry["status"],
  { label: string; className: string }
> = {
  pendente: { label: "Confirmação pendente", className: "bg-amber-100 text-amber-700" },
  contestado: { label: "Ajustar placar", className: "bg-red-100 text-red-600" },
  validado: { label: "Validado", className: "bg-emerald-100 text-emerald-700" },
};

export default function PartidasPage() {
  const { pendentes, recentes } = useMatchStore();
  const { user } = useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftOutcome, setDraftOutcome] = useState<Record<string, string>>({});

  const pendentesDoUsuario = user
    ? pendentes.filter(
        (m) => m.me === user.name || m.opponent === user.name,
      )
    : [];
  const recentesDoUsuario = user
    ? recentes.filter(
        (m) => m.me === user.name || m.opponent === user.name,
      )
    : [];

  return (
    <AppShell
      title="Partidas"
      subtitle="Recentes e Pendentes/Confirmação"
      showBack
    >
      <div className="space-y-4">
        <div className="flex gap-3 text-sm font-semibold">
          {["Recentes", "Pendentes/Confirmação"].map((tab, idx) => (
            <button
              key={tab}
              className={`rounded-full px-3 py-2 ${
                idx === 0
                  ? "bg-primary/15 text-primary"
                  : "bg-muted/70 text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {pendentesDoUsuario.map((item) => {
            const badge = statusBadge[item.status];
            const quickOutcomes = ["3x0", "3x1", "3x2", "0x3", "1x3", "2x3"];
            const isEditing = editingId === item.id;
            const selected = draftOutcome[item.id] ?? item.outcome;
            const euRegistrei = item.me === user?.name;
            const euSouOponente = item.opponent === user?.name;
            const euDevoAgir =
              (euSouOponente && item.status === "pendente") ||
              (euRegistrei && item.edited === true);
            const lastActionByMe = item.lastActionBy === user?.name;
            return (
              <article
                key={item.id}
                className="space-y-3 rounded-2xl border border-border bg-muted/60 p-3 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">
                    vs {item.opponent} • {item.horario}
                  </p>
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </div>

                {euRegistrei && !euDevoAgir ? (
                  <p className="text-xs text-muted-foreground">
                    Aguardando o adversário confirmar ou contestar. Você já registrou este placar.
                  </p>
                ) : isEditing ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Ajuste o placar e salve. O outro jogador confirma em seguida.
                    </p>
                    <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                      {quickOutcomes.map((outcome) => (
                        <button
                          key={outcome}
                          onClick={() =>
                            setDraftOutcome((prev) => ({
                              ...prev,
                              [item.id]: outcome,
                            }))
                          }
                          className={`rounded-full border px-3 py-2 transition ${
                            selected === outcome
                              ? "border-primary bg-primary/15 text-primary"
                              : "border-border bg-card text-foreground"
                          }`}
                        >
                          {outcome}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Confirme o placar ou conteste caso esteja errado.
                  </p>
                )}

                {euDevoAgir && !lastActionByMe ? (
                  <div className="flex gap-2">
                    {!isEditing ? (
                      <>
                        <button
                          onClick={() => confirmMatch(item.id)}
                          className="flex-1 rounded-full bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:scale-[1.01] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(item.id);
                            setDraftOutcome((prev) => ({
                              ...prev,
                              [item.id]: item.outcome,
                            }));
                          }}
                          className="flex-1 rounded-full border border-border px-3 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          Contestar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            if (selected) {
                              updateOutcome(item.id, selected, user?.name ?? "");
                              setEditingId(null);
                            }
                          }}
                          className="flex-1 rounded-full bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:scale-[1.01] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          Salvar ajuste
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setDraftOutcome((prev) => {
                              const next = { ...prev };
                              delete next[item.id];
                              return next;
                            });
                          }}
                          className="flex-1 rounded-full border border-border px-3 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          Cancelar
                        </button>
                      </>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>

        <div className="space-y-3">
          {recentesDoUsuario.map((match) => {
            const badge = statusBadge[match.status];
            return (
              <article
                key={match.id}
                className="space-y-2 rounded-2xl border border-border bg-card p-3 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{match.horario}</p>
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {match.me}{" "}
                  {match.score ? (
                    <span className="text-primary">{match.score}</span>
                  ) : null}{" "}
                  {match.opponent}
                </p>
                {match.delta ? (
                  <p className="text-xs font-semibold text-green-600">
                    {match.delta}
                  </p>
                ) : null}
                {match.setsDesc ? (
                  <p className="text-xs text-muted-foreground">{match.setsDesc}</p>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
