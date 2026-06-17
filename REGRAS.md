# Ranking Pong — Regras e Funcionamento

> **Documento de referência** para jogadores, admins e desenvolvedores.
> Reflete o estado atual do sistema (2026).

---

## Visão Geral

App mobile-first (PWA instalável) de ranking interno de tênis de mesa.
Dois sistemas de pontuação rodam em paralelo, sem interferência mútua:

| Sistema | Base | Zera? | Campeão? |
|---------|------|-------|---------|
| **Ranking Geral** | ELO (rating vitalício) | Nunca | — |
| **Temporada** | Pontos por período | A cada temporada | 🏆 Hall da Fama |

---

## Ranking Geral (ELO)

### Pontuação Inicial
- Todos começam com **1 000 pts ELO**

### Cálculo de Pontos
- Baseado no **sistema ELO** — a variação depende do rating relativo dos dois jogadores
- Quanto maior a diferença de rating, menor o ganho para o favorito e maior para o zebra
- Fator K configurável via painel admin (padrão: **24**)

### Bônus de Zebra
- Aplicado quando um jogador de rating significativamente menor vence o favorito
- Bônus adicional sobre a variação normal do ELO

### Inatividade
- Aplicada automaticamente para jogadores sem partidas por período prolongado
- Consultável em `/admin/configuracoes`

---

## Temporadas

### O que é uma Temporada
- Período competitivo com início e fim definidos pelo admin
- Pontuação **zerada** a cada nova temporada — parte do zero
- Roda em **paralelo** ao ELO: uma partida conta para ambos ao mesmo tempo

### Ciclo de Vida
```
Agendada (upcoming) → Ativa (active) → Encerrada (closed)
                                ↑                    ↓
                           [Reabrir]            Hall da Fama
```
- **Agendada**: criada pelo admin, ainda não iniciada
- **Ativa**: aberta para partidas; apenas **uma** temporada ativa por vez
- **Encerrada**: posições congeladas; campeão definido

### Pontuação da Temporada
Configurável em `/admin/configuracoes`:

| Resultado | Padrão |
|-----------|--------|
| Vitória | +3 pts |
| Derrota | +1 pt (nunca negativo — incentiva jogar) |
| Bônus de Zebra | +2 pts (quando habilitado) |

> Bônus de zebra: habilitado/desabilitado pelo admin. Aplicado ao vencedor quando vence alguém de rating ELO significativamente maior.

### Desempate
Em caso de empate de pontos, usa-se em cascata:
1. Pontos (primário)
2. Aproveitamento — `vitórias / jogos` (win rate)
3. Número de vitórias
4. Número de jogos disputados

### Campeão
- **1 campeão** por temporada: o jogador na posição 1 ao encerrar
- Conquista `season_champion` concedida automaticamente
- Notícia publicada no feed
- Push notification enviado a todos os participantes
- Nome registrado no **Hall da Fama** (`/temporadas`)

---

## Formato das Partidas

- Partidas sempre **melhor de 5 sets** (encerra ao atingir 3 sets vencidos)
- **Sem empates**
- Limite: máximo **2 confrontos por dia** contra o mesmo adversário

### Fluxo de Confirmação

```
Registro (criado_por) → Pendente → Confirmação pelo oponente → Validado ✓
                                         ↓
                                   Contestar (novo placar) → Pendente transferida
                                         ↓
                                   Jogo não existiu → Pendente de cancelamento
```

1. **Registrar**: cria partida pendente; oponente é notificado
2. **Confirmar**: aplica pontos ELO e pontos de temporada (se houver temporada ativa)
3. **Contestar**: ajusta o placar e devolve a pendência ao outro jogador
4. **Jogo não existiu**: solicita cancelamento; o outro lado precisa confirmar

---

## Conquistas

Desbloqueadas automaticamente ao atingir marcos:
- Número de vitórias (bronze → diamante)
- Sequências (streak)
- Marco de rating ELO
- **Campeão de temporada** (`season_champion`) — concedida pelo `close_season`

Ver lista completa em `docs/CONQUISTAS.md`.

---

## Painel Admin

Acessível a usuários com role `admin` ou `moderator`:

| Área | Ação |
|------|------|
| `/admin/temporadas` | Criar, editar, ativar, encerrar, reabrir temporadas |
| `/admin/configuracoes` | Ajustar K factor, limite diário, pontos de temporada, bônus de zebra |
| `/admin/usuarios` | Ativar/desativar jogadores, ajustar rating |
| `/admin/partidas` | Cancelar, corrigir partidas |
| `/admin/logs` | Auditoria de ações administrativas |

---

## Navegação

### Bottom Navigation (mobile)
- **Home** — resumo, partidas recentes, cartão da temporada ativa
- **Partidas** — histórico e pendências de confirmação
- **Registrar** (FAB) — wizard de novo jogo
- **Ranking** — abas Temporada e Geral
- **Mais** — Notícias, Temporadas (Hall da Fama), Regras, Perfil, Admin

---

## Tecnologias

| Camada | Stack |
|--------|-------|
| Frontend | Next.js 16, TypeScript, Tailwind CSS v4, shadcn/ui, React Query (TanStack v5) |
| Backend | Supabase (PostgreSQL, Auth, Realtime, RLS) |
| Testes | Vitest (unit + integração), Playwright (E2E) |
| Deploy | Vercel (frontend) + Supabase self-hosted (HML e prod) |

---

## Links Rápidos

- Banco de dados: `docs/BANCO_DE_DADOS.md`
- Cálculo ELO: `docs/ELO.md`
- Conquistas: `docs/CONQUISTAS.md`
- Rachão/Torneios (próxima fase): `docs/RACHAO_TORNEIOS.md`
