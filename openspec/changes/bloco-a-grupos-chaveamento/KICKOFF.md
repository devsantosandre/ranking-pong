# Kickoff — Implementação do Bloco A (grupos + chaveamento ITTF/CBTM)

> **Para retomar numa sessão nova (economizar tokens):** cole este prompt:
> *"Implementar o Bloco A. Leia `openspec/changes/bloco-a-grupos-chaveamento/KICKOFF.md` e siga as etapas, começando pelo checkpoint 1.1 com TDD."*
>
> Não é preciso reler as conversas anteriores — tudo que importa está aqui + nos artefatos do change.

## Onde estamos
- Branch: **develop**. App Next.js 16 + TypeScript + Supabase; testes em **Vitest** (`vitest.config.mts`).
- Change OpenSpec **`bloco-a-grupos-chaveamento`** já criado e **válido** (proposal + design + specs + tasks).
- Fonte narrativa (referência, não reescrever): `docs/PLANO_TORNEIOS_GRUPOS_E_INSCRICAO.md` (Bloco A) e `docs/ESTUDO_DISTRIBUICAO_GRUPOS_ITTF_CBTM.md`.
- Specs normativos (o "o quê", já em formato de teste):
  - `openspec/changes/bloco-a-grupos-chaveamento/specs/tournament-groups/spec.md`
  - `openspec/changes/bloco-a-grupos-chaveamento/specs/tournament-knockout-draw/spec.md`
- Tarefas: `openspec/changes/bloco-a-grupos-chaveamento/tasks.md`.

## Regras que valem para TODAS as etapas
- **Test-first** nos blocos de lógica: escrever o teste (vermelho) antes do código.
- **UI:** invocar a skill `arena-design-pattern` ANTES de mexer em qualquer tela; cor só via tokens CSS (`--arena-*`/`--state-*`), `ArenaShell`/`GlassCard`, Tailwind v4 `text-(--token)`.
- Ação de impacto → `ConfirmModal`.
- **Migrations:** apenas CRIAR arquivo; **NUNCA aplicar em prod** (o usuário aplica).
- **Nunca commitar/push na main** sem aprovação explícita. Trabalhar na develop; commitar por etapa só com aval.
- Idioma: PT-BR.

## Etapas (o quê) × Skills (com o quê)

### Etapa 0 — Carregar o plano de execução
- **Skill:** `opsx:apply` (ou `openspec-apply-change`) — carrega o change e dirige o `tasks.md`, marcando progresso.
- Alternativa de disciplina: `superpowers:executing-plans`.

### Etapa 1 — Checkpoint técnico (tasks 1.1–1.2)
- **O quê:** descobrir se o emparelhamento **grupo→mata-mata** e a **classificação** são calculados no **TS** (`src/lib/tournaments/seeding.ts`, `standings.ts`, `repo/*generateBracket`) ou numa **RPC SQL** (`src/lib/tournaments/repo/supabase-repo.ts` + `supabase/migrations/`). Isso decide ONDE o chaveamento ITTF 3.7 entra.
- Também confirmar o ponto de entrada da semeadura (`computePreview` no `GroupsTab`) e como `configureGroups`/`saveSeeding` persistem `group_id`/`seed`.
- **Skill:** nenhuma especial (leitura/grep). Registrar a conclusão no `design.md` (seção Open Questions).

### Etapa 2 — Testes vermelhos primeiro (tasks 2.1–2.4)
- **Skill:** `superpowers:test-driven-development` (RED → GREEN → REFACTOR).
- Arquivos:
  - `src/lib/tournaments/group-planner.test.ts` — `planGroupSizes`: **8→[4,4]; 12→[3,3,3,3]; 20→[4,4,3,3,3,3]; 24→[3×8]; 30→[3×10]; 100→[4 + 3×32]; 5→{2,3} somando 5;** e `classificados = 2×g`.
  - `src/lib/tournaments/seeding.test.ts` — byes: **12 classificados → bracket 16, byes nos seeds 1–4; 1 bye → seed 1; Q potência de 2 → 0 byes**; e `seedQualifiersIntoBracket`: **G1→topo, G2→fundo; 1º e 2º do mesmo grupo em metades opostas**.

### Etapa 3 — Implementar a lógica até o verde (tasks 3.1–3.5)
- **Skill:** `superpowers:test-driven-development`; se algum teste travar, `superpowers:systematic-debugging`.
- `src/lib/tournaments/group-planner.ts` → `planGroupSizes(n)` (faixa `ceil(n/4)..floor(n/3)`, maior g; grupo de 2 só quando necessário).
- `seeding.ts` → byes via `buildStandardOrder`/`countByes`; `seedQualifiersIntoBracket` (ITTF 3.7).
- (Opcional) extrair snake de `computePreview` para helper testável.
- Aplicar a montagem grupo→KO no ponto correto da Etapa 1 (se for SQL, migration idempotente — **não aplicar em prod**).

### Etapa 4 — UI da GroupsTab (tasks 4.1–4.5)
- **Skill (obrigatória antes de codar UI):** `arena-design-pattern`.
- Em `src/app/admin/torneios/[id]/page.tsx` (`GroupsTab`, ~L1011): remover teto de 8 grupos (`maxG`) e a trava de potência de 2; **top 2 fixo**; pré-selecionar `planGroupSizes(n)`; resumo "X grupos · Y de 3 e Z de 4 · W classificados → KO de N (B byes)"; sinalizar grupo de 2; manter `GroupDistributionBoard`.

### Etapa 5 — Verificação e fechamento (tasks 5.1–5.4)
- **Skill:** `superpowers:verification-before-completion` (rodar comandos e confirmar saída antes de dizer "pronto").
- Comandos: `npx vitest run` (verde) · `npm run lint` · `npm run build` (ou `npx tsc --noEmit`).
- Smoke manual no admin: configurar grupos para 20 e 100 confirmados (resumo, snake, byes).
- `npx @fission-ai/openspec@latest validate bloco-a-grupos-chaveamento`.
- Revisão: skill `/code-review` no diff. Ao integrar: `superpowers:finishing-a-development-branch`.
- Arquivar o change quando concluído: `opsx:archive` (ou `openspec-archive-change`).

## Comandos úteis (referência rápida)
```bash
# status/artefatos do change
npx @fission-ai/openspec@latest status --change bloco-a-grupos-chaveamento
# testes
npx vitest run src/lib/tournaments
# qualidade
npm run lint && npm run build
```

## Definição de pronto (Bloco A)
- Todos os cenários dos 2 specs cobertos por testes verdes.
- `GroupsTab` sem travas, com resumo e byes; ajuste manual funcionando.
- lint + build limpos; checkpoint 1.1 registrado no `design.md`.
- Sem inscrição/pagamento/desempate (fora do escopo — Blocos B/C/D).
