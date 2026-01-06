# Smash Pong - Documentação do Projeto

## Visão Geral

- App mobile-first (PWA instalável) para ranking interno de tênis de mesa
- Mesma base pode ser empacotada com Capacitor para iOS/Android
- Ranking único (sem divisões), nomes completos, regras internas de pontuação e limite de confrontos diários
- **Principais áreas:** Ranking, Partidas, Novo Jogo (wizard), Notícias (posts de jogos realizados), Estatísticas, Perfil

---

## Regras do Jogo e Pontuação

### Pontuação Inicial
- Todos começam com **250 pts**

### Formato das Partidas
- Partidas sempre **melhor de 5 sets**
- Encerra ao atingir **3 sets vencidos**
- **Sem empates**

### Limite de Confrontos
- Máximo **2 confrontos por dia** contra o mesmo adversário

### Sistema de Pontuação

| Resultado | Pontuação |
|-----------|-----------|
| Vitória | **+20 pts** |
| Derrota | **+8 pts** (incentiva jogar) |
| WO/abandono - Faltante | **-10 pts** |
| WO/abandono - Vencedor | **+12 pts** |

### Inatividade
- **-5 pts** a cada 14 dias sem jogar (acumulativo até voltar a jogar)

---

## Navegação/Telas (Mobile)

### Bottom Navigation
- Notícias | Jogos (Partidas) | Iniciar (FAB Novo Jogo) | Conta (Perfil)
- Ranking e Estatísticas acessíveis via tabs ou atalhos no header/menu interno

### Tela: Ranking
- Lista de alunos com:
  - Foto
  - Nome completo
  - Posição
  - Pontos
  - Variação recente
  - Badge de inatividade
- Busca e filtros: Todos / Ativos / Inativos
- CTA "Desafiar"

### Tela: Partidas
- **Tabs:** "Recentes" e "Pendentes/Confirmação"
- Pendentes exibem status, instrução e CTAs apenas para quem deve agir:
  - Quem registrou e aguarda não vê botões
  - O oponente pode **Confirmar** ou **Contestar** (seleciona novo placar rápido)
  - Se alguém ajustar o placar, volta para pendente e só o outro lado vê os botões para confirmar/ajustar novamente
- Recentes mostram badge “Validado”, placar e variação aplicada

### Tela: Registrar Jogo (Wizard 2 passos)
1. **Passo 1:** Selecionar adversário (combobox com busca em usuários reais do Supabase Auth; exclui o logado)
2. **Passo 2:** Escolher resultado rápido (3x0, 3x1, 3x2, 0x3, 1x3, 2x3) — sempre melhor de 5
   - Mostrar previsão de pontos (Vitória +20 / Derrota -8)
   - Aviso "máx. 2 jogos/dia"
- CTA "Registrar partida" só habilita com adversário + resultado; cria partida pendente para o adversário confirmar/contestar

### Tela: Notícias (somente jogos confirmados)
- Feed vertical; ao confirmar uma partida gera post automático “Resultado registrado”
- Card:
  - Título/temporada (simples)
  - Tempo relativo
  - Texto: "Fulano ganhou de Sicrano por 6x3 4x6 10x6" (vencedor em verde, derrotado em vermelho)
- Estados loading/vazio

### Tela: Estatísticas
- Snapshot de pontos atuais e variação semanal
- Gráfico simples do histórico
- Cards de:
  - Streak
  - Jogos no mês
  - Vitórias/derrotas
- Aviso de inatividade e CTA "Marcar jogo"

### Tela: Perfil
- Avatar, nome completo, email
- Botões:
  - Editar perfil
  - QR/Convite
  - Notificações
  - Sair
- Lista compacta de últimos jogos
- Toggle tema (opcional)

### Autenticação
- Supabase Auth (email/senha). Todas as telas (exceto login) exigem usuário autenticado.
- Header mostra usuário logado e botão “Sair”.

### Fluxo de confirmação/contestação
- Registrar: cria partida **pendente** para o oponente.
- Oponente: **Confirmar** aplica pontos e move para Recentes/Notícias; **Contestar** abre seleção de placar rápido e salva, devolvendo para pendente com `edited` para o outro lado confirmar.
- Limite diário respeitado mesmo em pendentes (não permite 3º jogo/dia contra o mesmo adversário).

---

## Modelo de Dados

### Tabela: `students`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| user_id | uuid | FK para auth.users |
| nome_completo | text | Nome completo do jogador |
| email | text | Email |
| foto_url | text | URL da foto |
| rating_atual | int | Pontuação atual |
| streak | int | Sequência de vitórias/derrotas |
| jogos_disputados | int | Total de jogos |
| vitorias | int | Total de vitórias |
| derrotas | int | Total de derrotas |
| inactivity_days | int | Dias de inatividade |
| role | enum | [player] |
| created_at | timestamp | Data de criação |

### Tabela: `matches`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| player_a_id | uuid | FK para students |
| player_b_id | uuid | FK para students |
| vencedor_id | uuid | FK para students |
| data_partida | date | Data da partida |
| status | enum | [pendente, validado, in_progress, cancelado] |
| resultado_a | int | Sets vencidos por A |
| resultado_b | int | Sets vencidos por B |
| pontos_variacao_a | int | Variação de pontos de A |
| pontos_variacao_b | int | Variação de pontos de B |
| rating_final_a | int | Rating final de A |
| rating_final_b | int | Rating final de B |
| tipo_resultado | enum | [win, loss, wo] |
| criado_por | uuid | FK para students |
| aprovado_por | uuid | FK para students |
| created_at | timestamp | Data de criação |

### Tabela: `match_sets`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| match_id | uuid | FK para matches |
| numero_set | int | Número do set (1-5) |
| pontos_a | int | Pontos de A no set |
| pontos_b | int | Pontos de B no set |
| vencedor_set | uuid | FK para students |

### Tabela: `daily_limits`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| student_id | uuid | FK para students |
| opponent_id | uuid | FK para students |
| data | date | Data |
| jogos_registrados | int | Quantidade de jogos no dia |

> Impede mais de 2 jogos/dia contra o mesmo adversário

### Tabela: `rating_transactions`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| match_id | uuid | FK para matches |
| student_id | uuid | FK para students |
| motivo | enum | [vitoria, derrota, bonus, inatividade, wo] |
| valor | int | Valor da transação |
| rating_antes | int | Rating antes |
| rating_depois | int | Rating depois |
| created_at | timestamp | Data de criação |

### Tabela: `ranking_snapshots`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| data_referencia | date | Data de referência |
| student_id | uuid | FK para students |
| posicao | int | Posição no ranking |
| rating | int | Rating |
| vitorias | int | Vitórias no período |
| derrotas | int | Derrotas no período |
| jogos_no_periodo | int | Jogos no período |
| inatividade | int | Dias de inatividade |

### Tabela: `news_posts`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| title | text | Título |
| slug | text | Slug único |
| resumo | text | Resumo |
| content_md | text | Conteúdo em Markdown |
| tags | text[] | Tags |
| cover_url | text | URL da capa |
| tipo | enum | [resultado] |
| published_at | timestamp | Data de publicação |
| created_by | uuid | FK para students |
| pinned | boolean | Fixado no topo |

### Tabela: `notifications`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| student_id | uuid | FK para students |
| tipo | enum | [desafio, ranking_update, news] |
| payload | jsonb | Dados extras |
| lida | boolean | Se foi lida |
| created_at | timestamp | Data de criação |

### Tabela: `live_updates` (opcional)
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| match_id | uuid | FK para matches |
| payload | jsonb | Dados do update |
| created_at | timestamp | Data de criação |

---

## Regras de Negócio / Validações

### Limite Diário
- Checagem via trigger/view em `daily_limits`
- Bloqueia 3º jogo/dia para o mesmo par de jogadores

### Partida Válida
- `resultado_a + resultado_b >= 3`
- Um deles deve ser `= 3` (melhor de 5)
- Sets devem estar alinhados com o vencedor

### Permissão de Registro
- Registro só permitido se jogador autenticado é `player_a` ou `player_b`
- Ambos confirmam para aplicar bônus de +5 pts

### Inatividade
- Aplicada por job diário (cron)
- A cada 14 dias sem jogos: -5 pts

### WO (Walk Over)
- Aplicação automática das penalidades/bonificações

---

## Fluxos Principais

### Registrar Partida
1. Escolher adversário
2. Preencher sets
3. Validar limite diário
4. Gravar `match` + `match_sets`
5. Calcular pontos (vitória/derrota/wo + bônus)
6. Salvar `rating_transactions`
7. Atualizar `rating_atual` dos dois jogadores

### Confirmar Partida
1. Jogador pendente confirma
2. Se ambos confirmam no mesmo dia → aplica bônus +5 para cada

### Notícias
- Ao validar partida concluída, criar post tipo "resultado"
- Formato: "Fulano ganhou de Sicrano por..."

### Ranking
- Consulta `students` ordenado por `rating_atual`
- Exibe streak e inatividade

### Estatísticas
- Lê `ranking_snapshots` e `rating_transactions`
- Monta gráficos e cartões

---

## Tecnologias

### Frontend
- **Next.js 14** (App Router, Server Actions)
- **TypeScript**
- **Tailwind CSS** + **shadcn/ui**
- **React Query**
- **Framer Motion**
- **next-themes**
- **PWA** (next-pwa)
- **Capacitor** para empacotar mobile

### Backend
- **Supabase**
  - Postgres
  - Auth
  - Storage
  - Realtime
  - Edge Functions
- **RLS** para segurança
- **Cron** para inatividade/snapshots

### Observabilidade
- Vercel Analytics
- Sentry (opcional)

### Testes
- **Vitest/RTL** para lógica e hooks
- **Playwright** mobile para smoke tests (ranking, registrar partida, ver notícia)

---

## API / Server Actions

### Auth
- Login magic link / OAuth
- Onboarding exige nome completo

### Partidas
- `registerMatch`
- `confirmMatch`
- `listMatches(cursor, status)`
- `updateLiveScore` (opcional)

### Ranking
- `getRanking`
- `getRankingHistory`

### Notícias
- `createResultPost` (deriva de partida)
- `listNewsFeed`

### Notificações
- Subscribe a eventos (desafios, resultados)

---

## Interações e UI

- Microanimações leves (hover/press +4px, slide de tabs)
- Toasts claros para sucesso/erro
- Estados loading/vazio em todas as listas
- Like/dislike minimal nos cards de notícias (contagem)

---

## Roadmap

1. **Setup projeto** - Next, Tailwind/shadcn, React Query, PWA + Supabase client/server
2. **Schema Supabase** - RLS + triggers de limite diário; gerar tipos TypeScript
3. **Cálculo de pontuação** - Implementar lógica interna com testes Vitest
4. **Fluxo de partidas** - register/confirm + UI Partidas/Novo Jogo
5. **Ranking + Estatísticas** - snapshots, histórico
6. **Notícias de resultados** - feed
7. **Inatividade** - cron + notificações básicas
8. **Testes e Deploy** - end-to-end mobile, Vercel + Supabase










