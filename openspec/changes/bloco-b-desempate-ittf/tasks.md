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
- [x] 3.4 **[TS]** DUAS metades: (a) ✅ `getStandings` calcula no TS (`computeGroupStandings`) — feito no commit b68e334; (b) ✅ `supabase-repo.advanceGroupQualifiers` decide os classificados no TS (ITTF/CBTM) e grava os slots do KO (incl. avanço por bye), chamado em `reportResult`/`walkover`/`closeGroupStage`; auto-avanço SQL vira no-op (migration `20260701000100`). Revalidar em HML (task 6.3).

## 4. Implementação — captura de sets e validação

- [x] 4.1 `score-sheet.tsx`: em `bracket === "group"`, inputs de pontos por set (uma linha por set decidido) + envio de `sets` no `reportResult`.
- [x] 4.2 Validação por set (vencedor ≥ 11 e diff ≥ 2; sets batem com o agregado) no `ScoreSheet` e no `reportResultSchema`.
- [x] 4.3 Mata-mata: `captureSets = bracket === "group"` garante que nada muda no KO.

## 5. Implementação — UI da classificação

- [x] 5.1 Invocar a skill `arena-design-pattern` antes de mexer na UI.
- [x] 5.2 `standings-table.tsx` + tabela do `GroupsTab`: coluna **PG** (pontos de game ganhos–perdidos), marcador **D** + tooltip nas linhas empatadas em pontos (posição via desempate ITTF) e legenda do critério. Tokens `--state-scheduled`; tsc/lint/grep §3.1 limpos.

## 6. Verificação

- [x] 6.1 `npx vitest run` — 137 testes verdes (cenários 2.x de desempate incluídos).
- [x] 6.2 `npm run lint` e `npm run build` (exit 0) sem erros nos arquivos tocados; tsc limpo; grep §3.1 (tokens) limpo na UI.
- [ ] 6.3 **HANDOFF (usuário):** aplicar/validar em **HML** (não prod) a migration `20260701000100` — E2E com empate confirmando exibição == classificados (auto-avanço TS). MCP `supabase-hml__query` é read-only; aplicar via túnel/`psql` com ROLLBACK, estilo Bloco A.
- [x] 6.4 `openspec validate bloco-b-desempate-ittf` ok; `design.md` atualizado (decisão B implementada + checkpoint 1.1/1.2 concluído).
- [ ] 6.5 **HANDOFF (usuário):** smoke manual — lançar um grupo com empate e conferir classificação + coluna PG + marcador/tooltip de desempate (D).
