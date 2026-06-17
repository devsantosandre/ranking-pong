# Design — Módulo de Rachão / Torneios

> Próxima fase de desenvolvimento após as Temporadas.
> Documento de design para orientar a implementação.

---

## Contexto

**Rachão** é o nome interno para torneiozinhos presenciais realizados durante o dia na escola de tênis de mesa. São eventos curtos, com 8–16 participantes, onde o admin monta o chaveamento na hora e vai avançando as partidas à medida que ocorrem.

**Inspiração:** app [Tourney](https://tourney.io) — focado em tênis de mesa, interface visual de chave.

**Regra de ouro:** o rachão **não mexe no ELO nem no fluxo de partidas testado** — é um módulo separado. Integração com ELO/Temporada é futura e opcional.

---

## Formatos Previstos (por fase)

### MVP (Fase 1)
- **Eliminatória simples** — chave visual tipo árvore, vencedor avança
- **Rei da mesa** — desafiante enfrenta o atual "rei"; vence quem acumula mais reinos consecutivos

### Escola (Fase 2) — prioritária
- **Todos-contra-todos** (round robin)
- **Grupos + mata-mata** — divide em grupos, top 2 de cada grupo vão ao mata-mata

> **IMPORTANTE:** O rachão real da escola usa **fase de grupos + mata-mata**. O módulo precisa suportar esse formato desde a Fase 2.

### Futuro (Fase 3)
- Dupla eliminação
- Semeação pelo ranking ELO
- Torneios com inscrição prévia e limite de vagas

---

## Jogadores Convidados (Essencial)

Muitos alunos da escola **não têm conta no app**. O módulo precisa suportar participantes avulsos, cadastrados apenas com nome para aquele torneio.

Tipos de participante:
- **Conta registrada** — usuário com login no app; partidas vinculadas ao perfil
- **Convidado avulso** — só nome, sem conta; aparece no chaveamento mas não gera histórico

---

## Modelo de Dados

### `tournaments`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | PK |
| `name` | text | Nome do torneio |
| `format` | enum | `single_elimination`, `round_robin`, `groups_knockout`, `king_of_table` |
| `best_of` | integer | Melhor de N sets (3, 5, 7) |
| `status` | enum | `draft`, `active`, `finished` |
| `champion_user_id` | uuid | FK -> users (null para convidados) |
| `champion_name` | text | Nome do campeão (para convidados) |
| `season_id` | uuid | FK -> seasons (null = sem vínculo) |
| `created_by` | uuid | FK -> users |
| `created_at` | timestamptz | — |
| `finished_at` | timestamptz | — |

### `tournament_participants`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | PK |
| `tournament_id` | uuid | FK -> tournaments |
| `user_id` | uuid | FK -> users (null para convidados) |
| `guest_name` | text | Nome do convidado (null se user_id preenchido) |
| `seed` | integer | Semeação no chaveamento |
| `group_id` | text | Grupo (A, B, C...) — para formato grupos |
| `created_at` | timestamptz | — |

**Constraint:** `user_id IS NOT NULL OR guest_name IS NOT NULL`

### `tournament_matches`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | PK |
| `tournament_id` | uuid | FK -> tournaments |
| `round` | integer | Rodada (1 = final, 2 = semi, etc.) |
| `group_id` | text | Grupo (null para mata-mata) |
| `participant_a_id` | uuid | FK -> tournament_participants |
| `participant_b_id` | uuid | FK -> tournament_participants |
| `score_a` | integer | Sets vencidos por A |
| `score_b` | integer | Sets vencidos por B |
| `winner_participant_id` | uuid | FK -> tournament_participants |
| `next_match_id` | uuid | FK -> tournament_matches (avança vencedor na árvore) |
| `status` | enum | `pending`, `in_progress`, `finished` |
| `created_at` | timestamptz | — |
| `finished_at` | timestamptz | — |

---

## Integração com o App Atual

### Reutilizar

| Recurso | Como usar |
|---------|-----------|
| `/tv` | Projetar o chaveamento ao vivo durante o rachão |
| Padrões de campeão | Celebração visual, conquista, notícia — igual ao encerramento de temporadas |
| `AppShell` | Wrapper de todas as telas do módulo |
| `ConfirmModal` | Ações de encerrar torneio, declarar campeão |
| Push notifications | Notificar participantes quando for a vez de jogar |

### Integração Futura (opcional)
- Vencer um rachão pode conceder conquista `tournament_champion`
- Vencer um rachão pode dar pontos de temporada (configurável pelo admin)
- Histórico de rachões no perfil do jogador

---

## Telas Previstas

### Para Jogadores
- `/rachao` — lista de torneios ativos e passados
- `/rachao/[id]` — chaveamento visual ao vivo (atualizações em realtime)
- `/tv` — versão projeção (já existe)

### Para Admin
- `/admin/rachao` — criar, editar, encerrar torneios
- `/admin/rachao/[id]` — gerenciar participantes, lançar resultados

---

## Restrições de Implementação

1. **NÃO alterar** o cálculo de ELO nem as funções hardened (`validate_pending_match_v2`, `cancel_match_v2`)
2. **NÃO usar** a tabela `matches` para partidas de torneio — usar `tournament_matches` separada
3. **NÃO aplicar** migrations em produção diretamente — só criar os arquivos; o usuário aplica
4. `tournament_matches` **não dispara** os triggers de ELO nem de standings de temporada

---

## Ordem Sugerida de Implementação

1. **Migrations** — criar tabelas `tournaments`, `tournament_participants`, `tournament_matches`
2. **Admin: criar torneio** — formulário simples (nome, formato, melhor-de)
3. **Admin: adicionar participantes** — busca de usuários + campo livre para convidados
4. **Admin: montar chaveamento** — geração automática do bracket (aleatório ou por seed)
5. **UI pública: `/rachao/[id]`** — visualização do bracket com realtime
6. **Admin: lançar resultados** — click nas partidas para registrar placar
7. **Rei da mesa** — formato alternativo mais simples
8. **Grupos + mata-mata** — fase 2, mais complexa

---

## Referências

- Design das Temporadas: `docs/PLANO_TEMPORADAS.md`
- Banco de dados atual: `docs/BANCO_DE_DADOS.md`
- Guia de UI: `docs/DESIGN_CONSISTENCIA.md`
