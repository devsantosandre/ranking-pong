# Smash Pong App
## Contexto de Negócio e Produto

> Documento atualizado com base no código da aplicação, rotas, server actions, hooks, migrations e documentação interna versionada até **23/03/2026**.
>
> Este arquivo prioriza o que está **implementado hoje**. Onde houver leitura estratégica ou hipótese comercial, isso é sinalizado como interpretação de negócio, não como fato técnico.

---

## 1. Resumo Executivo

**Smash Pong App** é uma aplicação web **mobile-first**, instalável como **PWA**, voltada para a gestão de **ranking interno de tênis de mesa** em escolas, clubes, academias e comunidades com rotina recorrente de jogos.

O produto foi evoluído de um “ranking simples com registro de partidas” para uma plataforma operacional mais completa, com:

- ranking em tempo real
- fluxo robusto de confirmação e contestação de partidas
- confirmação automática por prazo
- feed social de resultados com reações
- sistema de conquistas
- painel administrativo com métricas, auditoria e governança
- modo TV para exibição pública do ranking
- notificações push para pendências

Em termos de negócio, o app hoje resolve simultaneamente três frentes:

1. **Engajamento dos jogadores**
2. **Transparência e confiança no ranking**
3. **Redução de trabalho operacional da equipe**

---

## 2. Problema Que o Produto Resolve

O produto atende um cenário típico de ranking interno em operações esportivas:

- os alunos jogam com frequência irregular
- o ranking perde força quando depende de planilha ou gestão manual
- o professor ou gestor vira gargalo para validar resultados
- há pouca visibilidade sobre evolução individual e rivalidades
- faltam estímulos sociais para o aluno voltar a jogar

O Smash Pong App ataca essas dores com uma combinação de:

- **ritual de jogo simples**: registrar placar em poucos toques
- **governança**: só partidas validadas entram no ranking
- **pressão positiva**: ranking visível, top 3, divisões e histórico
- **dinâmica social**: feed automático de resultados e reações
- **gamificação**: conquistas por volume, vitórias, sequência, rating, atividade e veterania
- **operação assistida**: admin acompanha pendências, cancela partidas, ajusta usuários e mede engajamento

---

## 3. Público-Alvo e Cenário de Uso

### 3.1 Público principal

- escolas de tênis de mesa
- clubes recreativos
- academias com ranking interno
- comunidades fechadas de jogadores
- grupos de treino com acompanhamento recorrente

### 3.2 Perfil de usuário final

- **Jogador**: quer jogar, subir no ranking, acompanhar rivais e colecionar conquistas
- **Moderador**: opera o dia a dia, cria jogadores, reseta senha, acompanha pendências e cancela partidas
- **Admin**: governa regras, acessos, pontuação, visibilidade e parâmetros do sistema

### 3.3 Modelo operacional atual

O sistema hoje opera como **ambiente fechado**:

- não existe fluxo público de cadastro
- o acesso começa com conta criada internamente por moderador ou admin
- autenticação é por **email e senha**
- quase todas as páginas do app exigem sessão autenticada

Isso posiciona o produto como ferramenta de uso institucional, e não como rede social aberta.

---

## 4. Proposta de Valor Atual

### Para jogadores

- enxergar evolução individual de forma clara
- saber exatamente sua posição, divisão e desempenho recente
- receber reconhecimento social por vitórias, sequência e conquistas
- reagir aos resultados dos outros e acompanhar o movimento da comunidade

### Para a operação

- reduzir conferência manual de resultados
- minimizar discussão sobre placares e responsabilidade de confirmação
- ter rastreabilidade administrativa
- conseguir intervir em casos excepcionais sem quebrar o histórico

### Para a gestão

- medir frequência, atividade e engajamento do ranking
- identificar jogadores mais ativos e rivalidades
- usar o ranking como ferramenta de retenção
- reforçar a cultura competitiva da escola ou clube

---

## 5. O Produto Implementado Hoje

### 5.1 Acesso, autenticação e sessão

- login por **Supabase Auth**
- middleware protege rotas do app e redireciona para `/login` quando não há sessão
- logout limpa cache local e queries persistidas
- o app mantém cache local de dados para abrir mais rápido e revalidar em seguida

### 5.2 Home

A tela inicial já funciona como um dashboard operacional compacto.

Ela mostra:

- pontos atuais do usuário
- posição no ranking
- vitórias e derrotas
- destaques da semana:
  - líder de sequência de vitórias
  - jogador mais ativo nos últimos 7 dias
- top ranking com destaque visual forte para o topo
- preview de partidas pendentes
- preview de resultados recentes
- atalhos para registrar jogo e abrir ranking

### 5.3 Ranking

O ranking atual é mais sofisticado que uma simples lista por pontos.

Recursos implementados:

- listagem completa dos jogadores elegíveis
- busca por nome com filtro client-side
- contador global de **jogos validados**
- divisões visuais por blocos de **6 jogadores**
- destaque especial para o **Top 3**
- card individual com:
  - posição
  - nome
  - vitórias/derrotas
  - pontuação atual
- abertura de **H2H** entre o usuário logado e o jogador selecionado
- histórico completo de partidas validadas do jogador selecionado

**Importante:** as divisões são hoje uma **camada de apresentação e segmentação visual**, não ligas separadas com regras próprias.

### 5.4 Registro de jogo

O fluxo de registro foi simplificado para reduzir fricção:

- seleção de adversário via combobox
- apenas jogadores **ativos** e **visíveis no ranking** entram na lista
- placares rápidos no formato:
  - `3x0`
  - `3x1`
  - `3x2`
  - `0x3`
  - `1x3`
  - `2x3`
- prévia da variação ELO
- respeito ao limite diário configurado
- proteção contra reenvio duplicado com `requestId`

### 5.5 Partidas

A área de partidas está dividida em dois contextos:

- **Pendentes**
- **Recentes**

No fluxo pendente:

- quem registrou aguarda
- quem precisa agir pode **confirmar** ou **contestar**
- ao contestar, o placar é ajustado e a responsabilidade volta para o outro lado
- se o jogo não existiu, o jogador pode devolver a pendência para o adversário confirmar o cancelamento
- o sistema exibe prazo de resposta e urgência visual

No fluxo recente:

- só entram partidas **validadas**
- o jogador vê resultado, placar, delta de pontos e status

### 5.6 Feed de notícias

O feed atual é um **feed automático de resultados**, não um CMS editorial.

Cada partida validada gera um item com:

- vencedor e perdedor
- placar final
- pontos ganhos/perdidos
- timestamp relativo

Além disso, o feed já tem camada social:

- reações por partida
- uma reação por usuário
- troca ou remoção da própria reação
- painel com “quem reagiu”

### 5.7 Perfil do jogador

O perfil reúne status competitivo e progressão.

O usuário vê:

- nome e email
- posição, divisão e destaque visual quando está no topo
- rating atual
- vitórias/derrotas
- win rate
- streak
- histórico de rating dos últimos 7 dias
- últimas partidas validadas
- seção de conquistas

### 5.8 Configurações do perfil

O jogador pode:

- alterar a própria senha
- ver status das notificações push
- ativar notificações
- sincronizar o dispositivo
- reativar o lembrete de push dentro do app

### 5.9 Página de regras

Existe uma tela pública para usuários autenticados explicando:

- divisões do ranking
- destaque do Top 3
- lógica ELO com exemplos
- limite de jogos por dia
- rating inicial
- critérios mínimos para liberar conquistas de rating
- prazo de confirmação automática

Isso é importante do ponto de vista de negócio porque reduz percepção de “caixa-preta”.

### 5.10 Modo TV

O sistema já possui um **modo TV** em `/tv`, voltado para uso em monitores, recepção, salão ou eventos internos.

Recursos:

- ranking ao vivo
- modos `grid` e `table`
- destaque da última partida validada
- foco nos jogadores impactados pela última partida
- animação de mudança de posição
- som opcional
- modo `demo`

Esse módulo amplia o valor do produto para ambientes físicos e reforça clima de competição.

---

## 6. Regras de Negócio Atuais

### 6.1 Elegibilidade para aparecer no ranking

Para aparecer no ranking principal, o usuário precisa estar:

- com `is_active = true`
- com `hide_from_ranking = false`
- com pelo menos `1` jogo disputado

### 6.2 Formato de partida

- melhor de 5 sets
- encerra ao atingir 3 sets
- não existe empate
- o placar é armazenado como resultado agregado (`resultado_a` x `resultado_b`)

### 6.3 Limite diário de confrontos

Existe limite configurável de partidas por dia contra o mesmo adversário.

Configuração atual do produto:

- chave: `limite_jogos_diarios`
- fallback do frontend: `2`

Objetivo de negócio:

- evitar farming de pontos
- incentivar variedade de confrontos
- distribuir melhor a atividade do ranking

### 6.4 Ciclo de vida de uma partida

Estados relevantes no produto:

- `pendente`
- `edited`
- `validado`
- `cancelado`

Fluxo:

1. jogador A registra o placar
2. partida entra como `pendente`
3. jogador B confirma ou contesta
4. se contestar, partida vira `edited`
5. responsabilidade volta para o outro jogador
6. se alguém indicar que o jogo não existiu, a partida permanece como `edited`, mas a pendência passa a ser de confirmação de cancelamento
7. quando o placar é confirmado, vira `validado`
8. quando o cancelamento por jogo inexistente é confirmado, vira `cancelado`
9. moderador ou admin podem cancelar em qualquer etapa

### 6.5 Confirmação automática por prazo

O produto já implementa SLA de confirmação:

- existe um prazo configurável em horas
- se ninguém responder dentro do prazo, o sistema valida automaticamente com o placar atual
- se a pendência atual for de jogo inexistente e ninguém responder dentro do prazo, o sistema cancela automaticamente a partida

Configuração:

- chave: `pending_confirmation_deadline_hours`
- fallback do frontend: `6`

Esse comportamento reduz acúmulo de pendências e evita travamento do ranking.

### 6.6 Pontuação ELO

O ranking usa modelo **ELO**, com características atuais:

- soma zero entre vencedor e perdedor
- quanto mais improvável a vitória, maior o ganho
- derrota para jogador muito mais fraco pesa mais
- `k_factor` configurável
- `k_factor` é congelado na partida para auditoria e consistência futura

Configurações:

- `k_factor`
- `rating_inicial`

Fallbacks usados no app:

- `k_factor = 24`
- `rating_inicial = 250`

### 6.7 Impacto da validação

Só partidas **validadas**:

- alteram ranking
- entram no feed
- contam para conquistas
- entram nas métricas consolidadas
- afetam histórico competitivo do usuário

### 6.8 Cancelamento administrativo

Quando uma partida validada é cancelada:

- rating é revertido
- estatísticas são revertidas
- conquistas vinculadas àquela partida podem ser revogadas
- o evento fica registrado em log

### 6.9 Reações no feed

Regras atuais:

- só existem reações em partidas validadas
- cada usuário pode ter apenas uma reação por partida
- o usuário pode trocar ou remover sua reação

### 6.10 Observador e usuário inativo

O produto separa **papel** de **estado operacional**.

**Observador** (`hide_from_ranking = true`):

- consegue entrar no app
- não aparece no ranking
- não entra na lista de adversários
- não pode registrar partida

**Inativo** (`is_active = false`):

- sai das listagens operacionais ativas
- deixa de compor ranking e seleção normal
- preserva histórico

---

## 7. Gamificação e Retenção

### 7.1 Conquistas

O sistema de conquistas já está implementado com:

- catálogo versionado de conquistas
- categorias múltiplas
- raridades:
  - bronze
  - prata
  - ouro
  - platina
  - diamante
  - especial
- desbloqueio automático após validação de partida
- toast de celebração
- histórico no perfil

Categorias já usadas no produto:

- primeiros passos
- vitórias
- sequências
- rating
- especiais
- sociais
- veterania
- atividade
- marcos

### 7.2 Gatilhos de retenção já presentes

- streak visível
- top 3 fortemente destacado
- divisões do ranking
- feed social de resultados
- reações de outros jogadores
- painel TV
- métricas de atividade semanal
- pendências com prazo

### 7.3 Gate de maturidade para conquistas de rating

As conquistas da categoria `rating` só abrem quando o sistema atinge massa crítica mínima.

Parâmetros configuráveis:

- `achievements_rating_min_players`
- `achievements_rating_min_validated_matches`

Isso evita premiar “Top 1” ou “rating alto” cedo demais, quando a base ainda é pequena.

---

## 8. Papéis, Permissões e Governança

### 8.1 Perfis oficiais

- `player`
- `moderator`
- `admin`

### 8.2 Matriz prática de acesso

| Capacidade | Jogador | Moderador | Admin |
|------------|:-------:|:---------:|:-----:|
| Usar app principal | Sim | Sim | Sim |
| Registrar e confirmar partidas | Sim | Sim | Sim |
| Ver ranking, notícias e perfil | Sim | Sim | Sim |
| Acessar área admin | Não | Sim | Sim |
| Criar jogador | Não | Sim | Sim |
| Resetar senha de outro usuário | Não | Sim | Sim |
| Ver e cancelar partidas | Não | Sim | Sim |
| Aceitar pendência manualmente | Não | Sim | Sim |
| Ver métricas e logs | Não | Sim | Sim |
| Ver configurações | Não | Sim | Sim |
| Salvar configurações | Não | Não | Sim |
| Editar nome de outro usuário | Não | Não | Sim |
| Ajustar rating manualmente | Não | Não | Sim |
| Ativar/desativar usuário | Não | Não | Sim |
| Ocultar/mostrar no ranking | Não | Não | Sim |
| Resetar estatísticas | Não | Não | Sim |
| Alterar role de outro usuário | Não | Não | Sim |

### 8.3 Auditoria

O produto possui trilha administrativa para eventos como:

- criação de jogador
- reset de senha
- ativação/desativação
- alteração de nome
- ajuste manual de rating
- mudança de role
- ocultar/mostrar no ranking
- reset de estatísticas
- cancelamento de partida
- validação manual de pendência
- confirmação automática por sistema
- alteração de configuração

Isso é importante para ambientes com coordenação, professores e operadores.

---

## 9. Painel Administrativo Atual

O admin hoje já não é apenas um “CRUD de usuários”. Ele opera a plataforma.

### 9.1 Módulos disponíveis

- **Pendências**
- **Partidas**
- **Jogadores**
- **Métricas**
- **Configurações**
- **Histórico**
- **Painel TV**
- **Perfis e permissões**

### 9.2 Jogadores

O módulo de jogadores suporta:

- listagem paginada
- busca por nome ou email
- filtro por status
- filtro por role
- criação de novo jogador
- reset de senha
- alteração de nome
- ajuste de rating
- ativar/desativar conta
- ocultar/exibir no ranking
- reset de estatísticas
- mudança de perfil

### 9.3 Pendências

O módulo de pendências permite:

- ver fila aberta de partidas aguardando ação
- ver se a pendência é original ou contestada
- identificar quem está aguardando resposta
- visualizar timeline da pendência
- validar manualmente a partida
- cancelar a partida com motivo

### 9.4 Partidas

O módulo de partidas permite:

- listar partidas por status
- inspecionar histórico
- cancelar partidas
- reverter pontuação em partidas validadas quando aplicável

### 9.5 Configurações

Hoje o produto já administra regras de negócio sem precisar alterar código:

- `k_factor`
- `limite_jogos_diarios`
- `pending_confirmation_deadline_hours`
- `rating_inicial`
- `achievements_rating_min_players`
- `achievements_rating_min_validated_matches`

### 9.6 Métricas

O painel de métricas já mede:

- registros de partidas
- partidas validadas
- taxa de validação
- jogadores ativos
- contas ativas
- taxa de participação
- média de registros por dia
- horas desde o último registro
- maior intervalo sem atividade
- novos usuários
- pendências abertas
- ações administrativas

Também já oferece recortes analíticos como:

- visão por dia
- visão por dia da semana
- tendência mensal
- jogadores mais ativos
- jogadores mais ativos nos últimos 7 dias
- rivalidades mais frequentes
- quebra por status de partida
- quebra por tipo de ação administrativa
- insights textuais

Do ponto de vista de negócio, isso transforma o app em ferramenta de gestão de engajamento, não apenas ranking.

---

## 10. Dados, Entidades e Estrutura Operacional

### 10.1 Entidades centrais

Hoje o produto gira principalmente em torno de:

- `users`
- `matches`
- `settings`
- `notifications`
- `admin_logs`
- `achievements`
- `user_achievements`
- `match_reactions`
- `push_subscriptions`
- `match_metrics`

Também existem estruturas auxiliares e históricas, como:

- `match_sets`
- `daily_limits`
- `rating_transactions`
- `ranking_snapshots`
- `news_posts`
- `live_updates`

### 10.2 Leitura de modelagem de negócio

- `users` centraliza identidade, status, role e performance
- `matches` é o coração transacional do produto
- `settings` torna regras do ranking ajustáveis
- `notifications` sustenta a sincronização de pendências
- `admin_logs` dá governança
- `achievements` e `user_achievements` suportam gamificação
- `match_reactions` adiciona camada social
- `push_subscriptions` habilita recall operacional
- `match_metrics` expõe um total consolidado de jogos validados

### 10.3 Implicação de negócio

O sistema já está estruturado para operar como produto de ranking contínuo, com:

- rastreabilidade
- parametrização
- governança
- social layer
- analytics

Isso o coloca acima de uma solução “planilha + grupo de WhatsApp”.

### 10.4 Base tecnológica atual

O produto está implementado hoje sobre:

- **Next.js 16** com App Router
- **React 19**
- **TypeScript**
- **Tailwind CSS v4**
- **Radix UI** para primitives de interface
- **TanStack Query** para cache, sincronização e persistência local
- **Supabase** para auth, banco PostgreSQL e realtime
- **web-push + service worker** para notificações push

Em termos de arquitetura de negócio, isso significa:

- app web com custo operacional relativamente enxuto
- boa velocidade de iteração
- capacidade de observabilidade e governança sem backend tradicional separado
- viabilidade de operar como produto SaaS enxuto

---

## 11. Experiência do Usuário, PWA e Tempo Real

### 11.1 PWA

O produto é instalável como aplicativo web:

- `manifest`
- ícones dedicados
- `start_url` em `/login`
- modo standalone
- prompt de instalação
- suporte a iOS e Android/Chrome

### 11.2 Push notifications

O produto já envia push para:

- nova partida para confirmar
- placar contestado com responsabilidade transferida

Observação operacional:

- push depende de configuração VAPID no ambiente
- quando não há configuração, o produto continua funcionando sem quebrar o fluxo principal

Benefício operacional:

- reduz tempo de resposta
- diminui pendências esquecidas
- aumenta retorno do jogador ao app

### 11.3 Realtime

O app já usa atualização em tempo real para:

- pendências
- ranking
- dados derivados que afetam perfil e notícias
- modo TV

### 11.4 Resiliência de rede

O app também já tem:

- cache persistido de queries
- banner de status de rede
- retomada automática após reconexão

**Importante:** isso melhora a resiliência, mas não configura um modo offline transacional completo. O produto ainda depende de conectividade para operar fluxos críticos.

---

## 12. Leitura de Produto e Posicionamento

### 12.1 O que o Smash Pong App é hoje

Hoje o produto é melhor descrito como:

> uma plataforma de ranking interno gamificado para operação recorrente de tênis de mesa, com controle de partidas, engajamento social e gestão administrativa.

Ele já deixou de ser apenas “um app para anotar jogo”.

### 12.2 Diferenciais já implementados

- fluxo fechado e controlado por operação
- validação bilateral de resultado
- confirmação automática por SLA
- admin com governança real
- feed social com reações
- conquistas
- ranking com camadas visuais
- modo TV
- push notification
- analytics de engajamento

### 12.3 O que ainda não aparece como produto no código

Até o momento, o código não mostra implementação de:

- cobrança/assinatura dentro do app
- multi-tenant explícito para várias escolas na mesma base
- torneios, chaves ou campeonatos eliminatórios
- comentários longos no feed
- cadastro público/self-service
- app nativo dedicado

Isso significa que o posicionamento atual é forte em **ranking recorrente**, e não em gestão esportiva completa.

---

## 13. Potencial Comercial

### 13.1 Leitura estratégica

Pelo estado atual do produto, o melhor encaixe comercial parece ser:

- **SaaS para escolas e clubes**
- **ferramenta de retenção para comunidades esportivas**
- **camada digital de engajamento para ranking presencial**

### 13.2 Argumentos comerciais fortes

- aumenta frequência e recorrência de jogos
- cria senso de progresso e pertencimento
- reduz trabalho administrativo
- dá visibilidade pública ao ranking via TV
- cria memória de comunidade com feed e histórico
- melhora governança em ambientes com muitos jogadores

### 13.3 Modelos de monetização possíveis

Como hipótese comercial, o produto já suporta bem modelos como:

- mensalidade por unidade esportiva
- plano por faixa de jogadores
- setup/onboarding inicial
- add-ons premium para métricas, TV ou branding

Esses modelos **não estão implementados no código**, mas o produto já tem densidade funcional para sustentá-los.

---

## 14. Nuances Importantes e Observações

### 14.1 Este documento substitui premissas antigas

Alguns documentos históricos do repositório ainda refletem fases anteriores do produto, por exemplo:

- ranking descrito como “sem divisões”
- pontuação antiga não baseada em ELO
- rating inicial em outro valor
- notícias tratadas como posts editoriais

O estado atual do produto é o descrito neste arquivo.

### 14.2 Divisões são visuais

As divisões do ranking ajudam leitura e motivação, mas não criam regras diferentes de pontuação ou elegibilidade.

### 14.3 Notícias são feed de partidas validadas

Apesar de existir estrutura histórica para `news_posts`, a experiência atual de notícias é essencialmente um feed derivado das partidas validadas.

### 14.4 Confirmação automática é parte central da operação

O produto hoje não depende exclusivamente de moderação humana para destravar ranking. A confirmação automática virou parte da lógica principal de fluidez operacional.

### 14.5 Moderador já é papel operacional forte

O moderador não é apenas “apoio”. Ele já consegue manter a operação rodando em grande parte do dia a dia, sem acesso às decisões mais sensíveis de governança.

---

## 15. Síntese Final

O Smash Pong App evoluiu para um produto de **operação competitiva recorrente**.

Hoje ele combina:

- **sistema de ranking confiável**
- **ritual social de validação e reconhecimento**
- **camada de gamificação**
- **governança administrativa**
- **telemetria operacional**

Para o usuário final, ele transforma jogo casual em progresso visível.

Para a escola ou clube, ele transforma um ranking informal em um sistema com:

- regra
- histórico
- transparência
- engajamento
- controle

Esse é o contexto de negócio real do produto no estado atual do código.
