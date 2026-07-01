## 1. Testes primeiro (test-first) — camada repo/action

- [x] 1.1 Teste (mock): `removeParticipants([id1, id2])` remove ambos numa chamada e mantém os demais.
- [x] 1.2 Teste (mock): `removeParticipants` com um id inexistente remove os válidos e não lança.
- [x] 1.3 Teste: a remoção **em lote** é **bloqueada** quando o torneio está `active`/`finished` (erro), e **permitida** em `draft`/`registration`.
- [x] 1.4 Teste: após remover em lote, os seeds dos remanescentes seguem coerentes (sem buraco), como no remove individual.

## 2. Repo — método em lote

- [x] 2.1 `TournamentRepo.removeParticipants(participantIds: string[]): Promise<void>` na interface (`tournament-repo.ts`).
- [x] 2.2 `supabase-repo`: `delete ... where id = any($ids)` numa query só.
- [x] 2.3 `mock-repo`: remove todos os ids do estado e renumera seeds (mesma regra do `removeParticipant`).

## 3. Action

- [x] 3.1 `removeParticipants(participantIds, tournamentId)` em `actions/tournaments.ts` com `assertAdmin` + `logAdmin("tournament_remove_participants", { count })` + `invalidateTournament`.
- [x] 3.2 Trava por estado no lote: rejeitar quando `status ∈ {active, finished}` (na camada repo, testada). Individual segue guardado pela UI (X oculto quando active/finished).

## 4. UI — aba Inscritos (skill arena-design-pattern)

- [x] 4.1 Invocar a skill `arena-design-pattern` antes de mexer na UI.
- [x] 4.2 Estado local: `selectionMode` + `Set<string>` de selecionados; botão "Selecionar" alterna o modo; sair limpa a seleção.
- [x] 4.3 Card em modo seleção: checkbox por inscrito (tokens/GlassCard); cabeçalho com "Selecionar todos" + contador "N selecionados".
- [x] 4.4 Botão "Remover selecionados" → `ConfirmModal` com a contagem; ao confirmar chama a action, limpa seleção e sai do modo.
- [x] 4.5 Preservar o `X` individual no hover fora do modo seleção; esconder/desabilitar seleção quando `status ∈ {active, finished}`.

## 5. Verificação

- [x] 5.1 `npx vitest run` — cenários 1.x verdes.
- [x] 5.2 `npm run lint` + `npx tsc --noEmit` limpos nos arquivos tocados; grep §3.1 (tokens) limpo na UI.
- [x] 5.3 `npm run build` sem erros.
- [x] 5.4 `openspec validate bloco-d-remocao-em-massa` ok.
- [ ] 5.5 Smoke manual: entrar no modo seleção, marcar vários, remover com confirmação; conferir remoção avulsa ainda funciona.
