## Context

A classificação de grupo é calculada em três lugares que precisam concordar:
- **`computeGroupStandings`** (`src/lib/tournaments/standings.ts`, TS): hoje ordena por `points desc → (setsWon−setsLost) desc → setsWon desc`, com `points = 3×vitórias`. Usada pelo `mock-repo` (auto-avanço nos testes) e por componentes.
- **View SQL `tournament_standings`** (migrations `20260617*`): fonte da **classificação exibida** em produção (`supabase-repo.getStandings` lê dela).
- **Função SQL `tournament_group_standings`** (`20260622_tournament_engine_v2.sql`): define o **rank dos classificados** que `tournament_auto_advance_group` promove ao mata-mata. Hoje ordena por `points desc, saldo desc, sets_won desc`.

O placar por set já existe na coluna `tournament_matches.sets jsonb`, mas o `ScoreSheet` não preenche — então não há "pontos de game" para o 3º critério.

Regra oficial (ITTF 3.7.6 / CBTM): pontos de vitória (2/1/0); em empate, olhar **só os jogos entre os empatados**, na ordem pontos → razão de sets → razão de pontos de game; **aplicação progressiva** (subconjunto que se distingue é fixado; recomeça entre os restantes).

## Goals / Non-Goals

**Goals:**
- `computeGroupStandings` reescrita: pontos 2/1/0, e `breakTies` recursivo/progressivo (pontos → razão de sets → razão de pontos) usando só a mini-tabela entre os empatados.
- `GroupStanding` com `gamePointsWon`/`gamePointsLost` derivados de `m.sets` (não persistidos).
- `ScoreSheet` captura placar set-a-set em jogos de grupo; `reportResult` valida e grava `sets`.
- Paridade SQL (view + função) com o TS, para que a classificação exibida e os classificados que avançam usem o mesmo desempate.
- Testes Vitest escritos primeiro (empate duplo/triplo/quádruplo, W.O., sets nulos).

**Non-Goals:**
- Mata-mata (critério inalterado).
- Inscrição/pagamento (Bloco C), remoção em massa (Bloco D).
- Mudança de schema (coluna `sets` já existe).

## Decisions

- **Pontos 2/1/0 (oficial)** em vez de 3/vitória. Em grupo completo a ordem por pontos é idêntica; a mudança trata W.O. (0) e derrota disputada (1) corretamente e segue o padrão. Impacto visual mínimo.
- **`breakTies` recursivo e progressivo**, operando sobre a **mini-tabela** (só partidas entre os empatados). `ratio(w,l) = l===0 ? (w===0 ? 0 : Infinity) : w/l`. Ordena por `[−miniMatchPoints, −ratio(sets), −ratio(gamePoints)]`; separa quem ficou distinto e recursa nos ainda-iguais. Alternativa descartada: ordenar tudo por critérios globais — não é o que a ITTF manda (é entre-empatados).
- **Pontos de game derivados de `m.sets`** em memória (não persistir). Jogos sem `sets` (antigos/W.O.) → contribuição neutra (razão 0), sem quebrar.
- **Investigar onde a ordenação exibida/decisória acontece antes de codar** (view/função SQL vs TS) — primeira task, como no Bloco A. O desempate entra onde a ordenação realmente ocorre; se SQL, migration idempotente (não aplicar em prod), espelhando o TS.
- **`ScoreSheet`**: nº de linhas de set = `scoreA + scoreB` (sets decididos); validar por set (vencedor ≥ 11 e diferença ≥ 2; vencedor do set coincide com o agregado). Só quando `bracket === "group"`.

## Risks / Trade-offs

- [Desempate em PL/pgSQL é complexo] → a recursão progressiva é difícil em SQL. Mitigação: manter o cálculo de exibição no TS onde possível; se a view/função precisam ordenar, replicar a lógica com cuidado e cobrir com o E2E em HML (como no Bloco A). Se inviável em SQL puro, avaliar mover a ordenação decisória para o TS.
- [Trocar 3→2/1/0 muda números exibidos] → documentado; ordem preservada em grupos completos. Testes cobrem.
- [Divergência entre TS e SQL] → risco de o auto-avanço promover jogador diferente do exibido. Mitigação: testes de paridade + validar `tournament_group_standings` no HML.
- [Sets nulos em jogos já lançados] → razão de pontos neutra; não quebra ordenação existente.

## Open Questions

- ~~A classificação exibida e a decisão de classificados são SQL ou TS?~~ **RESOLVIDO (checkpoint 1.1/1.2).** Ambas são **SQL** — ver abaixo.
- O 3º critério (razão de pontos) é necessário em produção agora, ou pontos + razão de sets já bastam para o MVP? (assumindo os 3, por fidelidade.)

## Checkpoint 1.1/1.2 — conclusão (definições vivas no HML)

- **Classificação exibida:** view SQL `tournament_standings` (lida por `supabase-repo.getStandings` → `/api/.../standings` → `useTournamentStandings`). Hoje: `points = 3×vitórias`; `position = row_number() over (partition by tournament, group order by points desc, (sets_won-sets_lost) desc, sets_won desc)`. Sem pontos de game, sem desempate entre-empatados.
- **Classificados (auto-avanço):** função SQL `tournament_group_standings(p_tournament, p_group_id)` (`language sql`), usada pelo `tournament_auto_advance_group` (reescrito no Bloco A) para promover os top N. Mesmo critério simplificado (`points desc, saldo desc, sets_won desc`).
- **Implicação:** o desempate ITTF + pontos 2/1/0 + pontos de game precisam entrar **nesses dois pontos SQL** para exibição e auto-avanço concordarem. **Porém**, o desempate ITTF é **progressivo/recursivo** (fixa subconjunto distinto, recomeça entre os restantes) — inexprimível numa view (single SELECT) e difícil/arriscado em PL/pgSQL. Isso força uma **decisão de arquitetura** (ver abaixo).

## Decisão de arquitetura (onde mora o desempate) — RESOLVIDO: opção B

Duas saídas coerentes (a híbrida foi rejeitada por causar divergência exibição × classificados):
- **A) Tudo em SQL:** transformar `tournament_standings` (view→função RPC) e `tournament_group_standings` para chamar um helper PL/pgSQL com o desempate progressivo; `getStandings` passa a chamar via RPC. Mantém o auto-avanço do Bloco A intacto. Custo: PL/pgSQL recursivo difícil, testável só em HML.
- **B) Tudo em TS (fonte única testável):** `getStandings` calcula no TS via `computeGroupStandings`; e a decisão de classificados sai do SQL para a action (ao fechar o grupo, calcula no TS e grava os slots do mata-mata, inclusive avanço por bye). Custo: refatorar o fluxo de auto-avanço (toca a lógica de byes do Bloco A). Ganho: uma só implementação, 100% coberta por Vitest, sem divergência.

**Decisão do usuário: B (fonte única no TS).** Implementado:
- `supabase-repo.getStandings` calcula no TS (`computeGroupStandings`) — commit b68e334 (3.4a).
- `supabase-repo.advanceGroupQualifiers` decide os classificados no TS (ITTF/CBTM) e grava os slots do KO, incl. avanço por BYE; chamado em `reportResult`/`walkover`/`closeGroupStage` (3.4b).
- Auto-avanço SQL (`tournament_auto_advance_group`) vira NO-OP idempotente — migration `20260701000100_tournament_auto_advance_group_noop.sql` (⚠️ validar em HML, aplicar à mão; não aplicar em prod automaticamente).
