# Smash Pong Arena — Especificação de Execução (build-ready)

> Companion técnico de `docs/ARENA_REDESIGN_ESTUDO.md`. Aqui está o detalhe para **começar a codar**: árvore de arquivos, tipos, DDL, RPCs, algoritmos, contratos de componentes, hooks, testes e Definition of Done.
>
> **Regras inegociáveis:** (1) ELO e fluxo hardened de partidas portados **sem alterar a matemática**, re-testados; (2) **migrations só em arquivo** — o usuário aplica; (3) torneios em tabelas próprias, **sem triggers de ELO/temporada**; (4) toda ação importante passa por **`ConfirmModal`**; (5) PT-BR com acentuação; (6) reusar > inventar (`DESIGN_CONSISTENCIA.md`).

---

## 1. Árvore de arquivos (módulo Torneios + Arena)

```
src/
  app/
    (arena)/
      layout.tsx                     # casca dark/glass + AppShell + ViewTransition
      torneios/
        page.tsx                     # RSC: lista (ativos/inscrição/encerrados)
        [id]/
          page.tsx                   # RSC: overview (info, participantes, status)
          chave/page.tsx             # client island: BracketCanvas + realtime
          grupos/page.tsx            # standings de grupos
          palpites/page.tsx          # bracket challenge (F3)
        inscricao/[code]/page.tsx    # inscrição aberta por código
    admin/torneios/
      page.tsx                       # CRUD de torneios
      [id]/
        page.tsx                     # gestão: participantes, seeding, lançar placar
        editar/page.tsx
    tv/page.tsx                       # +mode=torneio|now-playing (estende o atual)
    api/og/torneio/[id]/route.tsx     # OG image dinâmica (ImageResponse)
    actions/
      tournaments.ts                  # server actions (mutations)
  components/
    arena/                            # primitivos do tema arena (glass, glow, halo)
      glass-card.tsx
      status-pill.tsx
      ambient-glows.tsx
    bracket/
      bracket-canvas.tsx              # pan/zoom/fit + minimap
      bracket-column.tsx
      round-header.tsx
      match-card.tsx
      participant-row.tsx
      bracket-connectors.tsx          # SVG paths calculados de refs
      win-probability-bar.tsx         # ELO ao vivo (III.1)
      upset-badge.tsx                 # zebra (III.1)
    tournaments/
      tournament-card.tsx
      tournament-list.tsx
      participant-picker.tsx          # busca usuários + convidados (cmdk + dnd)
      seeding-board.tsx               # dnd-kit
      score-sheet.tsx                 # lançar set/placar
      standings-table.tsx
      tv-bracket.tsx                  # projeção
  lib/
    tournaments/
      types.ts                        # tipos de domínio (ver §2)
      bracket-layout.ts               # algoritmo de posição (ver §5)
      seeding.ts                      # standard/pots/sequential/elo
      win-probability.ts              # fórmula ELO
    queries/
      use-tournaments.ts
      use-tournament.ts
      use-tournament-bracket.ts
      use-tournament-standings.ts
    realtime/
      use-realtime-bracket.ts         # canal tournament:<id>
  utils/
    qr.ts                             # gerar QR (Score@Table)
supabase/migrations/
  NNNN_tournaments.sql                # tabelas + enums + índices
  NNNN_tournament_rpcs.sql            # funções transacionais
  NNNN_tournament_views.sql           # standings/scorecard
  NNNN_tournament_realtime.sql        # publication + RLS
```

---

## 2. Tipos de domínio (`lib/tournaments/types.ts`)

```ts
export type TournamentFormat =
  | "single_elimination" | "double_elimination" | "round_robin"
  | "groups_knockout" | "swiss" | "scorecard" | "americano"
  | "king_of_table" | "league";

export type TournamentStatus = "draft" | "registration" | "active" | "finished";
export type SeedingMethod = "standard" | "pots" | "sequential" | "manual" | "elo";
export type RegistrationMode = "invite" | "open";
export type MatchStatus = "pending" | "scheduled" | "in_progress" | "finished";
export type BracketSide = "winners" | "losers" | "group" | "placement";
export type SignupStatus = "invited" | "signed_up" | "confirmed";

export interface Tournament {
  id: string; name: string; format: TournamentFormat;
  bestOf: number; status: TournamentStatus; seedingMethod: SeedingMethod;
  registrationMode: RegistrationMode; verificationCode: string | null;
  maxParticipants: number | null; seasonId: string | null;
  championUserId: string | null; championName: string | null;
  branding: { logoUrl?: string; primary?: string } | null;
  createdBy: string; createdAt: string; finishedAt: string | null;
}

export interface TournamentParticipant {
  id: string; tournamentId: string;
  userId: string | null; guestName: string | null;
  seed: number | null; groupId: string | null; pot: number | null;
  flag: string | null; avatarUrl: string | null; color: string | null;
  signupStatus: SignupStatus; partnerParticipantId: string | null;
}

export interface TournamentMatch {
  id: string; tournamentId: string;
  round: number;            // 1 = final
  bracket: BracketSide; slot: number; groupId: string | null;
  participantAId: string | null; participantBId: string | null;
  scoreA: number | null; scoreB: number | null;
  sets: Array<[number, number]> | null;     // timeline set-a-set
  winnerParticipantId: string | null;
  nextMatchId: string | null; nextMatchSlot: 0 | 1 | null;
  status: MatchStatus;
  deadlineAt: string | null; scheduledAt: string | null; tableNo: number | null;
  startedAt: string | null; finishedAt: string | null;
}

// Derivados de render
export interface PositionedMatch extends TournamentMatch { x: number; y: number; height: number; }
export interface Connector { fromId: string; toId: string; path: string; active: boolean; }
```

> Convenção: tipos TS em camelCase; mapper `fromRow()`/`toRow()` converte snake_case do Supabase (espelhar enums com os mesmos nomes).

---

## 3. Migrations (DDL — esboço; **NÃO aplicar**, só arquivo)

```sql
-- NNNN_tournaments.sql
create type tournament_format as enum ('single_elimination','double_elimination',
  'round_robin','groups_knockout','swiss','scorecard','americano','king_of_table','league');
create type tournament_status as enum ('draft','registration','active','finished');
create type seeding_method   as enum ('standard','pots','sequential','manual','elo');
create type registration_mode as enum ('invite','open');
create type match_status      as enum ('pending','scheduled','in_progress','finished');
create type bracket_side      as enum ('winners','losers','group','placement');

create table tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  format tournament_format not null,
  best_of int not null default 5 check (best_of in (1,3,5,7)),
  status tournament_status not null default 'draft',
  seeding_method seeding_method not null default 'standard',
  registration_mode registration_mode not null default 'invite',
  verification_code text,
  max_participants int,
  season_id uuid references seasons(id) on delete set null,
  champion_user_id uuid references users(id) on delete set null,
  champion_name text,
  branding jsonb,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table tournament_participants (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  guest_name text,
  seed int, group_id text, pot int,
  flag text, avatar_url text, color text,
  signup_status signup_status not null default 'invited',
  partner_participant_id uuid references tournament_participants(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint participant_identity check (user_id is not null or guest_name is not null)
);
create index on tournament_participants(tournament_id);

create table tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  round int not null,
  bracket bracket_side not null default 'winners',
  slot int not null default 0,
  group_id text,
  participant_a_id uuid references tournament_participants(id) on delete set null,
  participant_b_id uuid references tournament_participants(id) on delete set null,
  score_a int, score_b int, sets jsonb,
  winner_participant_id uuid references tournament_participants(id) on delete set null,
  next_match_id uuid references tournament_matches(id) on delete set null,
  next_match_slot int check (next_match_slot in (0,1)),
  status match_status not null default 'pending',
  deadline_at timestamptz, scheduled_at timestamptz, table_no int,
  started_at timestamptz, finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index on tournament_matches(tournament_id, round);
```
> RLS: leitura pública dos torneios `active|finished` (espectador read-only); escrita só admin. Espelhar o padrão de RLS já usado no projeto.

---

## 4. RPCs transacionais (`NNNN_tournament_rpcs.sql`)

| Função | Assinatura | Comportamento |
|---|---|---|
| `generate_bracket` | `(p_tournament uuid, p_method seeding_method)` | Lê participantes, aplica seeding (§ `seeding.ts`), cria `tournament_matches` da rodada 1..final com `next_match_id`/`slot` corretos (BYE para nº não-potência-de-2). Idempotente: limpa e regenera se `draft`. |
| `report_match_result` | `(p_match uuid, p_a int, p_b int, p_sets jsonb)` | Valida `best_of`, define `winner`, `status=finished`, **propaga** vencedor para `next_match` no `slot`. Se `next_match` fica com 2 participantes → `status=scheduled`. Transacional. |
| `revert_match_result` | `(p_match uuid)` | Desfaz resultado e **limpa a sub-árvore à frente** (recursivo). Exige confirmação na UI. |
| `close_group_stage` | `(p_tournament uuid)` | Calcula standings, pega top N por grupo, semeia o mata-mata (cruzamento A1×B2...). |
| `pair_next_swiss_round` | `(p_tournament uuid)` | Pareia por pontuação evitando repetição de confronto. |
| `walkover` | `(p_match uuid, p_winner uuid)` | Marca W/O, propaga. |

> Todas `security definer`, validando que o chamador é admin. **Não tocam** em `matches`/ELO.

---

## 5. Algoritmo de layout do bracket (`lib/tournaments/bracket-layout.ts`)

```
entrada: matches[] (com round, slot, next_match_id)
constantes: CARD_W=270, CARD_H=84, ROW_GAP=24, COL_GAP=120

1. agrupar por round (rounds desc: maior nº de jogos = round inicial)
2. para o round inicial (r=maxRound): empilhar verticalmente,
   y[i] = i * (CARD_H + baseGap)
3. para cada round seguinte (r-1 ... 1):
   para cada match m: encontrar os 2 matches filhos f1,f2 (next_match_id==m)
   y[m] = (y[f1] + y[f2]) / 2            // centraliza no par
4. x por round: x[r] = (maxRound - r) * (CARD_W + COL_GAP)
5. retornar PositionedMatch[] {x,y,height}

conectores:
  para cada match com next_match_id:
    origem  = (x+CARD_W, y+CARD_H/2)
    destino = (x_next, y_next + CARD_H/2)
    midX = (origem.x + destino.x)/2
    path = `M origem → H midX → V destino.y → H destino.x`  (ortogonal)
```
- Recalcular em `ResizeObserver`; memoizar; em mobile, ignorar x/y e renderizar **colunas roláveis** (snap).
- BYE: match com 1 participante já tem `winner` e propaga na geração.

---

## 6. Seeding (`lib/tournaments/seeding.ts`)

```
standard(n):   ordem 1, n, n/2+1, ... (espelhamento clássico do bracket)
pots(parts):   agrupa por força em P potes; sorteia 1 de cada pote por grupo
sequential:    ordem de entrada
manual:        ordem definida no SeedingBoard (dnd-kit) → persistida em seed
elo(parts):    ordena por rating do ranking geral (join users.rating), depois standard
fairness:      pós-processa para evitar mesma divisão/professor na rodada 1 (swap)
```

---

## 7. Hooks de dados & realtime

```ts
// queries
useTournaments(filter): UseQueryResult<Tournament[]>
useTournament(id): UseQueryResult<TournamentDetail>
useTournamentBracket(id): UseQueryResult<{ matches, participants }>
useTournamentStandings(id): UseQueryResult<GroupStanding[]>

// realtime
useRealtimeBracket(id): void   // assina tournament:<id>,
  // coalesce ~150ms, faz queryClient.setQueryData no cache do bracket,
  // dispara animação só nos nós alterados (diff por match.id)
```
`queryKeys`: `['tournaments']`, `['tournament', id]`, `['tournament-bracket', id]`, `['tournament-standings', id]` — centralizados em `query-keys.ts`.

---

## 8. Server Actions (`app/actions/tournaments.ts`)

```ts
createTournament(input): Promise<{ id }>
updateTournament(id, patch)
addParticipants(id, items: {userId?|guestName, flag?, color?}[])
removeParticipant(participantId)
saveSeeding(id, order: {participantId, seed, groupId?, pot?}[])
generateBracket(id, method)            // chama RPC
reportResult(matchId, a, b, sets)      // chama RPC + revalidateTag
revertResult(matchId)                  // confirm na UI
finishTournament(id, championId)       // celebração + notícia no feed + conquista
openRegistration(id) / closeRegistration(id)
```
- Cada uma: `assertAdmin()`, validação `zod`, `revalidateTag('tournament:'+id)`.
- `finishTournament` reusa o padrão de campeão das temporadas (feed/conquista/notícia).

---

## 9. Contratos dos componentes-herói

```ts
<BracketCanvas matches participants live?  onMatchClick? />   // pan/zoom/fit, minimap, conectores
<MatchCard match a b status onClick? showProbability? />
<ParticipantRow seed flag name score variant="win"|"lose"|"pending"|"tbd"|"walkover" />
<RoundHeader title deadlineAt? statusPill? />
<StatusPill kind="active"|"scheduled"|"played"|"noshow"|"tbd"|"win"|"wo" label />
<WinProbabilityBar pA />                 // 0..1, eval-bar
<UpsetBadge />                           // zebra
<SeedingBoard participants onChange />   // dnd-kit
<ScoreSheet match bestOf onSubmit />     // lançar sets, 1 toque
<StandingsTable rows />                  // V/D, sets, saldo, pts
<TvBracket tournamentId mode />          // projeção fit + ambient
```
- Todos consomem tokens Arena (§ estudo §4); estados loading/vazio/erro obrigatórios; `tabular-nums` em números.

---

## 10. Tokens Arena (CSS — `globals.css`, modo escuro padrão)

```css
:root {
  --arena-bg-1:#0b0612; --arena-bg-2:#150a22; --arena-vignette:#050208;
  --glass-bg: color-mix(in srgb,#fff 4%,transparent);
  --glass-bg-strong: color-mix(in srgb,#fff 7%,transparent);
  --glass-border: color-mix(in srgb,#fff 10%,transparent);
  --primary:#c04bff; --primary-glow: color-mix(in srgb,#c04bff 55%,transparent);
  --state-active:#22d3ee; --state-scheduled:#f5a524; --state-played:#2dd4a7;
  --state-noshow:#f43f5e; --state-tbd:#8b8197;
  --foreground:#f3ecff; --muted-foreground:#b6a8c9; --radius:0.9rem;
  --ease-arena:cubic-bezier(0.22,1,0.36,1);
  --ease-arena-inout:cubic-bezier(0.65,0,0.35,1);
}
.glass { background:var(--glass-bg); border:1px solid var(--glass-border);
  backdrop-filter:blur(14px); border-radius:var(--radius); }
.glow-active { box-shadow:0 0 0 1px color-mix(in srgb,var(--state-active) 30%,transparent),
  0 8px 32px color-mix(in srgb,var(--state-active) 15%,transparent); }
```

---

## 11. Fluxos admin passo-a-passo + edge cases

**Criar e rodar um torneio (grupos+mata-mata):**
1. Criar torneio (nome, formato, best-of, seeding, modo de inscrição).
2. Adicionar participantes (registrados via cmdk + convidados) ou abrir inscrição (código/QR).
3. Definir grupos/potes; ajustar seeding no `SeedingBoard` (dnd).
4. `generateBracket` (gera grupos). Jogar grupos → `ScoreSheet` por partida.
5. `closeGroupStage` (confirma) → semeia mata-mata. Jogar até a final.
6. `finishTournament` → coroação + feed + conquista.

**Edge cases a tratar:**
- Nº de participantes não-potência-de-2 → **BYEs** automáticos no seeding.
- Participante removido após chave gerada → bloquear ou recriar chave (confirm).
- Empate em grupo → critério de desempate (saldo de sets → confronto direto → sorteio), configurável.
- Resultado lançado errado → `revertResult` recursivo com `ConfirmModal` e log em `admin_logs`.
- W/O e no-show → propaga vencedor; badge específico.
- Conexão cai no meio do lançamento → `match-sync-queue` (offline-first).
- Dois admins editam ao mesmo tempo → realtime + last-write-wins com aviso.

---

## 12. Testes (manter rigor atual)

- **Unit (Vitest):** `bracket-layout` (posições, BYE, conectores), `seeding` (standard/pots/elo/fairness), `win-probability`, desempate de grupos.
- **Integration:** RPCs (`generate_bracket`, `report_match_result` propaga, `revert` limpa sub-árvore, `close_group_stage` semeia certo) contra Supabase de teste.
- **E2E (Playwright):** criar torneio → participantes → gerar chave → lançar resultados → avanço aparece → encerrar → campeão; inscrição aberta por código; espectador read-only; TV modo torneio.
- **Regressão obrigatória:** rodar a suíte de **ELO/partidas** intacta após o port (nada pode quebrar).

---

## 13. Definition of Done (por PR/fase)

- [ ] Reusa `AppShell`, tokens Arena, `divisions.ts`; três estados (loading/vazio/erro).
- [ ] `tabular-nums` nos números; PT-BR com acentuação.
- [ ] Ações importantes com `ConfirmModal`; admin logado em `admin_logs`.
- [ ] `prefers-reduced-motion` respeitado; animações só `transform`/`opacity`.
- [ ] Realtime com coalesce; sem layout shift.
- [ ] `npm run lint` + `npm run build` + testes verdes (inclui ELO).
- [ ] Migrations **apenas em arquivo**; instruções de aplicação no PR.
- [ ] Lighthouse/Speed Insights dentro do orçamento (§ estudo §9).

---

## 14. Ordem dos primeiros PRs (para começar já)

1. **PR0 — Fundação Arena:** tokens, `glass-card`, `status-pill`, `ambient-glows`, fontes display, `viewTransition:true`, camada de motion (`LazyMotion`/GSAP/confetti). Migrar 1 tela piloto (Home) para validar a linguagem.
2. **PR1 — Migrations + tipos + RPC `generate_bracket`/`report_match_result`** (arquivo) + mappers + queries.
3. **PR2 — Bracket de leitura:** `BracketCanvas`/`MatchCard`/conectores + `useTournamentBracket` + realtime (sem admin ainda).
4. **PR3 — Admin MVP:** criar torneio, participantes, seeding (dnd), gerar chave, `ScoreSheet`, avanço animado. Eliminatória simples + 3º lugar.
5. **PR4 — Rei da mesa** + TV modo torneio.
6. **PR5+ — Fase 2 (grupos/round-robin/scorecard, inscrição, QR), depois diferenciais (ELO ao vivo, zebra, palpites, recap).**
