# 12 — Estado Atual & Próximos Passos

> **Fonte da verdade** do que já existe no código vs. o que falta. Atualizado em 2026-06-18.
> Substitui o status "FASE DE ESTUDO — nada implementado" dos docs originais: **F0 e F1 feitos, F2 bem avançado, Categorias (divisões) implementadas.**
>
> Tudo vive na branch `novo-app`, desenvolvido **mock-first**. Migrations existem **só em arquivo** — nunca aplicadas em HML/PROD (ver [`regra-nunca-aplicar-prod`]).

---

## 1. Legenda
✅ feito e funcional · 🚧 parcial / a validar · ⬜ não iniciado

---

## 2. Fundação Arena (F0) — ✅

- ✅ Todas as telas no route group `src/app/(arena)/`: home, ranking, partidas, perfil (+configurações), temporadas, regras, notícias, mais, registrar-jogo.
- ✅ Tokens Arena no `globals.css`; **tema light pronto**, dark preservado em `.arena.dark{}`. Superfície sólida `--popover` para modais (light/dark).
- ✅ Primitivos: `arena-shell`, `glass-card`, `status-pill`, `ambient-glows`, `champion-celebration`.
- ⬜ **Toggle de dark mode** — tokens dark existem, o switch ainda não foi ligado.

---

## 3. Módulo Torneios (F1 + boa parte do F2) — ✅ mock-first

### Dados & motor
- ✅ `lib/tournaments/types.ts` — domínio completo; `format-meta.ts` com **9 formatos definidos**.
- ✅ Camada de dados plugável (`NEXT_PUBLIC_DATA_SOURCE`): `tournament-repo.ts` (interface), `mock-repo.ts` (completo, **default**), `supabase-repo.ts` (escrito, 🚧 nunca rodado contra banco).
- ✅ Migrations **em arquivo**: `tournaments`, `tournament_rpcs`, `tournament_realtime`, `tournament_events` — 🚧 **não aplicadas**.
- ✅ Algoritmos: `bracket-layout`, `seeding` (standard/elo/sequential/manual + `buildStandardOrder` exportado), `standings`, `win-probability`, `seed-colors`.

### Formatos com motor funcional ponta a ponta
- ✅ **Eliminatória simples** — BYEs **distribuídos** por seed (nunca confronto vazio) e que **avançam automaticamente**; aviso de nº não-redondo.
- ✅ **Grupos + mata-mata** (round-robin por grupo → `closeGroupStage` semeia o mata-mata; auto-avanço).
- ✅ **Round-robin puro** — todos×todos num grupo único; classificação é a tabela; campeão = líder.
- ✅ **Rei da mesa**.
- 🚫 **Scorecard** descartado (round-robin cobre "todos jogam + tabela").
- ⬜ Avançados (F4), **fora do leque de criação** até terem engine: dupla eliminação, suíço, americano, liga.
- ✅ **Leque de criação** mostra só formatos funcionais (elim. simples, round-robin, grupos+mata-mata, rei da mesa).

### UI
- ✅ **Admin** (`/admin/torneios`): lista unificada (torneios simples + com categorias), criar com escolha **Único / Com categorias**, gestão `[id]` com abas dinâmicas — **Inscritos · Seeds · Grupos\* · Chave · Placar**.
  - ✅ `participant-picker`, `seeding-board` (dnd), `group-distribution-board` (dnd + validação potência de 2 + seeds automáticos), `score-sheet`, `standings-table`.
  - ✅ Lançar **e corrigir** placar (editar/**desfazer**, padrão Challonge); **regerar chave**; chave em tela cheia com edição.
- ✅ **Público** (`/torneios`): lista (torneios + agrupadores), overview `[id]`, `/chave` (bracket realtime + edição p/ admin), `/grupos`, `/inscrever`, `/mesa/[matchId]` (Score@Table), `opengraph-image`.
- ✅ **Bracket**: `bracket-canvas` (pan), `bracket-connectors`, `match-card`, `participant-row`, `round-header`, `upset-badge`, `win-probability-bar`.
- ✅ **TV** (`/tv/torneio/[id]`): `tv-bracket-view`, `tv-king-view`.
- ✅ **Realtime + polling**: `use-realtime-bracket` (Supabase) + polling de 8s quando ao vivo (fallback p/ mock/multi-aba); invalidação ao lançar/corrigir.
- ✅ **API**: `/api/tournaments` (+ `[id]`, `/bracket`, `/standings`).

### Testes
- ✅ Unit: `bracket-layout`, `seeding`, `standings`, `win-probability`, `tournament-events`, `result-editing`, `bracket-byes` (+ `elo`, `divisions` do ranking). **85 testes.**
- ⬜ E2E de torneios (Playwright) ainda não escritos.

---

## 4. Categorias (antigas "Divisões") — ✅ implementado e unificado

Um **Torneio** contém uma ou mais **Categorias** (ex.: A/B/C por nível, ou Absoluto/Veteranos/Feminino). Cada categoria É um torneio independente → reusa 100% do motor (chave, RPCs, realtime, TV, abas admin, standings). Decisão validada com a indústria (USATT/ITTF; "categoria" é o termo BR mais familiar — ver `docs/ESTUDO_DIVISOES.md`).

- ✅ Modelo: `tournament_events` (o agrupador) + colunas `event_id`/`division_label`/`division_order` em `tournaments`. Torneio simples = `event_id null` (legado intacto).
- ✅ Criação unificada: `/admin/torneios/criar` → "Único" (avulso) ou "Com categorias" (agrupador).
- ✅ Hub do torneio multi-categoria (rota interna `/admin/eventos/[id]`, rotulada "Torneio/Categorias"); `DivisionSwitcher` no admin e no público.
- ✅ TV de evento (`/tv/evento/[id]`) com seletor + auto-rotação (`?rotate=N`, 5–120s, prioriza ao vivo, ignora rascunho).
- ✅ Pública: agrupador em `/torneios` + página `/eventos/[id]`.
- ✅ Decisões fechadas: jogador pode estar em várias categorias; campeão só por categoria; categorias isoladas do ELO/temporada.
- 🗒️ **Dívida menor:** as rotas internas ainda usam `/eventos` (UI diz "Torneio/Categoria"). Renomear rotas → `/admin/torneios/...` é cosmético, fica para depois.

---

## 5. O que falta (backlog ordenado)

| # | Item | Esforço | Observação |
|---|---|---|---|
| 1 | Aplicar migrations + validar `supabase-repo` contra **Supabase local** | médio | **Só o usuário** aplica; hoje só o mock roda. Inclui `20260618000000_tournament_events.sql` |
| 2 | Toggle de **dark mode** Arena | baixo | Tokens já existem |
| 3 | ~~Inscrição aberta por código/QR~~ ✅ **FEITO** | — | `/inscrever` + card admin "Compartilhe a inscrição" (link/copiar/share/QR) |
| 4 | **E2E Playwright** dos fluxos de torneio | médio | DoD pede (criar→chave→placar→campeão). ⚠️ esbarra no login HML |
| 5 | ~~Round-robin / scorecard~~ ✅ round-robin feito; scorecard descartado | — | Avançados (dupla elim., suíço, americano, liga) só sob demanda |
| 6 | Auto-fit/zoom do bracket em tela cheia (hoje só pan) | médio | Tv-bracket-view tem auto-fit (com 1 warning de ref a sanar) |
| 7 | Diferenciais F3 (palpites, recap narrado, ticker TV, zebra na TV) | alto | Pós-essencial |

---

## 6. Invariantes (continuam valendo)

- **Nunca aplicar migrations em HML/PROD** — só arquivo; o usuário aplica ([`regra-nunca-aplicar-prod`]).
- **Mock-first** — nada toca os bancos existentes durante o desenvolvimento.
- **Antes de implementar funcionalidade nova: pesquisar como é feito em torneios reais e validar o plano** (pedido do organizador 2026-06-18).
- ELO e fluxo hardened de partidas **portados sem alterar a matemática**; suíte de ELO intacta.
- Torneios em tabelas próprias, **sem triggers** de ELO/temporada.
- Toda ação importante com **`ConfirmModal`**; PT-BR acentuado; reusar > inventar.
- **Superfície de modal = sólida (`--popover`); desfoque só no backdrop de tela cheia** (evita rebarba nas quinas).
