## 1. Investigação (checkpoint)

- [x] 1.1 Confirmar onde a **classificação exibida** é ordenada → **view SQL `tournament_standings`** (registrado no design.md).
- [x] 1.2 Confirmar onde a **definição dos classificados** ocorre → **função SQL `tournament_group_standings`** (auto-avanço). Decisão de arquitetura (SQL vs TS) registrada no design.md — aguarda escolha do usuário antes da 3.4.

> **Decisões (do usuário):** (1) arquitetura = **tudo em TS** (fonte única testável); (2) **foco no desempate agora** — pontuação mantida em 3/vitória; **2/1/0 + marcador de W.O. → follow-up** (os dados não marcam W.O., então 2/1/0 seria order-equivalente ao atual).

## 2. Testes primeiro (test-first) — desempate no TS

- [~] 2.1 Pontuação 2/1/0 — **ADIADO** (follow-up): sem marcador de W.O. nos dados, seria order-equivalente ao 3/vitória atual. Mantido 3/vitória.
- [x] 2.2 `standings.test.ts`: empate → confronto direto (critério 1 na mini-tabela) — incl. dois pares 2-a-2.
- [x] 2.3 `standings.test.ts`: empate triplo → razão de sets só entre os 3 (aplicação progressiva).
- [x] 2.4 `standings.test.ts`: 3º critério (razão de pontos de game) desempata quando pontos e razão de sets empatam.
- [x] 2.5 `standings.test.ts`: bordas — `sets` nulo (razão neutra), sem quebrar.

## 3. Implementação — cálculo (standings.ts)

- [x] 3.1 `GroupStanding` ganha `gamePointsWon`/`gamePointsLost` (derivados de `m.sets`) + `standingFromRow` default 0.
- [x] 3.2 Reescrever `computeGroupStandings`: pontos de game de `m.sets`; pontos 3/vitória (mantido).
- [x] 3.3 Implementar `breakTies(tied, matches)` recursivo/progressivo (pontos → razão de sets → razão de pontos, só entre empatados) + `ratio(w,l)`.
- [ ] 3.4 **[TS]** `getStandings` calcula no TS (`computeGroupStandings`) em vez de ler a view; e mover a decisão de classificados do SQL para a action (ao fechar o grupo, calcular no TS e gravar os slots do KO, incl. avanço por bye). Revalidar em HML.

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
