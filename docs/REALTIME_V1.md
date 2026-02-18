# Realtime V1: Pendências, Sincronização Global e Push

Documentação da fase de sincronização em tempo real entre sessões/dispositivos, com entrega de alerta in-app e push notification para pendências de partida.

---

## Objetivo

Garantir que eventos críticos de partidas e ranking sejam refletidos no app sem refresh manual, com fallback para consistência eventual e suporte a push em PWA.

---

## Escopo Implementado

1. Alerta global de pendência no topo do app.
2. Badge de contagem no item `Partidas` da navegação.
3. Sincronização em tempo real de pendências via `notifications`.
4. Invalidação global de queries dependentes de ranking/pontuação.
5. Fluxo de confirmação otimizado com atualização visual imediata em `/partidas`.
6. Push notification para eventos de pendência em dispositivos inscritos.
7. Tela dedicada para preferências de notificação em `/perfil/configuracoes`.

---

## Contrato de Evento V1 (`notifications.payload`)

Válido para `tipo = 'confirmacao'`.

| Campo | Tipo | Descrição |
|------|------|-----------|
| `event` | string | `pending_created`, `pending_transferred`, `pending_resolved` |
| `match_id` | string | ID da partida |
| `status` | string | `pendente`, `edited`, `validado`, `cancelado` |
| `actor_id` | string | ID de quem disparou o evento |
| `actor_name` | string \| null | Nome exibível do ator |
| `created_by` | string | ID de quem criou/ajustou a pendência |

---

## Regra de "Quem Deve Agir"

Pendência ativa para o usuário atual:

```sql
status in ('pendente', 'edited')
AND (player_a_id = :userId OR player_b_id = :userId)
AND criado_por != :userId
```

Resumo:
- Em `pendente`, quem não criou deve agir.
- Em `edited`, a ação é transferida para o outro jogador.

---

## Arquitetura no Frontend

### Providers Globais

Arquivo: `src/components/providers.tsx`

- `RealtimePendingBridge` -> `useRealtimePendingSync(user?.id)`
- `RealtimeRankingBridge` -> `useRealtimeRankingSync(user?.id)`
- `PushSubscriptionProvider` (via `PushSubscriptionBridge`) para estado global de push

### Hooks e Chaves

- `src/lib/queries/query-keys.ts`
  - `queryKeys.matches.pendingActions(userId)`
  - `queryKeys.notifications.user(userId)`

- `src/lib/queries/use-notifications.ts`
  - `usePendingActionCount(userId?)`
  - Polling fallback: `refetchInterval = 30s`

- `src/lib/hooks/use-realtime-pending.ts`
  - Escuta `INSERT` em `notifications` filtrando por `user_id`.
  - Invalida `matches`, `pendingActions` e `notifications.user`.

- `src/lib/hooks/use-realtime-ranking-sync.ts`
  - Escuta mudanças em `users`.
  - Debounce de invalidação (`250ms`) para reduzir tempestade de queries.
  - Revalida ranking, perfil, notícias e dados do usuário atual.

- `src/lib/hooks/use-push-subscription.ts`
  - Mantém estado de push (`permission`, `hasSubscription`, `isConfigured`, `isSupported`).
  - Sincroniza inscrição com backend (`POST/DELETE /api/push/subscription`).
  - Fluxo de soft ask com cooldown (`7 dias`) via localStorage.
  - Força atualização de service worker versionado (`/sw.js?v=20260218-push-v3`).

---

## Push Notification (PWA)

### Emissão no backend

Arquivo: `src/app/actions/matches.ts`

- `registerMatchAction` -> envia push para o oponente (`pending_created`).
- `contestMatchAction` -> envia push para o outro jogador (`pending_transferred`).

Arquivo: `src/lib/push.ts`

- Usa `web-push` com VAPID.
- Filtra inscrições ativas em `push_subscriptions`.
- Em erro `404/410`, desativa assinatura (`disabled_at`) para evitar retry inútil.
- Ícones padrão do push:
  - `icon: /icon-512.png`
  - `badge: /badge-72.png`

### Recebimento no cliente

Arquivo: `public/sw.js`

- `push` -> mostra notificação com fallback padrão.
- `notificationclick` -> abre/foca URL do payload (default `/partidas`).

### Tela de configuração do usuário

Rota: `/perfil/configuracoes`

- Exibe status: `Ativo`, `Inativo`, `Sincronizando`, `Bloqueado`, `Indisponível`.
- Ações:
  - `Ativar notificações`
  - `Atualizar status`
  - `Mostrar lembrete no app`

---

## API de Assinatura Push

Arquivo: `src/app/api/push/subscription/route.ts`

- `POST /api/push/subscription`
  - Upsert da inscrição do usuário atual.
- `DELETE /api/push/subscription`
  - Desativa inscrição (ou todas do usuário quando endpoint não é enviado).

Auth:
- Requer usuário autenticado (`supabase.auth.getUser()`).

---

## Banco e Segurança

Detalhes completos: `docs/BANCO_DE_DADOS.md`.

Pontos principais:

1. `notifications` adicionada à publication `supabase_realtime`.
2. Policies de `notifications` por dono (`SELECT/UPDATE`).
3. Índice de pendências em `notifications`:
   - `(user_id, lida, created_at DESC)`
4. Nova tabela `push_subscriptions` com RLS por dono (`SELECT/INSERT/UPDATE/DELETE`).
5. Índice parcial para feed de notícias:
   - `idx_matches_validated_created_at` em `matches(created_at DESC) WHERE status='validado'`

---

## Variáveis de Ambiente (Push)

Obrigatórias para envio push no backend:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (ex.: `mailto:admin@dominio.com`)

Observação:
- Se alguma estiver ausente, o envio push é ignorado de forma segura (best-effort).

---

## Testes Recomendados

### Realtime in-app

1. A registra partida -> B recebe alerta e badge sem refresh.
2. B contesta -> pendência sai de B e aparece para A.
3. A confirma -> pendência some para ambos.
4. Admin cancela (`pendente/edited`) -> pendência some para ambos.

### Push

1. Usuário B ativa notificações em `/perfil/configuracoes`.
2. Confirmar assinatura ativa em `push_subscriptions` (`disabled_at IS NULL`).
3. Usuário A registra partida para B.
4. B recebe push com CTA abrindo `/partidas`.

### Resiliência

1. Bloquear permissão no dispositivo -> status `Bloqueado`.
2. Reativar permissão no SO/navegador -> `Atualizar status` reconecta.
3. Subscription expirada (404/410) -> backend marca `disabled_at`.

---

## URLs e Flags de Teste

Ver documentação dedicada:
- `docs/URL_FLAGS_TESTE.md`

---

## Documentação Relacionada

- `docs/PUSH_NOTIFICACOES.md`
- `docs/BANCO_DE_DADOS.md`
