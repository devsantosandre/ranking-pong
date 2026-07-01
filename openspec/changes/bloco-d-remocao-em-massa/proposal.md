## Why

Hoje o admin só remove inscritos **um a um** (o `X` no hover de cada card). Ao preparar torneios reais com o cliente — dezenas de inscritos, correções de lista, no-shows — isso é lento e propenso a erro. O Bloco D fecha a Fase 1 (motor A→B→D) dando **remoção em lote**, o que agiliza os testes com o cliente antes da inscrição nativa (Fase 2).

## What Changes

- **Modo seleção na aba Inscritos:** botão "Selecionar" que alterna um modo em que cada card mostra um **checkbox**; cabeçalho ganha "Selecionar todos" e contador "N selecionados".
- **Remoção em lote:** botão "Remover selecionados" abre um `ConfirmModal` (obrigatório pelo padrão do projeto) informando quantos serão removidos; ao confirmar, remove todos de uma vez.
- **Remoção avulsa preservada:** o `X` individual no hover continua funcionando.
- **Nova server action `removeParticipants(participantIds, tournamentId)`** com `assertAdmin` + `logAdmin`, bloqueando quando o torneio está `active`/`finished` (mesma regra do remove individual).
- **Novo método de repo `removeParticipants`** (batch: `delete ... where id = any($ids)`) no `supabase-repo` e no `mock-repo`, evitando N round-trips.
- **Sem migration** — só server action/repo/UI.

## Capabilities

### New Capabilities
- `tournament-participant-removal`: seleção múltipla e remoção em lote de inscritos pelo admin, com confirmação e as mesmas travas de estado do torneio da remoção individual.

### Modified Capabilities
<!-- Nenhuma: não há spec pré-existente cujo requisito mude. -->

## Impact

- `src/app/admin/torneios/[id]/page.tsx` — estado de seleção + UI de checkbox/modo seleção + `ConfirmModal`.
- `src/app/actions/tournaments.ts` — nova action `removeParticipants`.
- `src/lib/tournaments/repo/tournament-repo.ts` — assinatura `removeParticipants`.
- `src/lib/tournaments/repo/supabase-repo.ts` e `tests/helpers/mock-repo.ts` — implementação batch.
- Sem mudança de schema/migration. Fonte travada: `docs/PLANO_TORNEIOS_GRUPOS_E_INSCRICAO.md` (Bloco D, D.1–D.4).
