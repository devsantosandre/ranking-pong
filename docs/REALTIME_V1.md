# Realtime V1: Pendências e Sincronização Global

Documentação da primeira fase de sincronização em tempo real entre sessões/dispositivos.

---

## Objetivo

Garantir que eventos críticos de partidas e ranking sejam refletidos no app sem refresh manual, com fallback para consistência eventual.

---

## Escopo Implementado

1. Alerta global de pendência no topo do app.
2. Badge de contagem no item `Partidas` da navegação.
3. Sincronização em tempo real de pendências via `notifications`.
4. Invalidação global de queries dependentes de ranking/pontuação.
5. Fluxo de confirmação otimizado com atualização visual imediata em `/partidas`.

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
- Em `edited`, a ação é transferida para o outro jogador (não fica para ambos).

---

## Arquitetura no Frontend

### Providers Globais

Arquivo: `src/components/providers.tsx`

- `RealtimePendingBridge` -> `useRealtimePendingSync(user?.id)`
- `RealtimeRankingBridge` -> `useRealtimeRankingSync(user?.id)`

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

---

## Comportamento em `/partidas`

- `useConfirmMatch` aplica update otimista no cache para remover pendência imediatamente.
- Em erro:
  - rollback no cache;
  - alerta visual na tela;
  - `refetch()` de segurança.

URL de preview do alerta:
- `/partidas?previewAlert=1`

---

## Emissão de Eventos no Backend

Arquivo: `src/app/actions/matches.ts`

- `registerMatchAction` -> `pending_created` para o oponente.
- `contestMatchAction` -> `pending_transferred` para o outro jogador.
- `confirmMatchAction` -> `pending_resolved` para ambos.

Arquivo: `src/app/actions/admin.ts`

- `adminCancelMatch` -> `pending_resolved` para ambos quando a pendência era `pendente/edited`.

Regra:
- Inserção em `notifications` é best-effort e não bloqueia fluxo principal.

---

## Integração com Conquistas (Latência)

Na confirmação de partida:

1. Conquistas do usuário que confirmou: processadas de forma síncrona (toast imediato).
2. Conquistas do adversário: processadas em background (best-effort).

Resultado:
- Menor tempo de resposta sem perder consistência funcional.

---

## Banco e Segurança

Detalhes completos: `docs/BANCO_DE_DADOS.md`.

Pontos-chave do V1:
- `notifications` adicionada à publication `supabase_realtime`.
- Policy `SELECT` por dono (`user_id = auth.uid()`).
- Policy `UPDATE` por dono (`user_id = auth.uid()`).
- Índice: `(user_id, lida, created_at DESC)`.

---

## Testes Recomendados

1. A registra partida -> B recebe alerta e badge sem refresh.
2. B contesta -> pendência sai de B e aparece para A.
3. A confirma -> pendência some para ambos.
4. Admin cancela (`pendente/edited`) -> pendência some para ambos.
5. Erro de confirmação -> item volta e alerta de erro aparece.
6. Dois dispositivos no mesmo usuário -> estado sincroniza nos dois.

### TV (modo de visualização)

Para validar o comportamento do ranking em telas de TV:

- `/tv?view=table` (modo tabela)
- `/tv?view=grid` (modo grade)
- `/tv?view=table&limit=18` (tabela com top 18)

---

## URLs e Flags de Teste

Ver documentação dedicada:
- `docs/URL_FLAGS_TESTE.md`
