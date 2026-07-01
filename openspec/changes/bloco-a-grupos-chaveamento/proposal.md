## Why

A montagem de grupos do torneio hoje trava em **no máximo 8 grupos** e exige que o número de classificados seja **potência de 2**, o que impede campos grandes (ex.: 100 inscritos) e o padrão oficial de grupos pequenos. Precisamos dimensionar e semear grupos e montar o mata-mata seguindo as regras **ITTF (3.6/3.7)** e **CBTM**, com o motor do torneio sólido antes de qualquer trabalho de inscrição. Base normativa: `docs/PLANO_TORNEIOS_GRUPOS_E_INSCRICAO.md` (Bloco A) e `docs/ESTUDO_DISTRIBUICAO_GRUPOS_ITTF_CBTM.md`.

## What Changes

- Novo módulo `src/lib/tournaments/group-planner.ts` com `planGroupSizes(n)`: grupos de **2/3/4 preferindo 3**, **top 2** avançam.
- Semeadura **snake/serpentina** (ITTF 3.6) na distribuição em grupos (1 jogador forte por grupo), determinística por padrão, com **separação por associação/clube** como critério secundário.
- Montagem do mata-mata a partir dos grupos (ITTF 3.7): vencedor do grupo 1 → topo, grupo 2 → fundo, etc.; **1º e 2º do mesmo grupo em metades opostas**; helper `seedQualifiersIntoBracket` em `seeding.ts`.
- **Byes** (ITTF): quando o nº de classificados (`2 × nº de grupos`) não é potência de 2, completar o bracket com byes nos **melhores seeds**, via `buildStandardOrder`.
- **BREAKING (comportamento de UI):** `GroupsTab` (`src/app/admin/torneios/[id]/page.tsx`) **remove o teto de 8 grupos** e a **exigência de potência de 2**; pré-seleciona `planGroupSizes(n)`; exibe resumo "X grupos · Y de 3 e Z de 4 · W classificados → KO de N (B byes)"; mantém o `GroupDistributionBoard` para ajuste manual.

## Capabilities

### New Capabilities
- `tournament-groups`: composição da fase de grupos — dimensionamento (`planGroupSizes`, 2/3/4 pref. 3, top 2) e semeadura snake (ITTF 3.6) com separação por associação.
- `tournament-knockout-draw`: chaveamento dos classificados dos grupos no mata-mata (ITTF 3.7) e distribuição de byes nos melhores seeds.

### Modified Capabilities
<!-- Nenhuma: ainda não há specs em openspec/specs/. As duas acima são novas. -->

## Impact

- **Código:** novo `src/lib/tournaments/group-planner.ts`; ajustes em `src/lib/tournaments/seeding.ts` (`seedQualifiersIntoBracket`, byes); UI em `src/app/admin/torneios/[id]/page.tsx` (`GroupsTab`); `src/components/tournaments/group-distribution-board.tsx` mantido.
- **Checkpoint a investigar no início:** confirmar se a classificação e o emparelhamento grupo→KO são calculados no TS (`computeGroupStandings`/`seeding.ts`) ou em RPC SQL (`src/lib/tournaments/repo/supabase-repo.ts` / migrations) — o chaveamento ITTF precisa entrar onde a ordenação realmente acontece.
- **Schema/migrations:** idealmente **zero**. Se o emparelhamento estiver em RPC SQL, avaliar ajuste (criar migration; **não aplicar em prod**).
- **Testes:** novos `group-planner.test.ts` e casos em `seeding.test.ts` (Vitest), escritos **antes** da implementação (test-first).

## Non-goals

- Inscrição, formulário, pagamento, Mercado Pago (Bloco C).
- Desempate/classificação dentro do grupo — critérios ITTF (Bloco B).
- Remoção em massa de jogadores (Bloco D).
- Mudanças de schema além do estritamente necessário (meta: nenhuma).
