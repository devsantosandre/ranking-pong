## 1. Investigação (checkpoint)

- [ ] 1.1 Confirmar onde a **classificação exibida** é ordenada: view SQL `tournament_standings` (lida por `supabase-repo.getStandings`) vs TS `computeGroupStandings`. Registrar no `design.md` (Open Questions).
- [ ] 1.2 Confirmar onde a **definição dos classificados** ocorre: função SQL `tournament_group_standings` (usada por `tournament_auto_advance_group`) vs TS. Mapear o que precisa do desempate ITTF (view + função + TS) para exibição e auto-avanço concordarem.

## 2. Testes primeiro (test-first) — desempate no TS

- [ ] 2.1 `tests/unit/standings.test.ts`: pontuação 2/1/0 — vitória=2, derrota disputada=1, W.O.=0; ordem preservada vs 3/vitória em grupo completo.
- [ ] 2.2 `standings.test.ts`: empate duplo → confronto direto (critério 1 na mini-tabela).
- [ ] 2.3 `standings.test.ts`: empate triplo → razão de sets só entre os 3; e **aplicação progressiva** (distingue o 1º, recomeça entre os 2 restantes).
- [ ] 2.4 `standings.test.ts`: 3º critério (razão de pontos de game) desempata quando pontos e razão de sets empatam.
- [ ] 2.5 `standings.test.ts`: bordas — `sets` nulo (razão neutra 0), denominador zero (Infinity se há ganhos, 0 se não), W.O. com razões neutras.

## 3. Implementação — cálculo (standings.ts)

- [ ] 3.1 `GroupStanding` ganha `gamePointsWon`/`gamePointsLost` (derivados de `m.sets`, não persistidos).
- [ ] 3.2 Reescrever `computeGroupStandings`: pontos 2/1/0; stats por jogador incl. pontos de game de `m.sets`.
- [ ] 3.3 Implementar `breakTies(tied, matches)` recursivo/progressivo (pontos → razão de sets → razão de pontos, só entre empatados) + `ratio(w,l)` até 2.x passarem.
- [ ] 3.4 Aplicar o mesmo desempate no ponto identificado em 1.1/1.2: se SQL, criar migration idempotente reescrevendo a view `tournament_standings` e a função `tournament_group_standings` (**não aplicar em prod**); espelhar no `mock-repo`/TS para o auto-avanço.

## 4. Implementação — captura de sets e validação

- [ ] 4.1 `score-sheet.tsx`: quando `bracket === "group"` (ou prop `captureSets`), exibir `scoreA+scoreB` linhas de set (pontos A × B) e enviar `sets` no `reportResult`.
- [ ] 4.2 Validação por set (vencedor ≥ 11 e diff ≥ 2; vencedor do set coincide com o agregado) no `ScoreSheet` e reforço no `reportResult`/`reportResultSchema` (`src/app/actions/tournaments.ts`).
- [ ] 4.3 Mata-mata: garantir que nada muda (sem inputs de set).

## 5. Implementação — UI da classificação

- [ ] 5.1 Invocar a skill `arena-design-pattern` antes de mexer na UI.
- [ ] 5.2 `standings-table.tsx` + tabela do `GroupsTab`: exibir **pontos de game** (ganhos–perdidos) e sinalizar/tooltip quando a posição foi decidida por desempate; legenda do critério.

## 6. Verificação

- [ ] 6.1 `npx vitest run` — cenários 2.x verdes.
- [ ] 6.2 `npm run lint` e `npm run build` sem erros nos arquivos tocados.
- [ ] 6.3 Se houver migration SQL: aplicar e validar **em HML** (não prod) — E2E com empate triplo confirmando exibição == classificados (auto-avanço).
- [ ] 6.4 `openspec validate bloco-b-desempate-ittf` ok; atualizar `design.md` com a conclusão do checkpoint 1.1/1.2.
- [ ] 6.5 Smoke manual: lançar um grupo com empate e conferir classificação + tooltip de desempate.
