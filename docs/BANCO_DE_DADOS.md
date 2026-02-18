# Estrutura do Banco de Dados

Documentação completa das tabelas do Supabase (PostgreSQL) utilizadas no sistema de ranking.

---

## Diagrama de Relacionamentos

```
                              ┌─────────────────┐
                              │     users       │
                              │   (central)     │
                              └────────┬────────┘
                                       │
        ┌──────────────┬───────────────┼───────────────┬──────────────┐
        │              │               │               │              │
        ▼              ▼               ▼               ▼              ▼                ▼
┌───────────────┐ ┌─────────┐ ┌──────────────┐ ┌────────────┐ ┌─────────────┐ ┌──────────────────┐
│    matches    │ │settings │ │ admin_logs   │ │notifications│ │daily_limits │ │push_subscriptions│
└───────┬───────┘ └─────────┘ └──────────────┘ └────────────┘ └─────────────┘ └──────────────────┘
        │
        ├──────────────┬───────────────┬───────────────┐
        │              │               │               │
        ▼              ▼               ▼               ▼
┌───────────────┐ ┌───────────┐ ┌────────────┐ ┌─────────────┐
│  match_sets   │ │news_posts │ │live_updates│ │  rating_    │
└───────────────┘ └───────────┘ └────────────┘ │transactions │
                                               └─────────────┘

┌───────────────┐      ┌─────────────────┐
│ achievements  │◄────►│user_achievements│
└───────────────┘      └─────────────────┘

┌───────────────────┐
│ranking_snapshots  │
└───────────────────┘
```

---

## Tabelas

### users

Tabela central com perfis dos jogadores.

| Campo | Tipo | Padrão | Nullable | Descrição |
|-------|------|--------|----------|-----------|
| `id` | uuid | - | Não | PK, sincronizado com auth.users |
| `email` | text | - | Sim | Email do usuário |
| `name` | text | - | Sim | Nome curto/apelido |
| `full_name` | text | - | Sim | Nome completo |
| `foto_url` | text | - | Sim | URL da foto de perfil |
| `rating_atual` | integer | 1000 | Não | Rating ELO atual |
| `vitorias` | integer | 0 | Sim | Total de vitórias |
| `derrotas` | integer | 0 | Sim | Total de derrotas |
| `jogos_disputados` | integer | 0 | Sim | Total de partidas |
| `streak` | integer | 0 | Sim | Sequência atual de vitórias |
| `inactivity_days` | integer | 0 | Sim | Dias de inatividade |
| `role` | player_role | 'player' | Sim | Papel: player, admin, moderator |
| `is_active` | boolean | true | Sim | Usuário ativo no sistema |
| `hide_from_ranking` | boolean | false | Não | Ocultar do ranking público |
| `created_at` | timestamptz | now() | Sim | Data de criação |
| `updated_at` | timestamptz | now() | Sim | Data de atualização |

---

### matches

Registro de todas as partidas do sistema.

| Campo | Tipo | Padrão | Nullable | Descrição |
|-------|------|--------|----------|-----------|
| `id` | uuid | gen_random_uuid() | Não | PK |
| `player_a_id` | uuid | - | Não | FK -> users.id |
| `player_b_id` | uuid | - | Não | FK -> users.id |
| `vencedor_id` | uuid | - | Sim | FK -> users.id |
| `data_partida` | date | CURRENT_DATE | Não | Data da partida |
| `resultado_a` | integer | 0 | Sim | Placar do jogador A |
| `resultado_b` | integer | 0 | Sim | Placar do jogador B |
| `pontos_variacao_a` | integer | 0 | Sim | Delta ELO do jogador A |
| `pontos_variacao_b` | integer | 0 | Sim | Delta ELO do jogador B |
| `rating_final_a` | integer | - | Sim | Rating final do jogador A |
| `rating_final_b` | integer | - | Sim | Rating final do jogador B |
| `k_factor_used` | integer | - | Sim | K factor usado no cálculo |
| `status` | match_status | 'pendente' | Não | Status da partida |
| `tipo_resultado` | resultado_tipo | - | Sim | Tipo: win, loss, wo |
| `criado_por` | uuid | - | Sim | FK -> users.id (quem registrou) |
| `aprovado_por` | uuid | - | Sim | FK -> users.id (quem confirmou) |
| `created_at` | timestamptz | now() | Sim | Data de criação |
| `updated_at` | timestamptz | now() | Sim | Data de atualização |

**Status possíveis:**
- `pendente` - Aguardando confirmação do oponente
- `edited` - Placar foi contestado/editado
- `validado` - Confirmada e pontos aplicados
- `cancelado` - Cancelada por admin
- `in_progress` - Em andamento (futuro)

**Índice de performance (feed de notícias):**
- `idx_matches_validated_created_at` em `(created_at DESC) WHERE status = 'validado'`

---

### match_sets

Detalhamento dos sets de cada partida.

| Campo | Tipo | Padrão | Nullable | Descrição |
|-------|------|--------|----------|-----------|
| `id` | uuid | gen_random_uuid() | Não | PK |
| `match_id` | uuid | - | Não | FK -> matches.id |
| `numero_set` | integer | - | Não | Número do set (1-5) |
| `pontos_a` | integer | 0 | Sim | Pontos do jogador A |
| `pontos_b` | integer | 0 | Sim | Pontos do jogador B |
| `vencedor_set` | uuid | - | Sim | FK -> users.id |
| `created_at` | timestamptz | now() | Sim | Data de criação |

**Constraint:** `numero_set >= 1 AND numero_set <= 5`

---

### daily_limits

Controle de limite de partidas diárias entre mesmos jogadores.

| Campo | Tipo | Padrão | Nullable | Descrição |
|-------|------|--------|----------|-----------|
| `id` | uuid | gen_random_uuid() | Não | PK |
| `user_id` | uuid | - | Não | FK -> users.id |
| `opponent_id` | uuid | - | Não | FK -> users.id |
| `data` | date | CURRENT_DATE | Não | Data |
| `jogos_registrados` | integer | 1 | Não | Quantidade de jogos |
| `created_at` | timestamptz | now() | Sim | Data de criação |

**Uso:** Evita que mesmos jogadores joguem mais que o limite diário configurado.

---

### rating_transactions

Histórico de todas as alterações de rating (auditoria).

| Campo | Tipo | Padrão | Nullable | Descrição |
|-------|------|--------|----------|-----------|
| `id` | uuid | gen_random_uuid() | Não | PK |
| `match_id` | uuid | - | Sim | FK -> matches.id |
| `user_id` | uuid | - | Não | FK -> users.id |
| `motivo` | transaction_motivo | - | Não | Motivo da transação |
| `valor` | integer | - | Não | Variação (+ ou -) |
| `rating_antes` | integer | - | Não | Rating anterior |
| `rating_depois` | integer | - | Não | Rating após |
| `created_at` | timestamptz | now() | Sim | Data de criação |

**Motivos possíveis:**
- `vitoria` - Ganhou pontos por vitória
- `derrota` - Perdeu pontos por derrota
- `bonus` - Bônus administrativo
- `inatividade` - Penalidade por inatividade
- `wo` - Walkover
- `reversao_admin` - Reversão por cancelamento
- `ajuste_admin` - Ajuste manual do admin

---

### ranking_snapshots

Snapshots históricos do ranking em datas específicas.

| Campo | Tipo | Padrão | Nullable | Descrição |
|-------|------|--------|----------|-----------|
| `id` | uuid | gen_random_uuid() | Não | PK |
| `data_referencia` | date | CURRENT_DATE | Não | Data do snapshot |
| `user_id` | uuid | - | Não | FK -> users.id |
| `posicao` | integer | - | Não | Posição no ranking |
| `rating` | integer | - | Não | Rating no momento |
| `vitorias` | integer | 0 | Sim | Vitórias no período |
| `derrotas` | integer | 0 | Sim | Derrotas no período |
| `jogos_no_periodo` | integer | 0 | Sim | Jogos no período |
| `inatividade` | integer | 0 | Sim | Dias de inatividade |
| `created_at` | timestamptz | now() | Sim | Data de criação |

---

### settings

Configurações dinâmicas do sistema.

| Campo | Tipo | Padrão | Nullable | Descrição |
|-------|------|--------|----------|-----------|
| `id` | uuid | gen_random_uuid() | Não | PK |
| `key` | text | - | Não | Chave única |
| `value` | text | - | Não | Valor |
| `description` | text | - | Sim | Descrição |
| `updated_at` | timestamptz | now() | Sim | Data de atualização |
| `updated_by` | uuid | - | Sim | FK -> users.id |

**Configurações conhecidas:**
| Key | Valor Padrão | Descrição |
|-----|--------------|-----------|
| `k_factor` | "24" | Fator K do ELO |
| `limite_jogos_diarios` | "2" | Limite de jogos/dia vs mesmo oponente |
| `rating_inicial` | "250" | Rating inicial usado na criação de jogadores |

---

### admin_logs

Logs de auditoria de ações administrativas.

| Campo | Tipo | Padrão | Nullable | Descrição |
|-------|------|--------|----------|-----------|
| `id` | uuid | gen_random_uuid() | Não | PK |
| `admin_id` | uuid | - | Não | FK -> users.id |
| `admin_role` | text | - | Sim | Role do admin |
| `action` | text | - | Não | Ação realizada |
| `action_description` | text | - | Sim | Descrição da ação |
| `target_type` | text | - | Sim | Tipo do alvo (user, match, etc) |
| `target_id` | uuid | - | Sim | ID do alvo |
| `target_name` | text | - | Sim | Nome do alvo |
| `old_value` | jsonb | - | Sim | Valor anterior |
| `new_value` | jsonb | - | Sim | Valor novo |
| `reason` | text | - | Sim | Motivo da ação |
| `created_at` | timestamptz | now() | Sim | Data de criação |

---

### achievements

Definição das conquistas disponíveis no sistema.

| Campo | Tipo | Padrão | Nullable | Descrição |
|-------|------|--------|----------|-----------|
| `id` | uuid | gen_random_uuid() | Não | PK |
| `key` | text | - | Não | Chave única |
| `name` | text | - | Não | Nome exibido |
| `description` | text | - | Não | Descrição |
| `category` | text | - | Não | Categoria |
| `rarity` | text | - | Não | Raridade |
| `icon` | text | - | Sim | Emoji do ícone |
| `points` | integer | 0 | Sim | Pontos associados |
| `condition_type` | text | - | Não | Tipo de condição |
| `condition_value` | integer | 0 | Sim | Valor para desbloquear |
| `condition_extra` | jsonb | - | Sim | Dados extras |
| `is_active` | boolean | true | Sim | Conquista ativa |
| `created_at` | timestamptz | now() | Sim | Data de criação |

**Raridades:** bronze, prata, ouro, platina, diamante, especial

**Ver:** `docs/CONQUISTAS.md` para lista completa de conquistas.

---

### user_achievements

Conquistas desbloqueadas pelos usuários.

| Campo | Tipo | Padrão | Nullable | Descrição |
|-------|------|--------|----------|-----------|
| `id` | uuid | gen_random_uuid() | Não | PK |
| `user_id` | uuid | - | Não | FK -> users.id |
| `achievement_id` | uuid | - | Não | FK -> achievements.id |
| `unlocked_at` | timestamptz | now() | Sim | Data de desbloqueio |
| `match_id` | uuid | - | Sim | FK -> matches.id (partida que desbloqueou) |

**Constraint:** UNIQUE(user_id, achievement_id)

---

### news_posts

Posts de notícias e resultados.

| Campo | Tipo | Padrão | Nullable | Descrição |
|-------|------|--------|----------|-----------|
| `id` | uuid | gen_random_uuid() | Não | PK |
| `match_id` | uuid | - | Sim | FK -> matches.id |
| `title` | text | - | Não | Título |
| `slug` | text | - | Sim | URL slug (único) |
| `resumo` | text | - | Sim | Resumo |
| `content_md` | text | - | Sim | Conteúdo em Markdown |
| `tags` | text[] | '{}' | Sim | Array de tags |
| `cover_url` | text | - | Sim | URL da capa |
| `tipo` | news_tipo | 'resultado' | Sim | Tipo do post |
| `published_at` | timestamptz | now() | Sim | Data de publicação |
| `created_by` | uuid | - | Sim | FK -> users.id |
| `pinned` | boolean | false | Sim | Post fixado |
| `created_at` | timestamptz | now() | Sim | Data de criação |

---

### notifications

Notificações dos usuários.

| Campo | Tipo | Padrão | Nullable | Descrição |
|-------|------|--------|----------|-----------|
| `id` | uuid | gen_random_uuid() | Não | PK |
| `user_id` | uuid | - | Não | FK -> users.id |
| `tipo` | notification_tipo | - | Não | Tipo da notificação |
| `payload` | jsonb | '{}' | Sim | Dados da notificação |
| `lida` | boolean | false | Sim | Notificação lida |
| `created_at` | timestamptz | now() | Sim | Data de criação |

**Tipos:** desafio, ranking_update, news, confirmacao

**Índice importante (Realtime V1):**
- `idx_notifications_user_lida_created_at (user_id, lida, created_at DESC)`

**Payload usado em `tipo = 'confirmacao'` (V1):**
- `event`: `pending_created` | `pending_transferred` | `pending_resolved`
- `match_id`: UUID da partida
- `status`: `pendente` | `edited` | `validado` | `cancelado`
- `actor_id`: UUID de quem disparou o evento
- `actor_name`: Nome exibível de quem disparou o evento
- `created_by`: UUID de quem criou/ajustou o registro principal da pendência

**Policies relevantes (RLS):**
- `Users can view own notifications` (`SELECT` em `user_id = auth.uid()`)
- `Users can update own notifications` (`UPDATE` em `user_id = auth.uid()`)

---

### push_subscriptions

Assinaturas Web Push por dispositivo/navegador.

| Campo | Tipo | Padrão | Nullable | Descrição |
|-------|------|--------|----------|-----------|
| `id` | uuid | gen_random_uuid() | Não | PK |
| `user_id` | uuid | - | Não | FK -> users.id |
| `endpoint` | text | - | Não | Endpoint da assinatura (FCM/Web Push) |
| `p256dh` | text | - | Não | Chave pública do client |
| `auth` | text | - | Não | Auth secret do client |
| `user_agent` | text | - | Sim | User agent do dispositivo |
| `platform` | text | - | Sim | Plataforma reportada pelo client |
| `last_error` | text | - | Sim | Último erro de envio |
| `disabled_at` | timestamptz | - | Sim | Quando a assinatura foi desativada |
| `created_at` | timestamptz | now() | Não | Data de criação |
| `updated_at` | timestamptz | now() | Não | Data de atualização |

**Índices principais:**
- `idx_push_subscriptions_endpoint` (unique em `endpoint`)
- `idx_push_subscriptions_user_endpoint` (unique em `user_id, endpoint`)
- `idx_push_subscriptions_user_active` (`user_id, disabled_at, updated_at DESC`)

**Policies relevantes (RLS):**
- `Users can view own push subscriptions` (`SELECT`)
- `Users can insert own push subscriptions` (`INSERT`)
- `Users can update own push subscriptions` (`UPDATE`)
- `Users can delete own push subscriptions` (`DELETE`)

---

### live_updates

Atualizações em tempo real de partidas.

| Campo | Tipo | Padrão | Nullable | Descrição |
|-------|------|--------|----------|-----------|
| `id` | uuid | gen_random_uuid() | Não | PK |
| `match_id` | uuid | - | Não | FK -> matches.id |
| `payload` | jsonb | '{}' | Sim | Dados da atualização |
| `created_at` | timestamptz | now() | Sim | Data de criação |

---

## Realtime (publication `supabase_realtime`)

Tabelas críticas para o fluxo atual:

| Tabela | Uso |
|--------|-----|
| `users` | Sincronização de ranking, home, perfil e notícias |
| `notifications` | Barramento de eventos de pendência entre sessões/dispositivos |

Observação:
- A migration `20260212193000_realtime_notifications_pending_v1` adiciona `notifications` à publication.

---

## Tipos Customizados (ENUMs)

```sql
-- Papel do usuário
CREATE TYPE player_role AS ENUM ('player', 'admin', 'moderator');

-- Status da partida
CREATE TYPE match_status AS ENUM ('pendente', 'validado', 'in_progress', 'cancelado', 'edited');

-- Tipo de resultado
CREATE TYPE resultado_tipo AS ENUM ('win', 'loss', 'wo');

-- Motivo de transação de rating
CREATE TYPE transaction_motivo AS ENUM (
  'vitoria',
  'derrota',
  'bonus',
  'inatividade',
  'wo',
  'reversao_admin',
  'ajuste_admin'
);

-- Tipo de notícia
CREATE TYPE news_tipo AS ENUM ('resultado');

-- Tipo de notificação
CREATE TYPE notification_tipo AS ENUM ('desafio', 'ranking_update', 'news', 'confirmacao');
```

---

## Políticas RLS

Row Level Security está **habilitado** nas seguintes tabelas:

| Tabela | RLS |
|--------|-----|
| achievements | Habilitado |
| admin_logs | Habilitado |
| daily_limits | Habilitado |
| live_updates | Habilitado |
| match_sets | Habilitado |
| matches | Habilitado |
| news_posts | Habilitado |
| notifications | Habilitado |
| push_subscriptions | Habilitado |
| ranking_snapshots | Habilitado |
| settings | Habilitado |
| user_achievements | Habilitado |
| users | Desabilitado* |
| rating_transactions | Desabilitado* |

*Têm políticas definidas mas RLS não está ativo.

---

## Migrations

| Versão | Nome | Descrição |
|--------|------|-----------|
| 20251211183118 | create_ranking_tables | Tabelas base do sistema |
| 20251211183927 | update_student_on_signup_trigger | Trigger para novo usuário |
| 20251211184120 | consolidate_users_and_students | Consolidação de tabelas |
| 20251211185556 | fix_rls_policies_for_game_flow | Correção de políticas RLS |
| 20251211190049 | disable_rls_temporarily | RLS temporariamente desabilitado |
| 20251221170347 | add_moderator_to_player_role_enum | Role moderator |
| 20251221170354 | add_is_active_to_users | Campo is_active |
| 20251221170404 | create_settings_table | Tabela settings |
| 20251221170411 | create_admin_logs_table | Tabela admin_logs |
| 20251222132851 | add_hide_from_ranking_to_users | Campo hide_from_ranking |
| 20260106044411 | create_achievements_tables | Tabelas de conquistas |
| 20260106053336 | add_k_factor_to_matches | Campo k_factor_used |
| 20260212193000 | realtime_notifications_pending_v1 | Publication + policies + índice em notifications |
| 20260218171000 | push_notifications_pending_v1 | Tabela push_subscriptions + RLS + índices |
| 20260218193000 | optimize_news_feed_query | Índice parcial de performance para feed de notícias |

---

## Foreign Keys

```
matches.player_a_id      -> users.id
matches.player_b_id      -> users.id
matches.vencedor_id      -> users.id
matches.criado_por       -> users.id
matches.aprovado_por     -> users.id

match_sets.match_id      -> matches.id
match_sets.vencedor_set  -> users.id

daily_limits.user_id     -> users.id
daily_limits.opponent_id -> users.id

rating_transactions.user_id  -> users.id
rating_transactions.match_id -> matches.id

ranking_snapshots.user_id -> users.id

admin_logs.admin_id      -> users.id

settings.updated_by      -> users.id

news_posts.created_by    -> users.id
news_posts.match_id      -> matches.id

notifications.user_id    -> users.id
push_subscriptions.user_id -> users.id

live_updates.match_id    -> matches.id

user_achievements.user_id       -> users.id
user_achievements.achievement_id -> achievements.id
user_achievements.match_id      -> matches.id
```
