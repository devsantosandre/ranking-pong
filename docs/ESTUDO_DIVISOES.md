# Estudo: Divisões em Torneios

> **Status:** estudo / design — **não implementado**. Documento para discussão antes de codar.
> **Data:** 2026-06-18
> **Autor:** Claude (a pedido do organizador)
> **Regra do projeto respeitada:** nenhuma migration foi aplicada; os SQLs abaixo são esboços ilustrativos.

---

## 1. O problema

Hoje um **torneio** = uma competição única, com um único chaveamento, um único campeão.

O organizador quer rodar, **no mesmo dia/evento**, **várias divisões** em paralelo. Exemplos reais de tênis de mesa:

- **Por nível:** Divisão A (avançados), Divisão B (intermediários), Divisão C (iniciantes).
- **Por categoria:** Absoluto, Veteranos, Sub-18, Feminino.

Cada divisão é uma competição **independente e completa**:

- seu próprio conjunto de participantes;
- seu próprio formato (uma pode ser grupos+mata-mata, outra eliminatória simples);
- seu próprio chaveamento, classificação e campeão.

E o organizador quer, especificamente:

1. **Configurar** cada divisão de forma separada e organizada (sem virar uma bagunça).
2. **Visualizar na TV** trocando entre divisões (telão alternando entre A, B, C…).
3. **Navegação fácil** entre divisões tanto na administração quanto na visualização pública.

---

## 2. Terminologia — desambiguação crítica

Três conceitos parecidos coexistem. **Não confundir**:

| Conceito | O que é | Escopo | Já existe? |
|---|---|---|---|
| **Grupo** (`groupId`) | Subdivisão da *fase de grupos* dentro de **uma** competição (Grupo A, B… do groups_knockout). Os grupos depois convergem para **um** mata-mata. | Interno a um torneio | ✅ Sim |
| **Divisão** (novo) | Competição **paralela e independente** dentro de um **evento**. Cada divisão tem chaveamento e campeão próprios. Divisões **não** convergem entre si. | Um torneio = uma divisão | ❌ Não |
| **Temporada** (`seasonId`) | Período longo do **ranking ELO** (ex.: trimestre). Agrupa partidas oficiais ao longo de semanas/meses. | Macro, ranking geral | ✅ Sim |

> ⚠️ **Armadilha de design:** é tentador reaproveitar `groupId` para divisões. **Não faça.** Grupos pertencem à engine de fase-de-grupos (convergem para um bracket comum). Divisões são competições estanques. Misturar os dois quebra o `generate_bracket`, o `bracket-layout` e o `computeGroupStandings`.

---

## 3. Estado atual (resumo do que já existe)

Mapeado em detalhe — referências para fundamentar as decisões.

### 3.1 Modelo de dados (`src/lib/tournaments/types.ts`)
- `Tournament` { id, name, format, bestOf, status, seedingMethod, registrationMode, maxParticipants, **seasonId**, championUserId, championName, branding, createdBy, createdAt, finishedAt }.
- `TournamentParticipant` { id, **tournamentId**, userId, guestName, seed, **groupId**, pot, flag, … }.
- `TournamentMatch` { id, **tournamentId**, round, bracket (`winners|losers|group|placement`), slot, **groupId**, participantAId/BId, score, sets, winnerParticipantId, **nextMatchId**, nextMatchSlot, status, … }.
- **Tudo é ancorado em `tournamentId`.** Não há `divisionId`, `categoryId`, `eventId`.

### 3.2 Persistência (`src/lib/tournaments/repo/`)
- Interface `TournamentRepo` com 16 métodos (listTournaments, getTournament, createTournament, addParticipants, saveSeeding, generateBracket, reportResult, revertResult, walkover, getStandings, closeGroupStage, finishTournament, open/closeRegistration…).
- `getTournamentRepo()` escolhe `mock` vs `supabase` via `NEXT_PUBLIC_DATA_SOURCE`.
- Mock guarda tudo em `globalThis` (Maps por `tournamentId`).
- Supabase: tabelas `tournaments`, `tournament_participants`, `tournament_matches` + RPCs (`generate_bracket`, `report_match_result`, `revert_match_result`, `walkover`, `close_group_stage`) + RLS.

### 3.3 Realtime (`src/lib/realtime/use-realtime-bracket.ts`)
- Canal `tournament:${tournamentId}`, escuta `tournament_matches` com `filter: tournament_id=eq.${id}`. Coalescing de 150 ms.

### 3.4 TV (`src/app/tv/`)
- `/tv` — ranking ELO ao vivo (grid/tabela, zoom, som, anti-burn-in).
- `/tv/torneio/[id]` — roteia para **`TvBracketView`** (mata-mata) ou **`TvKingView`** (rei da mesa). Header com progresso, ticker de últimas/próximas, auto-fit + zoom.

### 3.5 Pública (`src/app/(arena)/torneios/`)
- `/torneios` — lista agrupada por status.
- `/torneios/[id]/chave` — `StandingsTable` (grupos) + `BracketCanvas` (mata-mata).

### 3.6 Admin (`src/app/admin/torneios/`)
- `/admin/torneios` — lista.
- `/admin/torneios/criar` — form (nome, formato, best-of).
- `/admin/torneios/[id]` — 5 abas: **Inscritos · Seeds · Grupos · Chave · Placar**.
- 14 server actions em `src/app/actions/tournaments.ts`.

---

## 4. Opções de modelagem

Existem três caminhos. A diferença está em **onde** a divisão vive no modelo.

### Opção A — `division_id` como nova dimensão dentro do torneio
Um `Tournament` vira o "evento guarda-chuva". Adiciona-se tabela `tournament_divisions` e coluna `division_id` em participants/matches. A engine passa a operar por `(tournament_id, division_id)`.

- ➕ Modela literalmente "um torneio com várias divisões".
- ➖ **Altíssimo custo e risco.** Toca *quase tudo*: `generate_bracket`, `report_result`, `close_group_stage`, `bracket-layout`, `BracketCanvas`, realtime (filtro), `computeGroupStandings`, as 14 actions e os endpoints de API. Cada divisão tem formato próprio → o conceito de "formato do torneio" deixa de existir no nível do torneio.
- ➖ Quebra compatibilidade com os torneios já existentes.

### Opção B — Evento agrupa torneios; **cada divisão É um torneio** ✅ recomendada
Introduz-se uma entidade leve **`tournament_events`**. Cada divisão continua sendo um `Tournament` normal, com um `event_id` que o liga ao evento e um rótulo de divisão.

- ➕ **Reuso quase total.** Bracket, standings, RPCs, realtime, TV, abas admin, ScoreSheet — tudo já funciona por `tournament_id` e **não muda**.
- ➕ **Zero breaking change.** Torneio avulso = `event_id null` (comportamento de hoje, intacto).
- ➕ Cada divisão pode ter **formato diferente** naturalmente (já que é um torneio).
- ➖ Exige uma **camada de agregação por evento** (hub admin + TV de evento + listagem). Mas é só leitura/orquestração — barato e isolado.

### Opção C — Divisão puramente "virtual" (sem tabela, via convenção de nome)
Agrupar torneios por um prefixo de nome ou uma tag textual.

- ➕ Custo quase zero.
- ➖ Frágil, sem integridade, sem branding/data compartilhados, sem ordenação confiável. Descartada.

### Veredito

```
                  Reuso   Risco   Esforço   Modela bem   Backward-compat
Opção A (div_id)   baixo    alto     alto       ★★★★★          não
Opção B (evento)   alto     baixo    médio      ★★★★☆          sim   ✅
Opção C (virtual)  alto     médio    baixo      ★☆☆☆☆          sim
```

**Recomendação: Opção B.** Entrega exatamente o que o organizador pediu (configurar/visualizar/trocar por divisão) reaproveitando toda a máquina existente, sem reescrever a engine nem arriscar os torneios atuais.

> O modelo mental do organizador ("um torneio com várias divisões") é preservado na **UX** — o evento aparece como "o torneio do dia" e as divisões como suas abas. Por baixo, cada divisão é um torneio independente, o que é a forma mais segura de implementar.

---

## 5. Modelo de dados proposto (Opção B)

> Esboço ilustrativo. **Não aplicar** — segue a regra de criar migration só quando for implementar.

### 5.1 Nova tabela `tournament_events`

```sql
create table tournament_events (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                 -- "Rachão de Sábado", "Open de Verão"
  event_date  date,                          -- o "dia do torneio"
  venue       text,                          -- local (opcional)
  branding    jsonb,                          -- logo/cores compartilhados pelas divisões
  season_id   uuid references seasons(id) on delete set null,
  created_by  uuid references users(id) not null,
  created_at  timestamptz not null default now()
);
```

### 5.2 Colunas novas em `tournaments` (todas opcionais → compatível)

```sql
alter table tournaments add column event_id        uuid references tournament_events(id) on delete set null;
alter table tournaments add column division_label  text;          -- "Divisão A", "Iniciantes", "Feminino"
alter table tournaments add column division_order  int not null default 0;  -- ordem de exibição/rotação

create index on tournaments (event_id, division_order);
```

Regras de leitura:
- `event_id IS NULL` → torneio avulso (igual a hoje).
- `event_id` preenchido → divisão de um evento; `division_label` é o nome exibido, `division_order` ordena.

### 5.3 Diagrama

```
tournament_events (o "dia"/evento)
  │  id, name, event_date, venue, branding, season_id
  │
  └──< tournaments  (cada linha = 1 DIVISÃO)
         │  event_id, division_label, division_order, format, status, …
         │
         ├──< tournament_participants   (já existe, inalterado)
         └──< tournament_matches        (já existe, inalterado)
```

**Nada nas tabelas filhas muda.** É isso que torna a Opção B barata.

---

## 6. Impacto na camada de código

| Camada | Mudança | Tamanho |
|---|---|---|
| **Tipos** | `TournamentEvent` novo; `Tournament` ganha `eventId`, `divisionLabel`, `divisionOrder`. | Pequeno |
| **Repo (interface)** | Novos: `createEvent`, `getEvent` (evento + divisões resumidas), `listEvents`, `addDivision`. Os 16 métodos atuais **não mudam**. | Pequeno |
| **Mock-repo** | Novo Map `__mockEvents`; `getEvent` agrega torneios por `eventId`. | Pequeno |
| **Supabase-repo** | Queries da nova tabela; CRUD de divisão = `createTournament` com `event_id`. RPCs **inalteradas**. | Pequeno |
| **Actions** | `createEvent`, `addDivision`, `updateEvent`, `setDivisionOrder`. As 14 existentes ganham, no máximo, `eventId` opcional no create. | Pequeno |
| **generate_bracket / report_result / standings / layout / realtime** | **Nenhuma mudança.** Operam por `tournament_id` (= divisão). | Zero ✅ |
| **Admin UI** | Hub de evento + seletor de divisão (ver §7). | Médio |
| **TV UI** | Rota `/tv/evento/[id]` com seletor + auto-rotação (ver §8). | Médio |
| **Pública UI** | Listagem agrupa por evento; navegação entre divisões (ver §9). | Médio |

O grosso do trabalho é **UI de orquestração**, não engine. Esse é o objetivo da Opção B.

---

## 7. UX — Administração

### 7.1 Hub do evento `/admin/eventos/[id]`

Tela-mãe que lista as divisões como cards e dá acesso rápido à config de cada uma.

```
┌─────────────────────────────────────────────────────────────┐
│  ← Rachão de Sábado · 18/06           [TV do evento] [Editar]│
│  3 divisões · 38 jogadores                                   │
├─────────────────────────────────────────────────────────────┤
│  DIVISÕES                                    [ + Nova divisão]│
│                                                              │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐      │
│  │ A · Avançados │ │ B · Inter.    │ │ C · Iniciantes│      │
│  │ Grupos+KO     │ │ Elim. simples │ │ Round-robin   │      │
│  │ 16 inscritos  │ │ 12 inscritos  │ │ 10 inscritos  │      │
│  │ ● Em andamento│ │ ◐ Inscrições  │ │ ○ Rascunho    │      │
│  │ Semifinais    │ │               │ │               │      │
│  │   [Configurar]│ │   [Configurar]│ │   [Configurar]│      │
│  └───────────────┘ └───────────────┘ └───────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

- **"+ Nova divisão"** abre o form de criação já com `event_id` preenchido — o admin escolhe label, formato e best-of por divisão.
- **"Configurar"** leva a `/admin/torneios/[divisionId]` — **a página de 5 abas que já existe, 100% reaproveitada.**
- Cada card mostra status real (rascunho / inscrições / em andamento / encerrado) e a fase atual.

### 7.2 Navegação rápida entre divisões (dentro da config)

No topo de `/admin/torneios/[id]`, quando o torneio tem `event_id`, um seletor permite saltar entre divisões sem voltar ao hub:

```
┌─────────────────────────────────────────────────────────────┐
│  ◀  [ A · Avançados ]  B · Inter.   C · Iniciantes  ▶   ⌂ Hub │
├─────────────────────────────────────────────────────────────┤
│  Inscritos · Seeds · Grupos · Chave · Placar                 │
│  …(abas atuais, inalteradas)…                                │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 Criação do evento

Novo fluxo `/admin/eventos/criar`: nome, data, local (opcional), branding. Depois adiciona divisões pelo hub.
Alternativa de baixo atrito: ao criar um torneio, permitir "pertence a um evento?" e escolher/criar o evento ali.

---

## 8. UX — TV (o pedido central: trocar entre divisões)

### 8.1 Nova rota `/tv/evento/[id]`

Telão do evento com **seletor de divisão** + render da divisão ativa (reusa `TvBracketView`/`TvKingView` por divisão).

```
┌─────────────────────────────────────────────────────────────┐
│  RACHÃO DE SÁBADO                            🔴 2 ao vivo  📶 │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐               │
│  │● A·Avançados│ │ B·Inter.   │ │ C·Iniciantes│  ⟳ auto 15s  │
│  └────────────┘ └────────────┘ └────────────┘               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│            ‹ TvBracketView da divisão ativa ›                │
│         (o mesmo componente de hoje, sem mudança)            │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  ✓ João venceu  ·  Próx: Ana × Bia  ·  Próx: Léo × Tom       │
└─────────────────────────────────────────────────────────────┘
```

Funcionalidades:
- **Seletor de divisão** (chips no topo) — clique troca a divisão exibida.
- **Auto-rotação** opcional (`?rotate=15`) — cicla A → B → C → A a cada N segundos. Ideal para telão sem operador.
- **Indicador "ao vivo"** por divisão (pisca quem tem partida em andamento) — a rotação pode **priorizar** divisões com jogos ao vivo.
- Mantém zoom, ticker e anti-burn-in já existentes.

### 8.2 Como funciona por baixo
Cada divisão é um `tournament_id` → o `useRealtimeBracket` já sabe escutar por torneio. A TV de evento assina o realtime da divisão ativa (e, opcionalmente, um "heartbeat" leve das demais para o indicador "ao vivo").

`/tv/torneio/[id]` continua existindo para torneio avulso.

---

## 9. UX — Visualização pública

- **`/torneios`**: torneios que pertencem a um evento aparecem **agrupados** sob o card do evento ("Rachão de Sábado · 3 divisões") em vez de 3 cards soltos.
- **`/eventos/[id]`** (nova): página do evento com abas de divisão; cada aba carrega a `chave` daquela divisão (StandingsTable + BracketCanvas atuais).
- **`/torneios/[id]/chave`** ganha, quando há `event_id`, um seletor de divisão no topo (mesma ideia da TV) para o público trocar.

---

## 10. Plano de implementação faseado (quando for a hora)

Mock-first, como manda a regra do projeto.

| Fase | Entrega | Depende de |
|---|---|---|
| **F1 — Modelo** | Migration `tournament_events` + colunas em `tournaments`; tipos; mock-repo (`__mockEvents`, `getEvent`). Tudo opcional → não quebra nada. | — |
| **F2 — Admin hub** | `/admin/eventos` (lista), `/admin/eventos/[id]` (hub com cards de divisão), `/admin/eventos/criar`, "+ Nova divisão". | F1 |
| **F3 — Navegação admin** | Seletor de divisão no topo de `/admin/torneios/[id]`. | F2 |
| **F4 — TV de evento** | `/tv/evento/[id]` com seletor + auto-rotação + indicador ao vivo. | F1 |
| **F5 — Pública** | Agrupamento em `/torneios`, página `/eventos/[id]`, seletor na `chave`. | F1 |
| **F6 — Supabase** | Migration real + supabase-repo + RLS da nova tabela. (Aplicada manualmente pelo organizador.) | F1–F5 validados no mock |

Cada fase é entregável e reversível isoladamente.

---

## 11. Edge cases e decisões

> Decisões 1, 4 e 6 **resolvidas com o organizador em 2026-06-18**.

1. **Mesmo jogador em duas divisões?** ✅ **DECIDIDO: SIM, pode.** Um jogador pode disputar Absoluto e Veteranos no mesmo evento. Como cada divisão é um torneio independente, ele vira um `participant` separado por divisão — já funciona nativamente, sem trabalho extra. Como o ELO é isolado (item 6), não há risco de dupla contagem no ranking.
2. **Mover jogador entre divisões** após inscrito (estava na B, joga melhor → sobe pra A). Útil ter um "mover para divisão…" no admin. **Refinamento futuro.**
3. **Distribuição automática por nível.** Helper "distribuir N inscritos em divisões por ranking" — encaixaria no hub. **Refinamento futuro.**
4. **Campeão do evento vs. campeão por divisão.** ✅ **DECIDIDO: só por divisão.** Cada divisão coroa seu próprio campeão (já existe). **Não** haverá "campeão geral do evento" — níveis diferentes não se comparam.
5. **Best-of por divisão.** Naturalmente independente (cada divisão é um torneio). ✔️
6. **Relação com ELO/temporada.** ✅ **DECIDIDO: isoladas.** Divisões **não** afetam o ranking ELO geral nem a temporada — seguem a regra do Rachão. Consequência de modelagem: `tournament_events.season_id` torna-se **opcional/dispensável** (pode ficar como metadado de organização, mas sem efeito no ELO). Os resultados das divisões não disparam triggers de ELO (já garantido por usarem `tournament_matches`, que não dispara ELO).
7. **Quantas divisões por evento?** Sem limite técnico; a UI (chips/cards) deve aguentar ~6 com conforto.
8. **Conflito de agenda (jogador em 2 divisões com partidas ao mesmo tempo).** Validado pela indústria (SPORT Software bloqueia). **Só se aplica quando houver agendamento por mesa/horário** — hoje não há, então é **refinamento futuro**. Por ora, a responsabilidade é do organizador.

---

## 12.5. Validação com a prática de torneios (pesquisa — 2026-06-18)

Antes de implementar, o design foi confrontado com como softwares de torneio reais resolvem o problema. **A Opção B está alinhada com a indústria:**

- **Challonge** tem uma feature **"Event"** que agrupa **múltiplos torneios independentes** numa página só (para convenções com vários torneios no mesmo dia) — é **literalmente a Opção B** (evento agrupa torneios; cada divisão é um torneio). Confirma também a separação entre *Group Stage* (grupos que convergem num torneio) e *Event* (torneios paralelos) → valida nossa desambiguação §2.
- **PLAYINGA**: "um torneio pode ter múltiplas divisões (ex.: U19, Mens Singles)" com estatísticas **agregadas por divisão e por torneio** — confirma o modelo mental do organizador ("evento do dia" + abas de divisão).
- **TV/telão**: **Score7** usa `?interval=N` (range **5–120s**, default **15s**) para ciclar slides automaticamente; **Scoreholio** rotaciona entre quadras e o bracket. Nosso `/tv/evento/[id]?rotate=N` (§8) adota a **mesma convenção** — ajustar para range 5–120s, default 15s, e priorizar divisões com jogo ao vivo.
- **Terminologia**: a indústria usa "divisão", "categoria" e "evento" de forma sobreposta (divisão por nível/rating band; categoria por tipo — Absoluto/Veteranos/Feminino). Nosso `division_label` é **texto livre**, então cobre os dois sem mudança de modelo.

**Refinamentos que a pesquisa acrescentou (futuros, não bloqueiam a implementação):**
- **Conflito de agenda**: o SPORT Software bloqueia um jogador de jogar em duas disciplinas ao mesmo tempo. Como o mesmo jogador pode estar em várias divisões (decisão §11.1), isso vira relevante **quando houver agendamento por mesa/horário** — até lá, não se aplica. Adicionado como edge case §11.8.
- **Distribuição por rating band**: PlayPass cria divisões balanceadas por faixa de rating (ex.: 1400–1599). Casa com o refinamento §11.3 (distribuir inscritos por divisão usando o ELO).

**Veredito da validação:** plano de acordo, sem erros estruturais. Prosseguir com a Fase F1 (mock-first).

Fontes: [Challonge — Competition Formats](https://kb.challonge.com/en/article/learn-about-challonge-competition-formats-1f8j1cf/) · [PLAYINGA — Table Tennis](https://playinga.com/en/table-tennis-tournament-software/) · [Score7 — TV no telão](https://kb.score7.io/blog/guides/display-tournament-on-tv-venue-monitor/) · [Scoreholio — Dashboard na TV](https://docs.scoreholio.com/scoreboards-and-dashboards/display-dashboard-on-a-tv) · [PlayPass — Table Tennis Scheduler](https://playpass.com/sports-software/table-tennis-schedule-maker)

---

## 12. Resumo executivo

- **O que muda no banco:** 1 tabela nova (`tournament_events`) + 3 colunas opcionais em `tournaments`. Nada nas tabelas de participantes/partidas.
- **O que NÃO muda:** toda a engine de chaveamento, RPCs, realtime, standings, layout, ScoreSheet e a página admin de 5 abas.
- **O que se constrói:** uma camada de **orquestração por evento** — hub admin, seletor de divisão, TV de evento com troca/rotação, agrupamento público.
- **Por quê assim:** entrega o pedido (configurar, visualizar e trocar por divisão) com **risco baixo** e **reuso máximo**, sem tocar no que já funciona.

> **Próximo passo sugerido:** validar a Opção B e as questões em aberto da §11 (especialmente #1, #4 e #6). Com isso fechado, começamos pela Fase F1 no mock.
