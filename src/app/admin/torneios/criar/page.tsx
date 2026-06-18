"use client";

import { ArenaShell } from "@/components/arena/arena-shell";
import { GlassCard } from "@/components/arena/glass-card";
import { createTournament } from "@/app/actions/tournaments";
import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import {
  Loader2, Network, GitBranch, RotateCw,
  Layers, Crown, Trophy, Check, AlertCircle,
} from "lucide-react";
import type { TournamentFormat } from "@/lib/tournaments/types";

const FORMATS: {
  value: TournamentFormat;
  label: string;
  description: string;
  Icon: typeof Trophy;
  color: string;
  bg: string;
  border: string;
}[] = [
  { value: "single_elimination", label: "Eliminatória simples", description: "Eliminado na 1ª derrota",      Icon: Network,   color: "#a421d2", bg: "rgba(164,33,210,0.10)", border: "rgba(164,33,210,0.22)" },
  { value: "double_elimination", label: "Eliminatória dupla",   description: "2 derrotas para ser eliminado", Icon: GitBranch, color: "#0891b2", bg: "rgba(8,145,178,0.10)",  border: "rgba(8,145,178,0.22)"  },
  { value: "round_robin",        label: "Round-robin",           description: "Todos jogam contra todos",      Icon: RotateCw,  color: "#059669", bg: "rgba(5,150,105,0.10)",  border: "rgba(5,150,105,0.22)"  },
  { value: "groups_knockout",    label: "Grupos + mata-mata",    description: "Fase de grupos + eliminação",   Icon: Layers,    color: "#d97706", bg: "rgba(217,119,6,0.10)",  border: "rgba(217,119,6,0.22)"  },
  { value: "king_of_table",      label: "Rei da Mesa",           description: "Desafiante enfrenta o líder",  Icon: Crown,     color: "#dc2626", bg: "rgba(220,38,38,0.10)",  border: "rgba(220,38,38,0.22)"  },
];

const BEST_OF_OPTIONS = [1, 3, 5, 7] as const;

export default function CriarTorneioPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [format, setFormat] = useState<TournamentFormat>("single_elimination");
  const [bestOf, setBestOf] = useState(3);

  const selectedFormat = FORMATS.find((f) => f.value === format)!;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("O nome do torneio é obrigatório."); return; }
    startTransition(async () => {
      try {
        const result = await createTournament({ name: name.trim(), format, bestOf });
        if (result?.tournament?.id) router.push(`/admin/torneios/${result.tournament.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao criar torneio.");
      }
    });
  }

  return (
    <ArenaShell title="Novo Torneio" showBack>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">

        {/* Nome */}
        <div className="flex flex-col gap-2">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)">
            Nome do torneio *
          </p>
          <input
            type="text"
            placeholder="Ex: Copa de Verão 2026"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isPending}
            maxLength={80}
            autoFocus
            className="w-full rounded-2xl px-4 py-3 text-sm font-medium outline-none transition"
            style={{
              background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)",
              color: "var(--arena-foreground)",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "color-mix(in srgb, var(--arena-primary) 50%, transparent)";
              e.currentTarget.style.boxShadow = "0 0 0 3px color-mix(in srgb, var(--arena-primary) 10%, transparent)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--glass-border)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
        </div>

        {/* Formato */}
        <div className="flex flex-col gap-2">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)">
            Formato
          </p>
          <div className="flex flex-col gap-2">
            {FORMATS.map((f) => {
              const isSelected = format === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFormat(f.value)}
                  disabled={isPending}
                  className="flex items-center gap-3 rounded-2xl p-3.5 text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
                  style={{
                    background: isSelected
                      ? `color-mix(in srgb, ${f.color} 8%, var(--glass-bg))`
                      : "var(--glass-bg)",
                    border: isSelected
                      ? `1.5px solid ${f.border}`
                      : "1px solid var(--glass-border)",
                    boxShadow: isSelected
                      ? `0 4px 16px color-mix(in srgb, ${f.color} 15%, transparent)`
                      : "var(--shadow-card)",
                  }}
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: f.bg }}
                  >
                    <f.Icon className="h-5 w-5" style={{ color: f.color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-(--arena-foreground)"
                      style={{ color: isSelected ? f.color : undefined }}>
                      {f.label}
                    </p>
                    <p className="text-[11px] text-(--arena-muted)">{f.description}</p>
                  </div>
                  {isSelected && (
                    <div
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                      style={{ background: f.color }}
                    >
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Melhor de N */}
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between px-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-(--arena-muted)">
              Sets por partida
            </p>
            <p className="text-[11px] text-(--arena-muted)">
              {Math.ceil(bestOf / 2)} para vencer
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {BEST_OF_OPTIONS.map((n) => {
              const isSelected = bestOf === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setBestOf(n)}
                  disabled={isPending}
                  className="flex flex-col items-center justify-center gap-0.5 rounded-2xl py-4 transition-all hover:scale-[1.04] active:scale-[0.97]"
                  style={
                    isSelected
                      ? {
                          background: "var(--arena-primary)",
                          boxShadow: "0 4px 14px color-mix(in srgb, var(--arena-primary) 35%, transparent)",
                          color: "#ffffff",
                        }
                      : {
                          background: "var(--glass-bg)",
                          border: "1px solid var(--glass-border)",
                          color: "var(--arena-muted)",
                        }
                  }
                >
                  <span
                    className="text-xl font-black tabular-nums leading-none"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {n}
                  </span>
                  <span className="text-[9px] font-semibold uppercase tracking-wider opacity-75">
                    {n === 1 ? "set" : "sets"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Erro */}
        {error && (
          <div
            className="flex items-center gap-2 rounded-2xl px-4 py-3"
            style={{
              background: "color-mix(in srgb, var(--state-noshow) 8%, transparent)",
              border: "1px solid color-mix(in srgb, var(--state-noshow) 25%, transparent)",
            }}
          >
            <AlertCircle className="h-4 w-4 shrink-0" style={{ color: "var(--state-noshow)" }} />
            <p className="text-sm" style={{ color: "var(--state-noshow)" }}>{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending || !name.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            background: "var(--arena-primary)",
            boxShadow: name.trim()
              ? "0 6px 20px color-mix(in srgb, var(--arena-primary) 35%, transparent)"
              : "none",
          }}
        >
          {isPending
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <selectedFormat.Icon className="h-4 w-4" />
          }
          {isPending ? "Criando…" : "Criar torneio"}
        </button>
      </form>
    </ArenaShell>
  );
}
