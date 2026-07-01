## Why

A classificação da fase de grupos hoje ordena por um critério simplificado (**3 pontos por vitória → saldo de sets → sets ganhos**) e **não captura o placar de cada set**, então não há como aplicar o desempate **oficial ITTF/CBTM** quando dois ou mais jogadores empatam. Em torneio real isso decide quem avança ao mata-mata — precisa ser fiel à regra. Base normativa: `docs/PLANO_TORNEIOS_GRUPOS_E_INSCRICAO.md` (Bloco B) e ITTF Handbook 3.7.6.

## What Changes

- **Pontuação oficial:** trocar **3/vitória** por **2 por vitória, 1 por derrota disputada, 0 por W.O.** (em grupo completo a ordem por pontos é equivalente, mas isso trata W.O. corretamente e segue o padrão).
- **Captura set-a-set:** nos jogos de **grupo**, o `ScoreSheet` passa a gravar o placar de cada set em `tournament_matches.sets` (`Array<[a,b]>`); o mata-mata continua só com sets ganhos.
- **Desempate ITTF (progressivo):** havendo empate de pontos entre 2+ jogadores, considerar **apenas os jogos entre os empatados**, na ordem: (1) pontos de vitória → (2) razão de sets (ganhos/perdidos) → (3) razão de pontos de game (ganhos/perdidos). Assim que um subconjunto se distingue, ele é fixado e o processo recomeça entre os que seguem empatados (recursivo).
- **`GroupStanding`** ganha campos derivados em memória (`gamePointsWon`/`gamePointsLost`) e a UI da classificação exibe **pontos de game** e sinaliza quando a posição foi decidida por desempate.
- **BREAKING (comportamento):** a ordenação da classificação e a definição dos classificados mudam (novo critério oficial).

## Capabilities

### New Capabilities
- `tournament-tiebreak`: classificação da fase de grupos com pontuação oficial (2/1/0), captura de placar set-a-set e desempate progressivo ITTF/CBTM (pontos → razão de sets → razão de pontos, só entre os empatados).

### Modified Capabilities
<!-- Nenhuma: as specs do Bloco A ainda não foram arquivadas em openspec/specs/. A capability acima é nova. -->

## Impact

- **Código (TS):** `src/lib/tournaments/standings.ts` (reescrita de `computeGroupStandings` + `breakTies` recursivo + `GroupStanding` com pontos de game); `src/components/tournaments/score-sheet.tsx` (inputs de placar por set em jogos de grupo); `src/app/actions/tournaments.ts` (validação set-a-set no `reportResult`); `src/components/tournaments/standings-table.tsx` e `GroupsTab` (exibir pontos de game + indicar desempate).
- **Checkpoint a investigar no início (como no Bloco A):** a classificação **exibida** vem da view SQL `tournament_standings` e os **classificados** que avançam saem de `tournament_group_standings` (usada por `tournament_auto_advance_group`) — não do TS. O desempate ITTF precisa entrar **onde a ordenação realmente acontece** (view + função SQL), espelhado no TS/mock. Se for SQL, criar migration idempotente — **não aplicar em prod**.
- **Schema/migrations:** **zero** de schema (coluna `sets jsonb` já existe). Eventual migration só reescreve view/função de ordenação.
- **Testes:** novos cenários em `standings.test.ts` (empate duplo/triplo/quádruplo, W.O., sets nulos) escritos **antes** (test-first). `mock-repo`/`tournament_group_standings` devem refletir o mesmo desempate para o auto-avanço.

## Non-goals

- Mata-mata (sem mudança de critério — segue só sets ganhos).
- Inscrição/pagamento (Bloco C) e remoção em massa (Bloco D).
- Mudança de schema além de reescrever a ordenação (meta: nenhuma).
