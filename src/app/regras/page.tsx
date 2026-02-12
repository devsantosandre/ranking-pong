"use client";

import { AppShell } from "@/components/app-shell";
import { PLAYERS_PER_DIVISION, TOP_3_STYLES, DIVISION_STYLES } from "@/lib/divisions";
import { calculateElo } from "@/lib/elo";
import { useSettings } from "@/lib/queries";
import { useMemo } from "react";
import { Loader2 } from "lucide-react";

export default function RegrasPage() {
  const { data: settings, isLoading } = useSettings();

  // Buscar k_factor das configuracoes
  const kFactor = useMemo(() => {
    const kSetting = settings?.find((s) => s.key === "k_factor");
    return kSetting ? parseInt(kSetting.value, 10) : 24;
  }, [settings]);

  const limiteJogosDiarios = useMemo(() => {
    const limiteSetting = settings?.find((s) => s.key === "limite_jogos_diarios");
    const limite = limiteSetting ? parseInt(limiteSetting.value, 10) : 2;
    return !isNaN(limite) && limite > 0 ? limite : 2;
  }, [settings]);

  const ratingInicial = useMemo(() => {
    const ratingSetting = settings?.find((s) => s.key === "rating_inicial");
    const rating = ratingSetting ? parseInt(ratingSetting.value, 10) : 250;
    return !isNaN(rating) && rating > 0 ? rating : 250;
  }, [settings]);

  // Calcular exemplos de pontuacao com o K factor atual
  const eloExamples = useMemo(() => {
    // vs Mais forte (800 vs 1200) - diferenca de 400 pontos
    const vsStronger = calculateElo(800, 1200, kFactor); // fraco vence forte
    const vsStrongerLose = calculateElo(1200, 800, kFactor); // forte vence fraco

    // vs Mesmo nivel (1000 vs 1000)
    const vsEqual = calculateElo(1000, 1000, kFactor);

    // vs Mais fraco (1200 vs 800) - diferenca de 400 pontos
    const vsWeaker = calculateElo(1200, 800, kFactor); // forte vence fraco
    const vsWeakerLose = calculateElo(800, 1200, kFactor); // fraco vence forte

    return {
      vsStronger: {
        win: vsStronger.winnerDelta, // fraco vencendo forte
        lose: vsStrongerLose.loserDelta, // fraco perdendo p/ forte
      },
      vsEqual: {
        win: vsEqual.winnerDelta,
        lose: vsEqual.loserDelta,
      },
      vsWeaker: {
        win: vsWeaker.winnerDelta, // forte vencendo fraco
        lose: vsWeakerLose.loserDelta, // forte perdendo p/ fraco
      },
    };
  }, [kFactor]);

  return (
    <AppShell title="Regras" subtitle="Como funciona o ranking" showBack>
      <div className="space-y-6">
        {/* Sistema de Divisoes */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-lg font-bold text-foreground mb-3">Sistema de Divisoes</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Os jogadores sao organizados em divisoes de {PLAYERS_PER_DIVISION} jogadores cada:
          </p>

          <div className="space-y-2">
            <div className={`flex items-center gap-3 p-2 rounded-lg ${DIVISION_STYLES[1].bg}`}>
              <span className="text-lg">{DIVISION_STYLES[1].emoji}</span>
              <div>
                <p className={`font-semibold ${DIVISION_STYLES[1].text}`}>Divisao 1</p>
                <p className="text-xs text-muted-foreground">Posicoes 1-6</p>
              </div>
            </div>

            <div className={`flex items-center gap-3 p-2 rounded-lg ${DIVISION_STYLES[2].bg}`}>
              <span className="text-lg">{DIVISION_STYLES[2].emoji}</span>
              <div>
                <p className={`font-semibold ${DIVISION_STYLES[2].text}`}>Divisao 2</p>
                <p className="text-xs text-muted-foreground">Posicoes 7-12</p>
              </div>
            </div>

            <div className={`flex items-center gap-3 p-2 rounded-lg ${DIVISION_STYLES[3].bg}`}>
              <span className="text-lg">{DIVISION_STYLES[3].emoji}</span>
              <div>
                <p className={`font-semibold ${DIVISION_STYLES[3].text}`}>Divisao 3</p>
                <p className="text-xs text-muted-foreground">Posicoes 13-18</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
              <span className="text-lg">📊</span>
              <div>
                <p className="font-semibold text-muted-foreground">Divisao 4+</p>
                <p className="text-xs text-muted-foreground">Posicoes 19+</p>
              </div>
            </div>
          </div>
        </section>

        {/* Top 3 */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-lg font-bold text-foreground mb-3">Top 3 - Destaque Especial</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Os 3 primeiros colocados recebem destaque especial no ranking:
          </p>

          <div className="space-y-2">
            {[1, 2, 3].map((pos) => (
              <div
                key={pos}
                className={`flex items-center gap-3 p-3 rounded-lg border ${TOP_3_STYLES[pos].border} ${TOP_3_STYLES[pos].bg}`}
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${TOP_3_STYLES[pos].badge} shadow-lg`}>
                  <span className="text-sm font-bold text-white">{pos}o</span>
                </div>
                <div className="flex items-center gap-2">
                  <p className={`font-semibold ${TOP_3_STYLES[pos].text}`}>Top {pos}</p>
                  <span className="text-sm">🔥</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Sistema ELO */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-lg font-bold text-foreground mb-3">Sistema de Pontuacao (ELO)</h2>
          <p className="text-sm text-muted-foreground mb-4">
            A pontuacao e calculada com base na diferenca de nivel entre os jogadores.
            Vencer adversarios mais fortes da mais pontos!
          </p>

          {/* Tabela de exemplos */}
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 font-semibold">Situacao</th>
                    <th className="text-center py-2 font-semibold text-green-600">Vitoria</th>
                    <th className="text-center py-2 font-semibold text-red-500">Derrota</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b border-border/50">
                    <td className="py-2">vs Mais forte</td>
                    <td className="text-center py-2 text-green-600 font-semibold">+{eloExamples.vsStronger.win}</td>
                    <td className="text-center py-2 text-red-500 font-semibold">{eloExamples.vsStronger.lose}</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2">vs Mesmo nivel</td>
                    <td className="text-center py-2 text-green-600 font-semibold">+{eloExamples.vsEqual.win}</td>
                    <td className="text-center py-2 text-red-500 font-semibold">{eloExamples.vsEqual.lose}</td>
                  </tr>
                  <tr>
                    <td className="py-2">vs Mais fraco</td>
                    <td className="text-center py-2 text-green-600 font-semibold">+{eloExamples.vsWeaker.win}</td>
                    <td className="text-center py-2 text-red-500 font-semibold">{eloExamples.vsWeaker.lose}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-4 italic">
            * Valores aproximados com K={kFactor}. A pontuacao exata depende da diferenca de rating.
          </p>
        </section>

        {/* Por que ELO */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-lg font-bold text-foreground mb-3">Por que ELO?</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>Jogadores fortes que perdem para fracos sao mais penalizados</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>Jogadores fracos que vencem fortes sao mais recompensados</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>Vitorias contra adversarios do mesmo nivel = pontuacao equilibrada</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>Rating minimo de 100 pontos para evitar valores negativos</span>
            </li>
          </ul>
        </section>

        {/* Regras gerais */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-lg font-bold text-foreground mb-3">Regras Gerais</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>
                Limite de {limiteJogosDiarios} partidas por dia contra o mesmo adversario
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Partidas precisam ser confirmadas pelo adversario</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Rating inicial: {ratingInicial} pontos</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>O ranking e atualizado em tempo real apos cada partida validada</span>
            </li>
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
