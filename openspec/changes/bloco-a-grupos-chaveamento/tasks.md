## 1. Investigação (checkpoint)

- [x] 1.1 Confirmar onde mora a montagem grupo→KO: TS (`computeGroupStandings`/`seeding.ts`/`generateBracket`) ou RPC SQL em `src/lib/tournaments/repo/supabase-repo.ts` / migrations. Registrar a conclusão no `design.md` (Open Questions). → **RPC SQL** (`generate_bracket`).
- [x] 1.2 Confirmar o ponto de entrada da semeadura de grupos (`computePreview` no `GroupsTab`) e como `configureGroups`/`saveSeeding` persistem `group_id`/`seed`. → snake em `computePreview` (TS); `configureGroups` persiste `group_id` via `saveSeeding`.

## 2. Testes primeiro (test-first)

- [x] 2.1 `tests/unit/group-planner.test.ts`: tabela de aceite de `planGroupSizes` — 8→[4,4]; 12→[3,3,3,3]; 20→[4,4,3,3,3,3]; 24→[3×8]; 30→[3×10]; 100→[4 + 3×32]; 5→tamanhos em {2,3} somando 5; e `classificados = 2×g`.
- [x] 2.2 `tests/unit/seeding.test.ts`: byes (`byeSeeds`) — 12 classificados → bracket 16 com byes nos seeds 1–4; 1 bye → seed 1; `Q` potência de 2 → 0 byes.
- [x] 2.3 `tests/unit/seeding.test.ts`: `seedQualifiersIntoBracket` — vencedor do grupo 1→topo, grupo 2→fundo (metades opostas); 1º e 2º do mesmo grupo em metades opostas; + `tests/unit/groups-knockout-byes.test.ts` (fluxo mock end-to-end).
- [x] 2.4 `tests/unit/group-planner.test.ts`: `snakeGroups` — 24 em 8 grupos → seeds 1–8 em grupos distintos, 9–16 na ordem inversa; determinismo.

## 3. Implementação — lógica

- [x] 3.1 Criar `src/lib/tournaments/group-planner.ts` com `planGroupSizes(n)` até os testes 2.1 passarem.
- [x] 3.2 Implementar/ajustar byes em `seeding.ts` (`byeSeeds`, reusa `buildStandardOrder`/`nextPowerOfTwo`) até 2.2 passar.
- [x] 3.3 Implementar `seedQualifiersIntoBracket` em `seeding.ts` (ITTF 3.7) até 2.3 passar.
- [x] 3.4 Extrair a semeadura snake para `snakeGroups` em `group-planner.ts` (helper testável) e ligar 2.4.
- [x] 3.5 Aplicar a montagem grupo→KO: (a) motor TS testável = `tests/helpers/mock-repo.ts` (`buildKnockoutSkeleton` top-2 fixo + byes + auto-avanço); (b) migration idempotente `generate_bracket` mirror — **não aplicar em prod**.

## 4. Implementação — UI (GroupsTab)

- [x] 4.1 Invocar a skill `arena-design-pattern` antes de mexer na UI.
- [x] 4.2 Remover o teto de 8 grupos (`maxG` → `floor(n/2)`) e a exigência de potência de 2 (badges/avisos de "mata-mata incompleto" removidos).
- [x] 4.3 Trocar `spots` derivado por **top 2 fixo**; pré-selecionar `planGroupSizes(n).length` (badge "sugestão").
- [x] 4.4 Exibir o resumo "X grupos · Y de 3 e Z de 4 · W classificados → mata-mata de N (B byes)".
- [x] 4.5 Sinalizar grupo de 2 (todos avançam) e manter o `GroupDistributionBoard`; `computePreview` reusa `snakeGroups`.

## 5. Verificação

- [x] 5.1 Rodar `vitest` — 130 testes verdes (inclui `group-planner`, `seeding`, `groups-knockout-byes`).
- [x] 5.2 `npm run lint` (0 erros nos arquivos tocados; 1 erro pré-existente em `tv-bracket-view.tsx`, fora do escopo) e `npm run build` (✓ Compiled successfully).
- [x] 5.3 Validação em HML (PostgreSQL 15.8, via túnel psql): migration aplicada; helper bate 100% com o ground truth TS; E2E 20 jogadores/6 grupos → 24 grupo + 15 KO + 12 slots + 4 byes; auto-avanço por bye confirmado. **Corrigiu bug pré-existente do skeleton (id duplicado).** Smoke VISUAL no admin pendente do usuário.
- [x] 5.4 `openspec validate bloco-a-grupos-chaveamento` → válido; `design.md` atualizado com o checkpoint 1.1/1.2.
