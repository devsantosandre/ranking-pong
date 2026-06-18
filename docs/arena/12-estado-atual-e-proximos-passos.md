# 12 — Estado Atual & Próximos Passos

> **Fonte da verdade** do que já existe no código vs. o que falta. Atualizado em 2026-06-18.
> Substitui o status "FASE DE ESTUDO — nada implementado" dos docs originais: **F0 e F1 estão feitos, F2 está bem avançado.**
>
> Tudo abaixo vive no working tree da branch `novo-app` (ainda **não commitado**), desenvolvido **mock-first**. As migrations existem **só em arquivo** — nunca aplicadas em HML/PROD (ver [`regra-nunca-aplicar-prod`]).

---

## 1. Legenda
✅ feito e funcional · 🚧 parcial / a validar · ⬜ não iniciado

---

## 2. Fundação Arena (F0) — ✅

- ✅ Todas as telas migradas para o route group `src/app/(arena)/`: home, ranking, partidas, perfil (+configurações), temporadas, regras, notícias, mais, registrar-jogo.
- ✅ Tokens Arena no `globals.css`; **tema light pronto**, dark preservado em `.arena.dark{}`.
- ✅ Primitivos: `arena-shell`, `glass-card`, `status-pill`, `ambient-glows`, `champion-celebration`.
- 🚧 **Toggle de dark mode** — tokens dark existem, o switch ainda não foi ligado.

---

## 3. Módulo Torneios (F1 + boa parte do F2) — ✅ mock-first

### Dados & motor
- ✅ `lib/tournaments/types.ts` — domínio completo; `format-meta.ts` com **9 formatos definidos**.
- ✅ Camada de dados plugável (`NEXT_PUBLIC_DATA_SOURCE`): `tournament-repo.ts` (interface), `mock-repo.ts` (completo, **default**), `supabase-repo.ts` (escrito, 🚧 nunca rodado contra banco).
- ✅ Migrations **em arquivo**: `tournaments`, `tournament_rpcs`, `tournament_realtime` — 🚧 **não aplicadas**.
- ✅ Algoritmos: `bracket-layout`, `seeding` (standard/elo/sequential/manual), `standings`, `win-probability`, `seed-colors`.

### Formatos com motor funcional ponta a ponta
- ✅ **Eliminatória simples** (com BYE automático p/ nº não potência de 2).
- ✅ **Grupos + mata-mata** (round-robin por grupo → `closeGroupStage` semeia o mata-mata; auto-avanço).
- ✅ **Rei da mesa**.
- ⬜ Definidos em metadata mas **sem engine**: dupla eliminação, round-robin puro, suíço, scorecard, americano, liga.

### UI
- ✅ **Admin** (`/admin/torneios`): lista, criar, gestão `[id]` com abas dinâmicas por formato — **Inscritos · Seeds · Grupos\* · Chave · Placar** (\*só formatos com grupos).
  - ✅ `participant-picker`, `seeding-board` (dnd), `group-distribution-board` (dnd + validação de potência de 2 + seeds automáticos), `score-sheet`, `standings-table`.
- ✅ **Público** (`/torneios`): lista, overview `[id]`, `/chave` (bracket realtime read-only), `/grupos`, `/inscrever`, `/mesa/[matchId]` (Score@Table), `opengraph-image`.
- ✅ **Bracket**: `bracket-canvas`, `bracket-connectors`, `match-card`, `participant-row`, `round-header`, `upset-badge`, `win-probability-bar`.
- ✅ **TV** (`/tv/torneio/[id]`): `tv-bracket-view`, `tv-king-view`.
- ✅ **Realtime**: `use-realtime-bracket`.
- ✅ **API**: `/api/tournaments` (+ `[id]`, `/bracket`, `/standings`).

### Testes
- ✅ Unit: `bracket-layout`, `seeding`, `standings`, `win-probability` (+ `elo`, `divisions` pré-existentes do ranking).
- ⬜ E2E de torneios (Playwright) ainda não escritos.

---

## 4. O que falta no módulo (backlog ordenado)

| # | Item | Esforço | Observação |
|---|---|---|---|
| 1 | ~~**Divisões em torneios**~~ ✅ **FEITO mock-first** (F1–F5) | médio | Evento agrupa divisões; hub admin, switcher, TV de evento, pública. Falta só a migration F6 (item 2) |
| 2 | Aplicar migrations + validar `supabase-repo` contra **Supabase local** | médio | Hoje só o mock roda; inclui a migration de divisões (`20260618000000_tournament_events.sql`) |
| 3 | Toggle de **dark mode** Arena | baixo | Tokens já existem |
| 4 | Inscrição aberta por **código/QR** ponta a ponta | médio | Rota `/inscrever` existe — auditar fluxo completo |
| 5 | E2E Playwright dos fluxos de torneio | médio | DoD pede (criar→chave→placar→campeão) |
| 6 | Formatos restantes (round-robin puro, scorecard primeiro — mais simples) | médio→alto | Sob demanda |
| 7 | Diferenciais F3 (palpites, recap narrado, ticker TV, zebra na TV) | alto | Pós-essencial |

---

## 5. Invariantes (continuam valendo)

- **Nunca aplicar migrations em HML/PROD** — só arquivo; o usuário aplica ([`regra-nunca-aplicar-prod`]).
- **Mock-first** — nada toca os bancos existentes durante o desenvolvimento.
- ELO e fluxo hardened de partidas **portados sem alterar a matemática**; suíte de ELO intacta.
- Torneios em tabelas próprias, **sem triggers** de ELO/temporada.
- Toda ação importante com **`ConfirmModal`**; PT-BR acentuado; reusar > inventar.

---

## 6. Próximo grande passo: Divisões

Estudo completo e validado em **`docs/ESTUDO_DIVISOES.md`** (Opção B). Resumo:

- **Cada divisão É um torneio independente** → reusa 100% do motor já construído (chave, RPCs, realtime, TV, abas admin, standings). Zero breaking change (torneio avulso = `event_id null`).
- Trabalho = **camada de orquestração**: entidade leve `tournament_events` + colunas `event_id`/`division_label`/`division_order`; hub admin `/admin/eventos/[id]`; seletor de divisão; TV de evento com auto-rotação; agrupamento público.
- **Decisões fechadas (organizador, 2026-06-18):** (1) mesmo jogador pode estar em várias divisões; (2) campeão só por divisão (sem campeão geral); (3) divisões **isoladas** do ELO/temporada (`season_id` do evento vira opcional).
- Plano faseado **F1–F6** mock-first no doc. Começar pela **F1 (modelo + mock-repo)** — aditiva, não quebra nada.

> ⚠️ Não confundir com: `groupId` (subgrupos que convergem num único mata-mata) nem **temporada** (período do ELO).
