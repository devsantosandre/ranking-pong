"use client";

import { ArenaShell } from "@/components/arena/arena-shell";
import { useAuth } from "@/lib/auth-store";
import { useEffect, useMemo, useRef, useState } from "react";
import { Combobox } from "@/components/ui/combobox";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  useUsers,
  useRegisterMatch,
  useSettings,
  useDailyLimitForPair,
} from "@/lib/queries";
import { calculateElo } from "@/lib/elo";

type SetScore = { numero: number; winner: "" | "a" | "b" };

function generateRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

export default function RegistrarJogoPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const [sets, setSets] = useState<SetScore[]>([
    { numero: 1, winner: "" },
    { numero: 2, winner: "" },
    { numero: 3, winner: "" },
    { numero: 4, winner: "" },
    { numero: 5, winner: "" },
  ]);
  const [selectedOutcome, setSelectedOutcome] = useState<string>("");
  const [opponentId, setOpponentId] = useState("");

  const { data: users = [], isLoading: loadingUsers } = useUsers(user?.id);
  const { data: settings } = useSettings();
  const registerMutation = useRegisterMatch();
  const { data: dailyLimitStatus } = useDailyLimitForPair(user?.id, opponentId);

  useEffect(() => {
    requestIdRef.current = null;
  }, [opponentId, selectedOutcome]);

  const kFactor = useMemo(() => {
    const kSetting = settings?.find((s) => s.key === "k_factor");
    return kSetting ? parseInt(kSetting.value, 10) : 24;
  }, [settings]);

  const limiteJogosDiarios = useMemo(() => {
    const limiteSetting = settings?.find((s) => s.key === "limite_jogos_diarios");
    const limite = limiteSetting ? parseInt(limiteSetting.value, 10) : 2;
    return !isNaN(limite) && limite > 0 ? limite : 2;
  }, [settings]);

  const opponentOptions = users.filter((u) => u.id !== user?.id);
  const comboboxOptions = opponentOptions.map((opt) => ({
    label: opt.full_name || opt.name || opt.email || "Usuário",
    value: opt.id,
    description: opt.email || "",
  }));

  const selectedOpponent = users.find((u) => u.id === opponentId);
  const opponentName = selectedOpponent?.full_name || selectedOpponent?.name || selectedOpponent?.email || "Adversário";

  const jogosHojeContraAdv = dailyLimitStatus?.jogosHoje ?? 0;
  const limiteAtingido = jogosHojeContraAdv >= limiteJogosDiarios;
  const jogosRestantes = Math.max(0, limiteJogosDiarios - jogosHojeContraAdv);

  const canSubmit =
    selectedOutcome !== "" &&
    opponentId !== "" &&
    !registerMutation.isPending &&
    !limiteAtingido;

  const quickOutcomes = ["3x0", "3x1", "3x2", "0x3", "1x3", "2x3"];
  const { resumoSets, winsA, winsB } = useMemo(() => {
    const vencA = sets.filter((s) => s.winner === "a").length;
    const vencB = sets.filter((s) => s.winner === "b").length;
    return { resumoSets: `${vencA} x ${vencB}`, winsA: vencA, winsB: vencB };
  }, [sets]);

  const previsao = useMemo(() => {
    if (winsA === winsB) return null;
    const myRating = user?.rating ?? 250;
    const oppRating = selectedOpponent?.rating_atual ?? 250;
    const isWin = winsA > winsB;
    if (isWin) {
      const { winnerDelta } = calculateElo(myRating, oppRating, kFactor);
      return { text: `Vitória: +${winnerDelta} pts`, color: "var(--state-played)" };
    } else {
      const { loserDelta } = calculateElo(oppRating, myRating, kFactor);
      return { text: `Derrota: ${loserDelta} pts`, color: "var(--state-noshow)" };
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
    const requestId = requestIdRef.current || generateRequestId();
    requestIdRef.current = requestId;

    registerMutation.mutate(
      {
        playerId: user.id,
        opponentId,
        outcome: selectedOutcome,
        requestId,
        optimisticOpponent: selectedOpponent
          ? {
              id: selectedOpponent.id,
              name: selectedOpponent.name ?? null,
              full_name: selectedOpponent.full_name ?? null,
              email: selectedOpponent.email ?? null,
            }
          : null,
        optimisticSelf: {
          id: user.id,
          name: user.name ?? null,
          full_name: null,
          email: null,
        },
      },
      {
        onSuccess: () => {
          requestIdRef.current = null;
          router.push(
            `/partidas?registered=1&opponent=${encodeURIComponent(opponentName)}&opponentId=${encodeURIComponent(opponentId)}`
          );
        },
        onError: (err) => {
          setError(err.message || "Erro ao registrar partida. Tente novamente.");
        },
      }
    );
  };

  if (user?.hideFromRanking) {
    return (
      <ArenaShell title="Registrar jogo" subtitle="Ação não permitida" showBack>
        <div className="space-y-4">
          <article className="glass rounded-2xl p-4">
            <p className="text-sm font-semibold mb-2" style={{ color: "var(--state-scheduled)" }}>
              Observadores não podem registrar partidas
            </p>
            <p className="text-xs text-(--arena-muted)">
              Você está configurado como observador do ranking. Para participar de partidas,
              um administrador precisa alterar sua configuração em Admin → Jogadores.
            </p>
          </article>
        </div>
      </ArenaShell>
    );
  }

  return (
    <ArenaShell
      title="Registrar jogo"
      subtitle={`Melhor de 5 • Máx. ${limiteJogosDiarios} jogos/dia`}
      showBack
    >
      <div className="space-y-4">
        {/* Seleção de adversário */}
        <article className="glass rounded-2xl p-4 space-y-3">
          <label className="text-xs font-semibold text-(--arena-muted)">
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

        {/* Confronto */}
        <article className="glass rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <p className="text-sm font-semibold text-(--arena-foreground)">{user?.name || "Você"}</p>
              <p className="text-xs text-(--arena-muted)">Você</p>
            </div>
            <div className="px-4">
              <span
                className="text-2xl font-bold tabular-nums"
                style={{ color: "var(--arena-primary)" }}
              >
                {resumoSets}
              </span>
            </div>
            <div className="text-center flex-1">
              <p className="text-sm font-semibold text-(--arena-foreground)">{opponentName}</p>
              <p className="text-xs text-(--arena-muted)">Adversário</p>
            </div>
          </div>

          {/* Resultados rápidos */}
          <div className="space-y-2">
            <p className="text-xs text-(--arena-muted)">Selecione o resultado:</p>
            <div className="flex flex-wrap gap-2">
              {quickOutcomes.map((outcome) => (
                <button
                  key={outcome}
                  type="button"
                  onClick={() => applyOutcome(outcome)}
                  className="rounded-full border px-4 py-2 text-sm font-semibold transition"
                  style={
                    selectedOutcome === outcome
                      ? {
                          borderColor: "var(--arena-primary)",
                          background: "color-mix(in srgb, var(--arena-primary) 12%, transparent)",
                          color: "var(--arena-primary)",
                        }
                      : {
                          borderColor: "var(--glass-border)",
                          background: "var(--glass-bg)",
                          color: "var(--arena-foreground)",
                        }
                  }
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
                className="text-xs font-semibold text-(--arena-muted) hover:text-(--arena-foreground) transition"
              >
                Limpar seleção
              </button>
              {previsao && (
                <span className="text-sm font-semibold" style={{ color: previsao.color }}>
                  {previsao.text}
                </span>
              )}
            </div>
          )}
        </article>

        {/* Info */}
        <article className="glass rounded-2xl p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-(--arena-muted)">Sistema ELO • Pontos variam por nível</span>
            <span className="font-semibold" style={{ color: "var(--state-scheduled)" }}>
              Máx. {limiteJogosDiarios} jogos/dia
            </span>
          </div>
          {opponentId && (
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-(--arena-muted)">
                Hoje contra <span className="font-semibold text-(--arena-foreground)">{opponentName}</span>
              </span>
              <span
                className="font-semibold"
                style={{ color: limiteAtingido ? "var(--state-noshow)" : "var(--arena-foreground)" }}
              >
                {jogosHojeContraAdv}/{limiteJogosDiarios} jogos
              </span>
            </div>
          )}
        </article>

        {opponentId && limiteAtingido && (
          <article className="glass rounded-2xl p-3" style={{ borderColor: "color-mix(in srgb, var(--state-noshow) 25%, transparent)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--state-noshow)" }}>
              Limite diário atingido
            </p>
            <p className="text-xs text-(--arena-muted) mt-1">
              Você já registrou {jogosHojeContraAdv} jogos hoje contra {opponentName}.
              Volte amanhã para registrar novas partidas com esse adversário.
            </p>
          </article>
        )}

        {opponentId && !limiteAtingido && jogosRestantes === 1 && (
          <article className="glass rounded-2xl p-3" style={{ borderColor: "color-mix(in srgb, var(--state-scheduled) 25%, transparent)" }}>
            <p className="text-xs" style={{ color: "var(--state-scheduled)" }}>
              Último jogo do dia contra {opponentName}.
            </p>
          </article>
        )}

        {(error || registerMutation.error) && (
          <article className="glass rounded-2xl p-3" style={{ borderColor: "color-mix(in srgb, var(--state-noshow) 25%, transparent)" }}>
            <p className="text-sm" style={{ color: "var(--state-noshow)" }}>
              {error || registerMutation.error?.message}
            </p>
          </article>
        )}

        {registerMutation.isPaused && (
          <article className="glass rounded-2xl p-3" style={{ borderColor: "color-mix(in srgb, var(--state-scheduled) 25%, transparent)" }}>
            <p className="text-sm" style={{ color: "var(--state-scheduled)" }}>
              Sem conexão estável. Vamos tentar enviar automaticamente assim que a internet voltar.
            </p>
          </article>
        )}

        {/* Submit */}
        <button
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="w-full rounded-2xl px-4 py-4 text-sm font-semibold shadow-sm transition"
          style={
            canSubmit
              ? {
                  background: "var(--arena-primary)",
                  color: "#ffffff",
                  boxShadow: "0 4px 16px color-mix(in srgb, var(--arena-primary) 30%, transparent)",
                }
              : {
                  background: "var(--glass-bg)",
                  color: "var(--arena-muted)",
                  cursor: "not-allowed",
                }
          }
        >
          {registerMutation.isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {registerMutation.isPaused ? "Aguardando conexão..." : "Registrando..."}
            </span>
          ) : (
            "Registrar partida"
          )}
        </button>
      </div>
    </ArenaShell>
  );
}
