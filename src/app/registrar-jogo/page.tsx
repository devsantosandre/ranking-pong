"use client";

import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-store";
import { useMemo, useState } from "react";
import { Combobox } from "@/components/ui/combobox";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useUsers, useRegisterMatch, useSettings } from "@/lib/queries";
import { calculateElo } from "@/lib/elo";

type SetScore = { numero: number; winner: "" | "a" | "b" };

export default function RegistrarJogoPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [sets, setSets] = useState<SetScore[]>([
    { numero: 1, winner: "" },
    { numero: 2, winner: "" },
    { numero: 3, winner: "" },
    { numero: 4, winner: "" },
    { numero: 5, winner: "" },
  ]);
  const [selectedOutcome, setSelectedOutcome] = useState<string>("");
  const [opponentId, setOpponentId] = useState("");

  // React Query hooks
  const { data: users = [], isLoading: loadingUsers } = useUsers(user?.id);
  const { data: settings } = useSettings();
  const registerMutation = useRegisterMatch();

  // K factor para cálculo ELO
  const kFactor = useMemo(() => {
    const kSetting = settings?.find((s) => s.key === "k_factor");
    return kSetting ? parseInt(kSetting.value, 10) : 24;
  }, [settings]);

  const limiteJogosDiarios = useMemo(() => {
    const limiteSetting = settings?.find((s) => s.key === "limite_jogos_diarios");
    const limite = limiteSetting ? parseInt(limiteSetting.value, 10) : 2;
    return !isNaN(limite) && limite > 0 ? limite : 2;
  }, [settings]);

  // Filtrar para não mostrar o usuário logado como adversário
  const opponentOptions = users.filter((u) => u.id !== user?.id);
  const comboboxOptions = opponentOptions.map((opt) => ({
    label: opt.full_name || opt.name || opt.email || "Usuário",
    value: opt.id,
    description: opt.email || "",
  }));

  // Encontrar o nome do adversário selecionado
  const selectedOpponent = users.find((u) => u.id === opponentId);
  const opponentName = selectedOpponent?.full_name || selectedOpponent?.name || selectedOpponent?.email || "Adversário";

  const canSubmit = selectedOutcome !== "" && opponentId !== "" && !registerMutation.isPending;

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

  // Calcular previsão ELO baseada nos ratings reais
  const previsao = useMemo(() => {
    if (winsA === winsB) return null;

    // Ratings dos jogadores
    const myRating = user?.rating || 1000;
    const oppRating = selectedOpponent?.rating_atual || 1000;

    const isWin = winsA > winsB;

    if (isWin) {
      // Eu venci
      const { winnerDelta } = calculateElo(myRating, oppRating, kFactor);
      return { text: `Vitória: +${winnerDelta} pts`, color: "text-green-600" };
    } else {
      // Eu perdi
      const { loserDelta } = calculateElo(oppRating, myRating, kFactor);
      return { text: `Derrota: ${loserDelta} pts`, color: "text-red-500" };
    }
  }, [winsA, winsB, user?.rating, selectedOpponent?.rating_atual, kFactor]);

  const applyOutcome = (outcome: string) => {
    const [aStr, bStr] = outcome.split("x");
    const winsA = parseInt(aStr, 10);
    const winsB = parseInt(bStr, 10);
    const total = winsA + winsB;
    const newSets: SetScore[] = Array.from({ length: 5 }).map((_, idx) => {
      if (idx < winsA) return { numero: idx + 1, winner: "a" as const };
      if (idx < total) return { numero: idx + 1, winner: "b" as const };
      return { numero: idx + 1, winner: "" as const };
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

  const handleSubmit = () => {
    if (!canSubmit || !user) return;
    setError(null);

    registerMutation.mutate(
      {
        playerId: user.id,
        opponentId,
        outcome: selectedOutcome,
      },
      {
        onSuccess: () => {
          router.push("/partidas");
        },
        onError: (err) => {
          setError(err.message || "Erro ao registrar partida. Tente novamente.");
        },
      }
    );
  };

  // Verificar se usuário é observador
  if (user?.hideFromRanking) {
    return (
      <AppShell
        title="Registrar jogo"
        subtitle="Ação não permitida"
        showBack
      >
        <div className="space-y-4">
          <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <p className="text-sm font-semibold text-amber-800 mb-2">
              Observadores não podem registrar partidas
            </p>
            <p className="text-xs text-amber-700">
              Você está configurado como observador do ranking. Para participar de partidas,
              um administrador precisa alterar sua configuração em Admin → Jogadores.
            </p>
          </article>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Registrar jogo"
      subtitle={`Melhor de 5 • Máx. ${limiteJogosDiarios} jogos/dia`}
      showBack
    >
      <div className="space-y-4">
        {/* Card de seleção de adversário */}
        <article className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <label className="text-xs font-semibold text-muted-foreground">
            Selecione o adversário
          </label>
          <Combobox
            options={comboboxOptions}
            placeholder={loadingUsers ? "Carregando..." : "Buscar jogador..."}
            emptyText="Nenhum adversário encontrado"
            value={opponentId}
            onChange={(v) => setOpponentId(v)}
          />
        </article>

        {/* Card de confronto */}
        <article className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <p className="text-sm font-semibold text-foreground">{user?.name || "Você"}</p>
              <p className="text-xs text-muted-foreground">Você</p>
            </div>
            <div className="px-4">
              <span className="text-2xl font-bold text-primary">{resumoSets}</span>
            </div>
            <div className="text-center flex-1">
              <p className="text-sm font-semibold text-foreground">{opponentName}</p>
              <p className="text-xs text-muted-foreground">Adversário</p>
            </div>
          </div>

          {/* Resultados rápidos */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Selecione o resultado:</p>
            <div className="flex flex-wrap gap-2">
              {quickOutcomes.map((outcome) => (
                <button
                  key={outcome}
                  type="button"
                  onClick={() => applyOutcome(outcome)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    selectedOutcome === outcome
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-muted/50 text-foreground hover:border-primary/50"
                  }`}
                >
                  {outcome}
                </button>
              ))}
            </div>
          </div>

          {selectedOutcome && (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={resetSets}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground transition"
              >
                Limpar seleção
              </button>
              {previsao && (
                <span className={`text-sm font-semibold ${previsao.color}`}>
                  {previsao.text}
                </span>
              )}
            </div>
          )}
        </article>

        {/* Card de informações */}
        <article className="rounded-2xl border border-border bg-muted/60 p-3 shadow-sm">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Sistema ELO • Pontos variam por nível</span>
            <span className="font-semibold text-amber-600">
              Máx. {limiteJogosDiarios} jogos/dia
            </span>
          </div>
        </article>

        {/* Erro */}
        {(error || registerMutation.error) && (
          <article className="rounded-2xl border border-red-200 bg-red-50 p-3 shadow-sm">
            <p className="text-sm text-red-600">
              {error || registerMutation.error?.message}
            </p>
          </article>
        )}

        {/* Botão de submit */}
        <button
          disabled={!canSubmit}
          onClick={handleSubmit}
          className={`w-full rounded-2xl px-4 py-4 text-sm font-semibold shadow-sm transition ${
            canSubmit
              ? "bg-primary text-primary-foreground hover:scale-[1.01]"
              : "cursor-not-allowed bg-muted text-muted-foreground"
          }`}
        >
          {registerMutation.isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Registrando...
            </span>
          ) : (
            "Registrar partida"
          )}
        </button>
      </div>
    </AppShell>
  );
}
