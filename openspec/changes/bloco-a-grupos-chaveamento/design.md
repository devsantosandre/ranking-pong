## Context

A fase de grupos é montada em `GroupsTab` (`src/app/admin/torneios/[id]/page.tsx`, ~L1011). Hoje: `numGroups` limitado a `min(floor(confirmados/2), 8)`, e o nº de classificados precisa ser potência de 2 (`total & (total-1) === 0`) ou a UI bloqueia. A semeadura snake já existe em `computePreview` (1 forte por grupo, serpenteando). A geração de bracket é feita por `repo.generateBracket(method)` chamada em `configureGroups` (`src/app/actions/tournaments.ts`).

Regras oficiais (ver `docs/ESTUDO_DISTRIBUICAO_GRUPOS_ITTF_CBTM.md`): snake (ITTF 3.6), classificados→KO (ITTF 3.7: G1→topo, G2→fundo, 1º/2º do mesmo grupo em metades opostas), byes uniformes nos melhores seeds, CBTM (grupos 3–4, top 2). `buildStandardOrder(n)` em `seeding.ts` já produz a ordem espelhada que posiciona byes nos seeds altos.

## Goals / Non-Goals

**Goals:**
- `planGroupSizes(n)` determinístico, grupos 2/3/4 pref. 3, top 2 avançam.
- Snake (ITTF 3.6) reaproveitando a lógica existente; separação por clube como critério secundário.
- `seedQualifiersIntoBracket` (ITTF 3.7) + byes corretos, com testes Vitest escritos primeiro.
- UI sem o teto de 8 e sem a trava de potência de 2; resumo de grupos/classificados/byes.

**Non-Goals:**
- Desempate dentro do grupo (Bloco B), inscrição/pagamento (Bloco C), remoção em massa (Bloco D).
- Mudança de schema (meta: zero).

## Decisions

- **`planGroupSizes` por faixa `ceil(n/4)..floor(n/3)`**, escolhendo o maior `g` (mais grupos de 3); fora da faixa, permite um grupo de 2. Alternativa descartada: `round(n/3)` puro — pode gerar grupos de 2 desnecessários (ex.: 20→7 grupos com um de 2 em vez de 6 grupos 4/3).
- **Default determinístico (snake puro)** em vez do snake modificado com sorteio (ITTF 3.6.2). Por quê: previsibilidade/auditoria para torneio amador e cliente; o sorteio oficial fica como opção futura (semente reproduzível). Separação por clube aplicada sem violar a precedência do 1º/2º em metades opostas.
- **Top 2 fixo** (CBTM) em vez do `spots` derivado do tamanho do grupo (lógica atual). Simplifica e segue o padrão.
- **Reusar `buildStandardOrder`** para posicionar classificados e byes, em vez de um novo algoritmo de bracket — já entrega 1→topo, 2→fundo e bye nos seeds altos.
- **Investigar onde mora o emparelhamento grupo→KO antes de codar** (TS vs RPC SQL). Decisão de onde aplicar o ITTF 3.7 depende disso — é a primeira task.

## Risks / Trade-offs

- [Emparelhamento grupo→KO pode estar em RPC SQL] → primeira task investiga; se SQL, criar migration (não aplicar em prod) ou mover ordenação para o TS.
- [Snake determinístico difere do sorteio oficial ITTF 3.6.2] → aceitável; documentado; sorteio fica como evolução. Ajuste manual sempre disponível no `GroupDistributionBoard`.
- [Remover trava de potência de 2 pode expor bug de bye no bracket] → coberto por `seeding.test.ts` (ex.: 12 classificados → KO 16, 4 byes nos seeds 1–4) antes da UI.
- [Grupo de 2 quando top 2 avançam = todos passam] → sinalizar na UI; válido pela regra.

## Migration Plan

- Sem migration prevista. Caso o checkpoint revele emparelhamento em RPC SQL, criar arquivo de migration idempotente em `supabase/migrations/` e **não aplicar em prod** (usuário aplica). Rollback: a UI antiga é tolerante; mudanças são aditivas no TS.

## Open Questions

- ~~O emparelhamento grupo→KO é TS ou RPC SQL?~~ **RESOLVIDO (checkpoint 1.1).** Ver abaixo.
- O cliente quer o sorteio oficial (ITTF 3.6.2) já, ou o default determinístico basta para o MVP? (assumindo determinístico)

## Checkpoint 1.1/1.2 — conclusão da investigação

**1.1 — Onde mora a montagem grupo→KO: é RPC SQL.**
- Fluxo: `configureGroups` (action, `src/app/actions/tournaments.ts:218`) → `repo.saveSeeding` (persiste `group_id`) → `repo.generateBracket` (`src/lib/tournaments/repo/supabase-repo.ts:107`) → **RPC `generate_bracket`**.
- A RPC vive em `supabase/migrations/20260622000000_tournament_engine_v2.sql`, branch `groups_knockout` (L400–551). Lá:
  - `v_spots := ceil(v_group_size/2)` — **vagas derivadas do tamanho do grupo**, não top-2 fixo.
  - `v_total_class` **precisa ser potência de 2**, senão `raise exception` (L427–432) — é a trava.
  - **Não há tratamento de byes** na branch de grupos (o skeleton assume `v_total_class` = potência de 2).
  - O emparelhamento cross-group (ITTF 3.7-ish: vencedor no topo, 2º na metade oposta) já existe via `v_seed_groups`/`v_seed_ranks` gravados em `tournament_group_slots`; `close_group_stage`/`tournament_auto_advance_group` promovem os classificados nesses slots.
- **Decisão:** o ITTF 3.7 + byes + top-2 fixo + remoção da trava entram **numa migration idempotente** que reescreve a branch `groups_knockout` de `generate_bracket` (task 3.5). Migration criada mas **NÃO aplicada em prod** (usuário aplica). As helpers TS (`planGroupSizes`, `seedQualifiersIntoBracket`, byes) são a **lógica normativa testada** (Vitest) e alimentam o preview/resumo da UI; a produção do bracket permanece no SQL, espelhando as mesmas regras.

**1.2 — Semeadura snake e persistência.**
- A distribuição snake é feita em TS em `computePreview(n)` (`src/app/admin/torneios/[id]/page.tsx:1031`): ordena confirmados por `seed` e serpenteia em `n` grupos (rótulos A, B, C…). O `GroupDistributionBoard` permite ajuste manual.
- `handleConfigureGroups` monta `{ participantId, groupId }` e chama `configureGroups`, que persiste `group_id` via `saveSeeding` mantendo o `seed` já gravado, e então gera o bracket. Ou seja, o `seed` de cada jogador já vem definido antes (aba de seeding); a fase de grupos só atribui `group_id`.
