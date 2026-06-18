# 07 — Dados & Backend

> **Migrations só em arquivo** — o usuário aplica. **Mock-first/local** no desenvolvimento (doc 12). Torneios em tabelas próprias, **sem triggers** de ELO/temporada.

## 1. Tipos de domínio (`lib/tournaments/types.ts`)
```ts
export type TournamentFormat =
  | "single_elimination" | "double_elimination" | "round_robin"
  | "groups_knockout" | "swiss" | "scorecard" | "americano"
  | "king_of_table" | "league";
export type TournamentStatus = "draft" | "registration" | "active" | "finished";
export type SeedingMethod   = "standard" | "pots" | "sequential" | "manual" | "elo";
export type RegistrationMode = "invite" | "open";
export type MatchStatus = "pending" | "scheduled" | "in_progress" | "finished";
export type BracketSide = "winners" | "losers" | "group" | "placement";
export type SignupStatus = "invited" | "signed_up" | "confirmed";

export interface Tournament {
  id: string; name: string; format: TournamentFormat; bestOf: number;
  status: TournamentStatus; seedingMethod: SeedingMethod;
  registrationMode: RegistrationMode; verificationCode: string | null;
  maxParticipants: number | null; seasonId: string | null;
  championUserId: string | null; championName: string | null;
  branding: { logoUrl?: string; primary?: string } | null;
  createdBy: string; createdAt: string; finishedAt: string | null;
}
export interface TournamentParticipant {
  id: string; tournamentId: string; userId: string | null; guestName: string | null;
  seed: number | null; groupId: string | null; pot: number | null;
  flag: string | null; avatarUrl: string | null; color: string | null;
  signupStatus: SignupStatus; partnerParticipantId: string | null;
}
export interface TournamentMatch {
  id: string; tournamentId: string; round: number; bracket: BracketSide;
  slot: number; groupId: string | null;
  participantAId: string | null; participantBId: string | null;
  scoreA: number | null; scoreB: number | null; sets: Array<[number,number]> | null;
  winnerParticipantId: string | null;
  nextMatchId: string | null; nextMatchSlot: 0 | 1 | null;
  status: MatchStatus; deadlineAt: string | null; scheduledAt: string | null;
  tableNo: number | null; startedAt: string | null; finishedAt: string | null;
}
export interface PositionedMatch extends TournamentMatch { x:number; y:number; height:number; }
export interface Connector { fromId:string; toId:string; path:string; active:boolean; }
```
> TS em camelCase; mappers `fromRow()/toRow()` convertem snake_case do Supabase. Enums com os mesmos nomes do banco.

## 2. DDL (esboço — `supabase/migrations/NNNN_tournaments.sql`)
```sql
create type tournament_format as enum ('single_elimination','double_elimination',
  'round_robin','groups_knockout','swiss','scorecard','americano','king_of_table','league');
create type tournament_status as enum ('draft','registration','active','finished');
create type seeding_method    as enum ('standard','pots','sequential','manual','elo');
create type registration_mode as enum ('invite','open');
create type match_status       as enum ('pending','scheduled','in_progress','finished');
create type bracket_side       as enum ('winners','losers','group','placement');
create type signup_status      as enum ('invited','signed_up','confirmed');

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
  seed int, group_id text, pot int, flag text, avatar_url text, color text,
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

-- Listas reutilizáveis + templates
create table participant_lists (id uuid primary key default gen_random_uuid(),
  name text not null, created_by uuid references users(id), created_at timestamptz default now());
create table participant_list_items (id uuid primary key default gen_random_uuid(),
  list_id uuid references participant_lists(id) on delete cascade,
  user_id uuid references users(id), guest_name text, flag text);
create table tournament_templates (id uuid primary key default gen_random_uuid(),
  name text not null, config jsonb not null, created_by uuid references users(id));
```

## 3. Views (`NNNN_tournament_views.sql`)
- `tournament_group_standings` — por grupo: jogos, V, D, sets pró/contra, **saldo**, **pontos** (vitória/derrota configuráveis).
- `tournament_scorecard` — leaderboard de pontos corridos (formato scorecard).

## 4. RPCs transacionais (`NNNN_tournament_rpcs.sql`)
| Função | Assinatura | Comportamento |
|---|---|---|
| `generate_bracket` | `(p_tournament uuid, p_method seeding_method)` | aplica seeding, cria matches round 1..final com `next_match_id/slot`; **BYE** para nº não-potência-de-2; idempotente em `draft` |
| `report_match_result` | `(p_match uuid, p_a int, p_b int, p_sets jsonb)` | valida `best_of`, define winner, `finished`, **propaga** vencedor ao `next_match`; se completa → `scheduled`; transacional |
| `revert_match_result` | `(p_match uuid)` | desfaz e **limpa sub-árvore à frente** (recursivo) |
| `close_group_stage` | `(p_tournament uuid)` | calcula standings, top N por grupo, semeia mata-mata (A1×B2…) |
| `pair_next_swiss_round` | `(p_tournament uuid)` | pareia por pontuação evitando repetição |
| `walkover` | `(p_match uuid, p_winner uuid)` | marca W/O e propaga |
> Todas `security definer`, validam admin, **não tocam** em `matches`/ELO.

## 5. RLS
- **Leitura pública** de `tournaments` `active|finished` e seus matches/participantes (espectador read-only).
- **Escrita** só admin (espelhar padrão de RLS já usado: `settings`/`admin_logs` com RLS off conforme stack atual).
- Inscrição aberta: leitura por `verification_code`.

## 6. Realtime
- `publication` para `tournament_matches`, `tournament_participants`.
- Canal por torneio `tournament:<id>` (ver `10-tv-e-realtime.md`).

## 7. Máquinas de estado
### Partida
```
pending ─(2 participantes)→ scheduled ─(início)→ in_progress ─(placar)→ finished
scheduled ─(ausência)→ finished(walkover/no-show)
finished ─(admin corrige)→ finished'   // revert recursivo + re-propaga
```
### Torneio
```
draft ─(chave + participantes)→ active ─(final)→ finished
registration ─(fecha inscrição)→ draft/active
finished ─(reabrir admin)→ active   // espelha temporadas
```
