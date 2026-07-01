## 1. Investigação (checkpoint)

- [ ] 1.1 Confirmar onde mora a montagem grupo→KO: TS (`computeGroupStandings`/`seeding.ts`/`generateBracket`) ou RPC SQL em `src/lib/tournaments/repo/supabase-repo.ts` / migrations. Registrar a conclusão no `design.md` (Open Questions).
- [ ] 1.2 Confirmar o ponto de entrada da semeadura de grupos (`computePreview` no `GroupsTab`) e como `configureGroups`/`saveSeeding` persistem `group_id`/`seed`.

## 2. Testes primeiro (test-first)

- [ ] 2.1 `src/lib/tournaments/group-planner.test.ts`: tabela de aceite de `planGroupSizes` — 8→[4,4]; 12→[3,3,3,3]; 20→[4,4,3,3,3,3]; 24→[3×8]; 30→[3×10]; 100→[4 + 3×32]; 5→tamanhos em {2,3} somando 5; e `classificados = 2×g`.
- [ ] 2.2 `src/lib/tournaments/seeding.test.ts`: byes — 12 classificados → bracket 16 com byes nos seeds 1–4; 1 bye → seed 1; `Q` potência de 2 → 0 byes.
- [ ] 2.3 `src/lib/tournaments/seeding.test.ts`: `seedQualifiersIntoBracket` — vencedor do grupo 1→topo, grupo 2→fundo; 1º e 2º do mesmo grupo em metades opostas.
- [ ] 2.4 (se houver helper de snake extraído) teste de snake: 24 em 8 grupos → seeds 1–8 em grupos distintos, 9–16 na ordem inversa; determinismo.

## 3. Implementação — lógica

- [ ] 3.1 Criar `src/lib/tournaments/group-planner.ts` com `planGroupSizes(n)` até os testes 2.1 passarem.
- [ ] 3.2 Implementar/ajustar byes em `seeding.ts` (reusar `buildStandardOrder`/`countByes`) até 2.2 passar.
- [ ] 3.3 Implementar `seedQualifiersIntoBracket` em `seeding.ts` (ITTF 3.7) até 2.3 passar.
- [ ] 3.4 (Opcional) Extrair a semeadura snake de `computePreview` para helper testável e ligar 2.4.
- [ ] 3.5 Aplicar a montagem grupo→KO no ponto correto identificado em 1.1 (TS ou, se for SQL, criar migration idempotente — **não aplicar em prod**).

## 4. Implementação — UI (GroupsTab)

- [ ] 4.1 Invocar a skill `arena-design-pattern` antes de mexer na UI.
- [ ] 4.2 Remover o teto de 8 grupos (`maxG`) e a exigência de potência de 2 (avisos/badges de "mata-mata incompleto").
- [ ] 4.3 Trocar `spots` derivado por **top 2 fixo**; pré-selecionar `planGroupSizes(n).length`.
- [ ] 4.4 Exibir o resumo "X grupos · Y de 3 e Z de 4 · W classificados → KO de N (B byes)".
- [ ] 4.5 Sinalizar grupo de 2 (todos avançam) e manter o `GroupDistributionBoard` para ajuste manual.

## 5. Verificação

- [ ] 5.1 Rodar `vitest` — todos os testes 2.x verdes.
- [ ] 5.2 `npm run lint` e `npm run build` sem erros.
- [ ] 5.3 Smoke manual no admin: configurar grupos para 20 e 100 confirmados; conferir resumo, distribuição snake e bracket com byes.
- [ ] 5.4 `openspec validate bloco-a-grupos-chaveamento` ok; atualizar `design.md` com a conclusão do checkpoint 1.1.
