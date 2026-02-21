# Sistema de Conquistas

Sistema de gamificação estilo Steam/Xbox para reconhecer feitos dos jogadores. As conquistas são puramente cosméticas e não afetam o ranking ou pontuação ELO.

---

## Visão Geral

- **Total de conquistas:** 40
- **Categorias:** 9
- **Raridades:** Bronze, Prata, Ouro, Platina, Diamante, Especial

As conquistas são verificadas automaticamente após cada partida confirmada. Quando uma conquista é desbloqueada, o jogador recebe uma notificação visual (toast) com os detalhes.

---

## Categorias e Conquistas

### 1. Primeiros Passos (Bronze)

Conquistas iniciais para novos jogadores.

| Conquista | Descrição | Condição |
|-----------|-----------|----------|
| Primeiro Saque | Jogou sua primeira partida | 1 jogo |
| Primeira Vitória | Venceu sua primeira partida | 1 vitória |
| Aquecendo | Jogador em desenvolvimento | 25 jogos |
| Jogador Regular | Presença constante no ranking | 100 jogos |

### 2. Vitórias (Prata)

Reconhecem o acúmulo de vitórias ao longo do tempo.

| Conquista | Descrição | Condição |
|-----------|-----------|----------|
| Vencedor | Primeiras conquistas significativas | 25 vitórias |
| Experiente | Jogador consistente | 50 vitórias |
| Veterano | Muitas batalhas vencidas | 100 vitórias |
| Lenda | Status lendário | 200 vitórias |

### 3. Sequências (Ouro)

Premiam vitórias consecutivas sem derrotas.

| Conquista | Descrição | Condição |
|-----------|-----------|----------|
| Em Chamas | Sequência impressionante | 5 vitórias seguidas |
| Imparável | Difícil de parar | 7 vitórias seguidas |
| Dominante | Domínio absoluto | 12 vitórias seguidas |
| Invencível | Praticamente imbatível | 20 vitórias seguidas |

### 4. Rating/Ranking (Platina)

Baseadas na pontuação ELO e posição no ranking.

| Conquista | Descrição | Condição |
|-----------|-----------|----------|
| Subindo | Evoluindo no ranking | Rating 1100+ |
| Elite | Jogador de elite | Rating 1300+ |
| Mestre | Maestria no esporte | Rating 1500+ |
| Top 10 | Entre os 10 melhores | Posição 1-10 |
| Pódio | No pódio | Posição 1-3 |
| Campeão | O melhor do ranking | Posição 1 |

**Regra de maturidade da categoria Rating**

As conquistas da categoria `rating` só são avaliadas quando o sistema atingir massa crítica:
- Mínimo de jogadores com jogo validado
- Mínimo de partidas validadas globais

Por padrão, os limites são `6` jogadores e `20` partidas, configuráveis em `settings` pelas chaves:
- `achievements_rating_min_players`
- `achievements_rating_min_validated_matches`

### 5. Especiais (Diamante)

Conquistas únicas que exigem situações específicas.

| Conquista | Descrição | Condição |
|-----------|-----------|----------|
| Perfeito | Vitória sem dar set | Vencer 3x0 |
| Maratonista | Dia intenso de treino | 8 jogos em um dia |
| Consistente | Alta taxa de vitória | 65%+ winrate (mín. 20 jogos) |
| Azarão | Vitória improvável | Vencer oponente 250+ pts acima |

### 6. Sociais (Especial)

Relacionadas à interação com outros jogadores.

| Conquista | Descrição | Condição |
|-----------|-----------|----------|
| Rivalidade | Grande rival | 10 jogos vs mesmo oponente |
| Popular | Conhecido na escola | 15 oponentes diferentes |
| Viajante | Jogou contra todos | 30 oponentes diferentes |

### 7. Veterania (Especial)

Baseadas no tempo de permanência na escola.

| Conquista | Descrição | Condição |
|-----------|-----------|----------|
| Novato | Bem-vindo! | Criou conta |
| 1 Mês | Primeiro mês completo | 30 dias na escola |
| Semestre | Meio ano de dedicação | 180 dias na escola |
| Aniversário | Um ano de história | 365 dias na escola |
| Veterano | Veterano da escola | 730 dias (2 anos) |
| Lenda Viva | Parte da história | 1095 dias (3 anos) |

### 8. Atividade (Especial)

Premiam participação regular e constante.

| Conquista | Descrição | Condição |
|-----------|-----------|----------|
| Ativo | Participação regular | 4 semanas consecutivas |
| Dedicado | Dedicação ao esporte | 8 semanas consecutivas |
| Comprometido | Comprometimento total | 12 semanas consecutivas |
| Assíduo | Presença garantida | 6 meses com jogos |
| Maratonista Anual | Um ano inteiro ativo | 12 meses com jogos |
| Frequência Perfeita | Nunca falta | 12 semanas seguidas |

### 9. Marcos (Especial)

Conquistas relacionadas a momentos específicos.

| Conquista | Descrição | Condição |
|-----------|-----------|----------|
| Primeira Semana | Início promissor | Jogar nos primeiros 7 dias |
| Início Forte | Começou com tudo | 20 jogos no primeiro mês |
| Retorno Triunfal | Voltou após ausência | Jogar após 30+ dias inativo |

---

## Sistema de Raridade

As conquistas possuem diferentes níveis de raridade, indicando sua dificuldade:

| Raridade | Cor | Dificuldade |
|----------|-----|-------------|
| Bronze | Âmbar | Fácil - Conquistas iniciais |
| Prata | Cinza | Média - Requer dedicação |
| Ouro | Amarelo | Difícil - Feitos notáveis |
| Platina | Ciano | Muito Difícil - Elite |
| Diamante | Roxo | Extrema - Raríssimas |
| Especial | Rosa | Única - Situações específicas |

---

## Como Funciona

### Verificação Automática

1. Jogador A registra uma partida
2. Jogador B confirma o resultado
3. Sistema atualiza estatísticas (vitórias, rating, streak)
4. Sistema verifica conquistas do jogador que confirmou (fluxo síncrono)
5. Sistema verifica conquistas do adversário em background (best-effort)
6. Conquistas atingidas são salvas em `user_achievements`
7. Toast de celebração é exibido para o jogador que confirmou

### Fluxo Técnico

```
confirmMatchAction()
    ↓
Atualiza stats do vencedor e perdedor
    ↓
checkAndUnlockAchievements(meuContext)      [aguardado]
checkAndUnlockAchievements(opponentContext) [background]
    ↓
Retorna apenas conquistas do usuário que confirmou
    ↓
Frontend exibe toast de celebração
```

### Execução e Segurança

- Em server action, o módulo usa `service_role` quando disponível para evitar falha de RLS ao desbloquear conquista para outro usuário.
- Se houver falha ao gravar alguma conquista, o fluxo principal da confirmação continua.
- O desbloqueio usa `upsert` com `onConflict (user_id, achievement_id)` para evitar duplicação em concorrência.
- A verificação usa cache curto de conquistas ativas e cache por execução para reduzir consultas repetidas.

---

## Visualização

### No Perfil

As conquistas aparecem na página de perfil do jogador:
- Grid com todas as conquistas
- Conquistas desbloqueadas: coloridas com ícone
- Conquistas bloqueadas: cinza com "?"
- Barra de progresso geral
- Filtros por categoria
- Estatísticas por raridade

### Toast de Desbloqueio

Quando uma conquista é desbloqueada:
- Animação de celebração
- Ícone e nome da conquista
- Descrição
- Indicador de raridade
- Auto-fecha após 5 segundos

---

## Estrutura de Dados

### Tabela `achievements`

```sql
CREATE TABLE achievements (
  id UUID PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,        -- Identificador único
  name TEXT NOT NULL,              -- Nome exibido
  description TEXT NOT NULL,       -- Descrição
  category TEXT NOT NULL,          -- Categoria
  rarity TEXT NOT NULL,            -- Raridade
  icon TEXT,                       -- Emoji do ícone
  points INT DEFAULT 0,            -- Pontos (futuro)
  condition_type TEXT NOT NULL,    -- Tipo de condição
  condition_value INT NOT NULL,    -- Valor para desbloquear
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ
);
```

### Tabela `user_achievements`

```sql
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,           -- Jogador
  achievement_id UUID NOT NULL,    -- Conquista
  unlocked_at TIMESTAMPTZ,         -- Data de desbloqueio
  match_id UUID,                   -- Partida que desbloqueou
  UNIQUE(user_id, achievement_id)
);
```

---

## Tipos de Condição

| Tipo | Descrição | Exemplo |
|------|-----------|---------|
| `jogos` | Total de partidas | 25 jogos |
| `vitorias` | Total de vitórias | 50 vitórias |
| `streak` | Vitórias consecutivas | 7 streak |
| `rating` | Pontuação ELO | 1300 pts |
| `posicao` | Posição no ranking | Top 10 |
| `perfect` | Vitória 3x0 | - |
| `jogos_dia` | Partidas em um dia | 8 jogos |
| `winrate` | Taxa de vitória | 65% |
| `underdog` | Diferença de rating | +250 pts |
| `h2h` | Jogos vs mesmo oponente | 10 jogos |
| `oponentes_unicos` | Oponentes diferentes | 15 |
| `dias_escola` | Dias desde cadastro | 365 dias |
| `semanas_consecutivas` | Semanas seguidas ativas | 12 semanas |
| `meses_ativos` | Meses com atividade | 6 meses |
| `primeira_semana` | Atividade na 1ª semana | - |
| `jogos_primeiro_mes` | Jogos no 1º mês | 20 jogos |
| `retorno` | Dias de inatividade | 30 dias |

---

## Arquivos do Sistema

```
src/
├── lib/
│   ├── achievements.ts              # Lógica de verificação
│   └── queries/
│       └── use-achievements.ts      # Hooks React Query
├── components/
│   ├── achievement-badge.tsx        # Badge visual
│   ├── achievement-unlock-toast.tsx # Toast de desbloqueio
│   └── achievements-section.tsx     # Seção no perfil
└── app/
    ├── actions/
    │   └── matches.ts               # Integração na confirmação
    └── perfil/
        └── page.tsx                 # Exibição no perfil
```

---

## Notas Importantes

1. **Sem impacto competitivo**: Conquistas são puramente cosméticas
2. **Não retroativo**: Conquistas são verificadas apenas em novas partidas
3. **Verificação em tempo real**: Acontece automaticamente após confirmação
4. **Cache otimizado**: Conquistas usam React Query com staleTime configurado
5. **Suporte a múltiplas conquistas**: Várias podem ser desbloqueadas na mesma partida
6. **Auto-recuperação**: Se ocorrer erro ao desbloquear, a conquista será verificada novamente na próxima partida
7. **Race condition safe**: Usa upsert com `onConflict` para evitar duplicação
8. **Cancelamento de partida**: Conquistas vinculadas à partida cancelada são revogadas automaticamente
9. **K factor registrado**: O K factor do ELO usado no momento da confirmação é armazenado na partida para auditoria
