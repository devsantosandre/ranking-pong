## Context

A aba **Inscritos** (`src/app/admin/torneios/[id]/page.tsx`) lista os participantes e já permite remoção individual via `removeParticipant(participantId, tournamentId)` (action) → `repo.removeParticipant(participantId)` (delete single). O padrão do projeto exige `ConfirmModal` em ações de impacto e UI via `arena-design-pattern` (GlassCard, tokens CSS, sem cor crua). O plano travado (`docs/PLANO_TORNEIOS_GRUPOS_E_INSCRICAO.md`, Bloco D) especifica seleção múltipla + remoção em lote, mantendo a remoção avulsa.

O repo é uma interface (`TournamentRepo`) com duas implementações: `supabaseRepo` (produção, `delete ... where id = any($ids)`) e `mockRepo` (testes/dev, estado em `globalThis`). A remoção individual já bloqueia implicitamente pelo fluxo admin; o plano pede bloquear remoção quando o torneio está `active`/`finished`.

## Goals / Non-Goals

**Goals:**
- Selecionar vários inscritos e removê-los de uma vez, com `ConfirmModal` mostrando a contagem.
- `removeParticipants(ids)` em lote no repo (uma query), na action (`assertAdmin` + `logAdmin`) e nas duas implementações.
- Preservar a remoção individual (`X` no hover).
- Bloquear remoção (lote e, por consistência, individual) quando `status ∈ {active, finished}`.

**Non-Goals:**
- Nenhuma migration/mudança de schema.
- Não mexer na geração de chave, seeding ou grupos.
- Inscrição nativa (Bloco C) e pagamento — fora de escopo.

## Decisions

- **Batch no repo, não N chamadas.** `removeParticipants(ids: string[])` faz um único `delete ... in (...)` no Supabase e um único filtro no mock. A action antiga `removeParticipant` continua existindo (remoção avulsa). Alternativa descartada: fazer o loop chamando `removeParticipant` N vezes — N round-trips, pior UX/custo.
- **Modo seleção é estado local da aba**, não persistido. Botão "Selecionar" alterna `selectionMode`; um `Set<string>` guarda os `participantId` marcados; "Selecionar todos" preenche/limpa o set; sair do modo limpa a seleção.
- **Trava de estado na action** (`active`/`finished` → erro), não só na UI, para não depender do cliente. A UI também esconde/desabilita o modo seleção quando o torneio não permite (mesma regra visual do `X` individual).
- **Confirmação obrigatória** via `ConfirmModal` existente (`components/ui/confirm-modal.tsx`), texto com a contagem ("Remover N inscritos? Esta ação não pode ser desfeita.").
- **Test-first** na camada repo/action com o `mockRepo`: cobrir remoção de vários ids, ids inexistentes (no-op parcial), e a trava de estado.

## Risks / Trade-offs

- **[Seleção órfã após remoção]** ids removidos podem continuar no `Set` de seleção → limpar a seleção e sair do modo após sucesso. Mitigação simples no handler.
- **[Trava de estado divergente]** o remove individual hoje não checa `status` explicitamente; adicionar a checagem no lote (e alinhá-la no individual) evita comportamento inconsistente. Trade-off: leve mudança no remove individual, coberta por teste.
- **[Remoção em massa é destrutiva]** mitigada pelo `ConfirmModal` obrigatório com contagem; sem soft-delete (fora de escopo, igual ao remove atual).
