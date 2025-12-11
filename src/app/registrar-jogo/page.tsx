"use client";

import { AppShell } from "@/components/app-shell";
import { registerMatch } from "@/lib/match-store";
import { useAuth } from "@/lib/auth-store";
import { mockUsers } from "@/lib/mock-users";
import { useMemo, useState } from "react";
import { Combobox } from "@/components/ui/combobox";

type SetScore = { numero: number; winner: "" | "a" | "b" };

export default function RegistrarJogoPage() {
  const { user } = useAuth();
  const [sets, setSets] = useState<SetScore[]>([
    { numero: 1, winner: "" },
    { numero: 2, winner: "" },
    { numero: 3, winner: "" },
    { numero: 4, winner: "" },
    { numero: 5, winner: "" },
  ]);
  const [selectedOutcome, setSelectedOutcome] = useState<string>("");
  const [opponent, setOpponent] = useState("");
  const opponentOptions = mockUsers.filter((u) => u.id !== user?.id);
  const comboboxOptions = opponentOptions.map((opt) => ({
    label: opt.name,
    value: opt.name,
    description: opt.email,
  }));
  const canSubmit = selectedOutcome !== "" && opponent.trim().length > 0;

  const quickOutcomes = ["3x0", "3x1", "3x2", "0x3", "1x3", "2x3"];
  const { resumoSets, winsA, winsB } = useMemo(() => {
    const vencA = sets.filter((s) => s.winner === "a").length;
    const vencB = sets.filter((s) => s.winner === "b").length;
    return {
      resumoSets: `${vencA} x ${vencB}`,
      winsA: vencA,
      winsB: vencB,
    };
  }, [sets]);

  const previsao =
    winsA === winsB
      ? "Selecione o resultado para ver a previsão"
      : winsA > winsB
        ? "Você vence: +20 pts"
        : "Você perde: -8 pts";

  const applyOutcome = (outcome: string) => {
    const [aStr, bStr] = outcome.split("x");
    const winsA = parseInt(aStr, 10);
    const winsB = parseInt(bStr, 10);
    const total = winsA + winsB;
    const newSets: SetScore[] = Array.from({ length: 5 }).map((_, idx) => {
      if (idx < winsA) return { numero: idx + 1, a: "", b: "", winner: "a" };
      if (idx < total) return { numero: idx + 1, a: "", b: "", winner: "b" };
      return { numero: idx + 1, a: "", b: "", winner: "" };
    });
    setSets(newSets);
    setSelectedOutcome(outcome);
  };

  const resetSets = () => {
    setSets([
      { numero: 1, winner: "" },
      { numero: 2, winner: "" },
      { numero: 3, winner: "" },
      { numero: 4, winner: "" },
      { numero: 5, winner: "" },
    ]);
    setSelectedOutcome("");
  };

  return (
    <AppShell
      title="Registrar jogo"
      subtitle="Passo 2/2 • Melhor de 5 • Máx. 2 jogos/dia"
      showBack
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground">
            Adversário
          </label>
          <Combobox
            options={comboboxOptions}
            placeholder="Selecione ou busque"
            emptyText="Nenhum adversário encontrado"
            value={opponent}
            onChange={(v) => setOpponent(v)}
          />
        </div>

        <div className="h-2 w-full rounded-full bg-muted">
          <div className="h-2 w-full rounded-full bg-primary" />
        </div>

        <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
          <span>Você</span>
          <span>vs</span>
          <span>André</span>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            {quickOutcomes.map((outcome) => (
              <button
                key={outcome}
                type="button"
                onClick={() => applyOutcome(outcome)}
                className={`rounded-full border px-3 py-2 transition ${
                  selectedOutcome === outcome
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-card text-foreground"
                }`}
              >
                {outcome} (melhor de 5)
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-muted/70 px-3 py-3 text-xs text-muted-foreground">
            <div className="space-y-1">
              <p>Escolha um resultado rápido (3x0, 3x1, 3x2).</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
                Resultado atual: {resumoSets}
              </p>
            </div>
            <button
              type="button"
              onClick={resetSets}
              className="rounded-full border border-border px-3 py-1 text-[11px] font-semibold text-foreground transition hover:border-primary hover:text-primary"
            >
              Limpar
            </button>
          </div>
        </div>

        <div className="space-y-2 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">
            Previsão: {previsao}
          </p>
          <p className="text-[11px]">
            Regras atuais: vitória +20 pts, derrota -8 pts.
          </p>
          <p className="text-amber-600 font-semibold">Máx. 2 jogos/dia</p>
        </div>

        <button
          disabled={!canSubmit}
          onClick={() => {
            if (!canSubmit) return;
            registerMatch({
              me: user?.name ?? "Você",
              opponent: opponent.trim(),
              outcome: selectedOutcome,
              horario: "Agora",
            });
            resetSets();
            setOpponent("");
          }}
          className={`w-full rounded-full px-4 py-3 text-sm font-semibold shadow-md transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
            canSubmit
              ? "bg-primary text-primary-foreground hover:scale-[1.01]"
              : "cursor-not-allowed bg-muted text-muted-foreground shadow-none"
          }`}
        >
          Registrar partida
        </button>
      </div>
    </AppShell>
  );
}
