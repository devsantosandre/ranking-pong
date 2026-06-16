# Plano de Implementação — Sistema de Temporadas

> Documento autossuficiente para continuar a implementação (Etapas 3–5).
> Escrito no Opus 4.8 para execução no Sonnet 4.6. Leia tudo antes de codar.

## 0. Invariantes (NÃO violar)

1. **NUNCA aplicar nada em produção.** Apenas criar arquivos de migration em `supabase/migrations/` e código. O **usuário aplica manualmente** (`npm run db:push:hml` → `npm run db:push:prod`). Não usar tools que escrevem em prod.
2. **NÃO alterar o cálculo de ELO** nem as funções hardened (`validate_pending_match_v2`, `cancel_match_v2`, `apply_exceptional_match_correction_v1`). A temporada é aditiva.
3. **Seguir `docs/DESIGN_CONSISTENCIA.md`** em toda UI: reusar `AppShell`, tokens de tema, `src/lib/divisions.ts`, `ui/` primitives; sempre cobrir estados loading/vazio/erro.
4. **Português com acentuação correta** em toda string de UI e comentário.
5. Rodar `npm run lint` e `npm run build` antes de considerar uma etapa pronta.
6. Migrations novas usam timestamp crescente no nome (a última é `20260616000100`). Próximas: `20260616000200_...`, etc.

## 1. Visão geral do que está sendo construído

Ranking duplo:
- **Geral** = ELO vitalício existente (`users.rating_atual`), intocado.
- **Temporada** = pontos por período que zeram a cada temporada.

Pontuação da temporada (configurável em `settings`): vitória `+season_points_win` (3), derrota `+season_points_loss` (1, nunca negativo), bônus de zebra opcional `+season_zebra_bonus` (2, ligado por `season_zebra_enabled`, default `false`). Sem WO (tudo presencial). Desempate: pontos → aproveitamento (`win_rate`) → vitórias.

Datas das temporadas: planejadas **manualmente** pelo admin. Encerramento: **automático "preguiçoso"** (sem cron) verificado nas leituras + botão admin "Encerrar agora"/"Reabrir". Campeão vai pro **Hall da Fama** + conquista + notícia + push.

## 2. Estado atual (JÁ FEITO — apenas arquivos criados, NÃO aplicados)

- `supabase/migrations/20260616000000_create_seasons_tables.sql` — enums, tabelas `seasons` e `season_standings`, coluna `matches.season_id`, RLS (leitura pública), settings (`season_points_win/loss`, `season_zebra_bonus/enabled`), conquista `season_champion`, e uma "Temporada Inaugural" ativa.
- `supabase/migrations/20260616000100_season_points_recalc_and_triggers.sql` — `recalc_season_standings(season_id)` + triggers `matches_stamp_season` (BEFORE) e `matches_recalc_season` (AFTER) que mantêm `season_standings` automaticamente em qualquer caminho (confirmação manual/automática, cancelamento, correção).
- `docs/DESIGN_CONSISTENCIA.md`, `AGENTS.md` (seção Design) — guia visual.

**Antes de testar as etapas seguintes, o usuário precisa aplicar essas 2 migrations no HML.**

## 3. Referência de schema (pós Etapas 1–2)

`seasons`: `id, name, slug, starts_at, ends_at, status('upcoming'|'active'|'closed'), recurrence('none'|'weekly'|'monthly'|'quarterly'|'semiannual'), champion_user_id, closed_at, created_by, created_at, updated_at`. Índice único parcial: só 1 `active`.

`season_standings` (PK season_id+user_id): `points, wins, losses, games, zebra_wins, position(NULL até fechar), win_rate, updated_at`.

`matches.season_id` (FK seasons, nullable; carimbado ao validar).

`settings` (key/value text): chaves novas `season_points_win`, `season_points_loss`, `season_zebra_bonus`, `season_zebra_enabled`.

`users`: `id, name, full_name, email, foto_url, rating_atual, vitorias, derrotas, jogos_disputados, is_active, hide_from_ranking, role`.

Padrões existentes a imitar:
- Queries React Query: `src/lib/queries/use-users.ts`, `use-settings.ts`; chaves em `src/lib/queries/query-keys.ts`; export em `src/lib/queries/index.ts`.
- Server actions admin: `src/app/actions/admin.ts` (usa `createAdminClient`, escreve `admin_logs`).
- Tela ranking atual: `src/app/ranking/page.tsx` (reusar o estilo de card/lista e `divisions.ts`).
- Confirmação automática (padrão "preguiçoso" via `after()`): `src/lib/matches/confirmation-sla.ts` + uso em `src/app/actions/pending-confirmation.ts`. **Imitar esse padrão para o encerramento automático de temporada.**
- Push: `src/lib/push.ts`.

---

## ETAPA 3 — Tela de Ranking com abas Temporada / Geral

Objetivo: usuário vê duas abas; Temporada é a padrão, com banner de contagem regressiva. Visual idêntico ao ranking atual (reusar `divisions.ts`).

### 3.1 Hooks de dados — `src/lib/queries/use-seasons.ts` (novo)
- `useActiveSeason()` — `SELECT * FROM seasons WHERE status='active' ORDER BY starts_at DESC LIMIT 1`. `staleTime` ~30s.
- `useSeasonStandings(seasonId?)` — junta `season_standings` (da temporada) com `users` para nome/foto. Ordenar por `points DESC, win_rate DESC, wins DESC`. Retornar shape compatível com o card do ranking: `{ id, full_name, name, email, points, wins, losses, games, win_rate, position }`. Filtrar usuários `hide_from_ranking=false` e `is_active=true` (join). Sugestão: criar um RPC `get_season_ranking(p_season_id)` (migration `20260616000200`) que já devolve ordenado com join em users — evita lógica no client e respeita o padrão de RPC do projeto. Se preferir sem RPC, fazer dois selects e juntar no client (como `useRanking`).
- Adicionar chaves em `query-keys.ts` (ex.: `seasons.active()`, `seasons.standings(id)`) e exportar em `index.ts`.

### 3.2 UI — editar `src/app/ranking/page.tsx`
- Adicionar `Tabs` (`src/components/ui/tabs.tsx`) no topo: **Temporada** (default) | **Geral**.
- **Aba Geral**: exatamente a lista atual (`useRankingAll`), sem mudanças de comportamento.
- **Aba Temporada**:
  - Banner: nome da temporada + contagem regressiva até `ends_at` (ex.: "Temporada de Junho · termina em 8 dias"; se já passou de `ends_at`, mostrar "encerrando…"). Barra de progresso opcional (% do período decorrido).
  - Lista usando o MESMO componente visual de item do ranking (extrair o item atual para um componente reutilizável se necessário), mas exibindo **pontos da temporada** e `wins/losses`. Reusar `getPlayerStyle/getDivisionStyle/getDivisionNumber/getDivisionName/isTopThree` de `divisions.ts` para manter cores/medalhas idênticas.
  - Estado vazio: "Nenhum jogo nesta temporada ainda."
  - Se não houver temporada ativa: card neutro "Nenhuma temporada ativa no momento."
- Manter busca (`SearchInput`) funcionando nas duas abas.
- A H2H/Sheet existente continua igual.

### 3.3 Aceite Etapa 3
- Trocar abas funciona; Temporada é default; ordem difere do Geral; busca funciona; visual consistente; `lint`+`build` ok. Testar com `npm run dev`.

---

## ETAPA 4 — Encerramento (automático preguiçoso + manual), campeão, notícia, push, conquista

### 4.1 Migration `20260616000200_close_season.sql`
Adicionar valor de enum para notícia de temporada (a `news_tipo` só tem `'resultado'`):
```sql
ALTER TYPE public.news_tipo ADD VALUE IF NOT EXISTS 'temporada';
```
> Obs: `ALTER TYPE ... ADD VALUE` não pode rodar dentro de bloco de transação junto com uso imediato do valor; deixar essa migration SÓ para o enum se necessário, e a função `close_season` em outra migration posterior (ou usar `'news'`/`'resultado'` para evitar). Decisão recomendada: criar migration separada só do enum e a função noutra.

Função `close_season(p_season_id uuid, p_actor_id uuid DEFAULT NULL)` (SECURITY DEFINER, grant service_role):
1. `SELECT ... FOR UPDATE` a season; se não `active`, permitir mesmo assim (idempotente) mas não duplicar efeitos se já `closed`.
2. `PERFORM recalc_season_standings(p_season_id);` (garante dados frescos).
3. Congelar posições:
   ```sql
   WITH ranked AS (
     SELECT user_id, ROW_NUMBER() OVER (
       ORDER BY points DESC, win_rate DESC, wins DESC, games DESC
     ) AS pos
     FROM season_standings WHERE season_id = p_season_id
   )
   UPDATE season_standings ss SET position = ranked.pos
   FROM ranked WHERE ss.season_id = p_season_id AND ss.user_id = ranked.user_id;
   ```
4. Campeão = `user_id` com `position = 1` (se houver standings). `UPDATE seasons SET champion_user_id=..., status='closed', closed_at=now(), updated_at=now() WHERE id=p_season_id`.
5. Conceder conquista: `INSERT INTO user_achievements (user_id, achievement_id) SELECT champion, id FROM achievements WHERE key='season_champion' ON CONFLICT (user_id, achievement_id) DO NOTHING`.
6. Notícia: `INSERT INTO news_posts (title, slug, resumo, tipo, ...)` anunciando o campeão (usar `tipo='temporada'` se o enum foi adicionado; senão `'resultado'`). Slug único (ex.: `campeao-<slug-da-season>`).
7. Notificações in-app para todos os jogadores com jogo na temporada: `INSERT INTO notifications (user_id, tipo, payload) SELECT DISTINCT user_id, 'news', jsonb_build_object('event','season_closed','season_id',...,'champion_id',...) FROM season_standings WHERE season_id=p_season_id`.
8. Retornar o `champion_user_id` e o nome para a camada TS usar no push.

> O **push** NÃO vai no SQL — é feito na server action (passo 4.3) usando `src/lib/push.ts`.

### 4.2 Encerramento automático "preguiçoso" — `src/lib/seasons/lifecycle.ts` (novo)
Imitar `confirmation-sla.ts`:
- `enforceSeasonLifecycle({ supabase? })`: throttle (1×/min por processo). `SELECT id, name FROM seasons WHERE status='active' AND ends_at <= now()`. Para cada uma: chamar RPC `close_season`, depois enviar push a todos (reusar push.ts) e logar em `admin_logs` (`admin_role='system'`, `action='season_auto_closed'`).
- Chamar `enforceSeasonLifecycle()` em `after()` nas leituras principais (ex.: nas actions do ranking/home e na `use-seasons` via uma server action `getSeasonOverviewAction`). Mesmo padrão dos `after()` de SLA.

### 4.3 Server actions admin de temporada — `src/app/actions/seasons.ts` (novo)
- `adminCloseSeasonNow(seasonId)` — chama `close_season` + push + `admin_logs` (`action='season_closed_manual'`). Restrito a admin (checar role como em `actions/admin.ts`).
- `adminReopenSeason(seasonId)` — `UPDATE seasons SET status='active', champion_user_id=NULL, closed_at=NULL` e zera `position` (`UPDATE season_standings SET position=NULL`); remover conquista concedida e notícia, se desejado (ou deixar — decidir; recomendado remover a conquista do campeão e a notícia para consistência). Logar.
- Todas usam `createAdminClient`.

### 4.4 Aceite Etapa 4
- Ao passar de `ends_at`, a próxima leitura encerra a temporada, congela posições, define campeão, cria notícia, manda push e concede conquista. Botões admin encerram/reabrem. `lint`+`build` ok.

---

## ETAPA 5 — Hall da Fama + Admin Temporadas + cartões Home/Perfil

### 5.1 Hall da Fama — `src/app/temporadas/page.tsx` (novo, rota `/temporadas`)
- Lista de temporadas `closed` (ordenadas desc por `ends_at`) com 👑 campeão (nome/foto) e link para ver a tabela final congelada (`season_standings` com `position`).
- Hook `useClosedSeasons()` e `useSeasonStandings(id)` (reusa Etapa 3).
- Adicionar entrada de navegação (header/menu) para `/temporadas`. Seguir `AppShell`.

### 5.2 Admin Temporadas — `src/app/admin/temporadas/page.tsx` (novo)
- Listar temporadas (todas). Criar nova (form: nome, `starts_at`, `ends_at`, `recurrence`). Botão "usar cadência" pré-preenche `ends_at` a partir de `starts_at`+recurrence (semanal/mensal/trimestral/semestral) — apenas atalho, datas editáveis.
- Editar datas/nome da temporada ativa/futura. Botões "Encerrar agora" e "Reabrir" (chamam actions da 4.3).
- Mostrar standings da temporada selecionada.
- Validações: não permitir 2 `active`; `ends_at > starts_at`. Usar `ConfirmModal` para ações sensíveis. Seguir o estilo de `src/app/admin/configuracoes/page.tsx`.
- Server actions de CRUD em `src/app/actions/seasons.ts` (criar/editar), restritas a admin, com `admin_logs`.
- Os parâmetros de pontos (`season_points_*`, `season_zebra_*`) podem ser editados na tela existente `/admin/configuracoes` — basta adicioná-los ao `settingDisplayOrder`/`settingLabels` lá (incluir labels em PT e validação: inteiros; `season_zebra_enabled` é boolean 'true'/'false').

### 5.3 Cartões Home/Perfil
- Home (`src/app/page.tsx`) e Perfil (`src/app/perfil/page.tsx`): cartão "Temporada de X — você em Nº, P pts · termina em D dias", reusando `useActiveSeason` + posição do usuário em `season_standings`. Link para `/ranking` (aba Temporada).

### 5.4 Aceite Etapa 5
- Hall da Fama lista campeões; admin cria/edita/encerra/reabre; configs de pontos editáveis; cartões aparecem na home/perfil. `lint`+`build` ok.

---

## 6. Testes (Vitest + Playwright, ver `README-TESTS.md`)
- Unit: cálculo de pontos (vitória/derrota/zebra) e desempate; lógica de contagem regressiva.
- Integração (se houver harness de DB): validar partida soma standings; cancelar/corrigir reconstrói; `close_season` congela posição + define campeão.
- E2E smoke: trocar abas, ver banner, Hall da Fama.

## 7. Ordem sugerida de PRs
1. (feito) Migrations Etapas 1–2.
2. Etapa 3 (UI abas) — entrega visível.
3. Etapa 4 (encerramento + campeão).
4. Etapa 5 (Hall da Fama + admin + cartões).

## 8. Lembrete final
Nunca aplicar em produção. Entregar migrations como arquivos e instruir `npm run db:push:hml` para o usuário. Não tocar nas funções do ELO. Seguir o guia visual.
