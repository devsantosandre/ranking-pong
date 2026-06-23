"use client";

import { ArenaShell } from "@/components/arena/arena-shell";
import { PLAYERS_PER_DIVISION, TOP_3_STYLES, DIVISION_STYLES } from "@/lib/divisions";
import { calculateElo } from "@/lib/elo";
import { useSettings } from "@/lib/queries";
import { useMemo } from "react";
import { Loader2, Trophy } from "lucide-react";

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

  const ratingAchievementsMinPlayers = useMemo(() => {
    const minPlayersSetting = settings?.find((s) => s.key === "achievements_rating_min_players");
    const minPlayers = minPlayersSetting ? parseInt(minPlayersSetting.value, 10) : 6;
    return !isNaN(minPlayers) && minPlayers > 0 ? minPlayers : 6;
  }, [settings]);

  const ratingAchievementsMinMatches = useMemo(() => {
    const minMatchesSetting = settings?.find(
      (s) => s.key === "achievements_rating_min_validated_matches"
    );
    const minMatches = minMatchesSetting ? parseInt(minMatchesSetting.value, 10) : 20;
    return !isNaN(minMatches) && minMatches > 0 ? minMatches : 20;
  }, [settings]);

  const seasonPointsWin = useMemo(() => {
    const s = settings?.find((s) => s.key === "season_points_win");
    const v = s ? parseInt(s.value, 10) : 3;
    return !isNaN(v) && v > 0 ? v : 3;
  }, [settings]);

  const seasonPointsLoss = useMemo(() => {
    const s = settings?.find((s) => s.key === "season_points_loss");
    const v = s ? parseInt(s.value, 10) : 1;
    return !isNaN(v) && v >= 0 ? v : 1;
  }, [settings]);

  const seasonZebraEnabled = useMemo(() => {
    const s = settings?.find((s) => s.key === "season_zebra_enabled");
    return s?.value === "true";
  }, [settings]);

  const seasonZebraBonus = useMemo(() => {
    const s = settings?.find((s) => s.key === "season_zebra_bonus");
    const v = s ? parseInt(s.value, 10) : 2;
    return !isNaN(v) && v > 0 ? v : 2;
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
    <ArenaShell title="Regras" subtitle="Como funciona o ranking" showBack>
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
                    <th className="text-center py-2 font-semibold text-(--state-played)">Vitoria</th>
                    <th className="text-center py-2 font-semibold text-(--state-noshow)">Derrota</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b border-border/50">
                    <td className="py-2">vs Mais forte</td>
                    <td className="text-center py-2 text-(--state-played) font-semibold">+{eloExamples.vsStronger.win}</td>
                    <td className="text-center py-2 text-(--state-noshow) font-semibold">{eloExamples.vsStronger.lose}</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2">vs Mesmo nivel</td>
                    <td className="text-center py-2 text-(--state-played) font-semibold">+{eloExamples.vsEqual.win}</td>
                    <td className="text-center py-2 text-(--state-noshow) font-semibold">{eloExamples.vsEqual.lose}</td>
                  </tr>
                  <tr>
                    <td className="py-2">vs Mais fraco</td>
                    <td className="text-center py-2 text-(--state-played) font-semibold">+{eloExamples.vsWeaker.win}</td>
                    <td className="text-center py-2 text-(--state-noshow) font-semibold">{eloExamples.vsWeaker.lose}</td>
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
              <span className="text-(--state-played) mt-0.5">✓</span>
              <span>Jogadores fortes que perdem para fracos sao mais penalizados</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-(--state-played) mt-0.5">✓</span>
              <span>Jogadores fracos que vencem fortes sao mais recompensados</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-(--state-played) mt-0.5">✓</span>
              <span>Vitorias contra adversarios do mesmo nivel = pontuacao equilibrada</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-(--state-played) mt-0.5">✓</span>
              <span>O rating segue exatamente a soma das vitórias e derrotas, inclusive abaixo de zero</span>
            </li>
          </ul>
        </section>

        {/* Temporadas */}
        <section className="rounded-2xl border border-(--state-scheduled)/30 bg-(--state-scheduled)/10 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="h-5 w-5 text-(--state-scheduled)" />
            <h2 className="text-lg font-bold text-(--state-scheduled)">Temporadas</h2>
          </div>
          <p className="text-sm text-(--state-scheduled)/80 mb-4">
            Uma temporada é uma competição paralela ao ranking ELO, com período definido.
            Todo jogador acumula pontos separadamente — o placar começa do zero em cada temporada.
          </p>

          <p className="text-sm font-semibold text-(--state-scheduled) mb-2">Pontuação por partida</p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="rounded-xl bg-(--state-played)/15 p-3 text-center">
              <p className="text-xl font-bold text-(--state-played)">+{seasonPointsWin} pts</p>
              <p className="text-xs text-(--state-played)">por vitória</p>
            </div>
            <div className="rounded-xl bg-(--state-scheduled)/15 p-3 text-center">
              <p className="text-xl font-bold text-(--state-scheduled)">+{seasonPointsLoss} pt</p>
              <p className="text-xs text-(--state-scheduled)">por derrota</p>
            </div>
          </div>
          {seasonZebraEnabled && (
            <div className="mb-3 rounded-xl bg-(--arena-primary)/15 p-3 text-center">
              <p className="text-sm font-bold text-(--arena-primary)">+{seasonZebraBonus} pts bônus zebra</p>
              <p className="text-xs text-(--arena-primary)">ao vencer alguém acima de você no ranking geral</p>
            </div>
          )}
          <p className="text-xs text-(--state-scheduled)/70 italic mb-4">
            Toda partida vale — mesmo na derrota você acumula pontos!
          </p>

          <ul className="space-y-2 text-sm text-(--state-scheduled)/80">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-(--state-scheduled)">•</span>
              <span>
                Partidas validadas durante uma temporada ativa contam <strong>automaticamente</strong> para o placar — não é preciso fazer nada diferente.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-(--state-scheduled)">•</span>
              <span>
                O ranking da temporada fica na aba <strong>Temporada</strong> dentro de Ranking, separado do ranking ELO.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-(--state-scheduled)">•</span>
              <span>
                O ELO continua sendo calculado normalmente em paralelo — as partidas valem para os dois rankings ao mesmo tempo.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-(--state-scheduled)">•</span>
              <span>
                Quando a temporada encerra, o jogador com mais pontos é o <strong>campeão</strong> e fica registrado no Hall da Fama em <strong>Temporadas</strong>.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-(--state-scheduled)">•</span>
              <span>
                O ELO acumulado durante a temporada <strong>não é zerado</strong> no encerramento — só a pontuação de temporada recomeça do zero na próxima.
              </span>
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
                O ranking é exclusivo para alunos com matrícula ativa. Se o aluno
                cancelar o plano ou deixar de estar ativo, ele sai automaticamente do
                ranking.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>
                Limite de {limiteJogosDiarios} partidas por dia contra o mesmo adversário
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>
                Partidas precisam ser confirmadas ou contestadas pelo adversário
                dentro do prazo configurado. Se não houver resposta, o sistema
                valida automaticamente o placar atual.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>
                O jogador só pode registrar partidas que aconteceram no mesmo dia.
                Se for lançado jogo de data anterior ou jogo que não aconteceu, a
                partida será excluída.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Rating inicial: {ratingInicial} pontos</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>
                Conquistas de rating liberam após {ratingAchievementsMinPlayers} jogadores com jogo
                validado e {ratingAchievementsMinMatches} partidas validadas no total
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>O ranking é atualizado em tempo real após cada partida validada</span>
            </li>
          </ul>
        </section>
      </div>
    </ArenaShell>
  );
}
