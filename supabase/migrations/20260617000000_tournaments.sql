-- ============================================================
-- Torneios — Tabelas + Enums + Índices
-- NÃO APLICAR DIRETAMENTE — somente via banco local/HML
-- ============================================================

-- Enums
create type tournament_format as enum (
  'single_elimination', 'double_elimination', 'round_robin',
  'groups_knockout', 'swiss', 'scorecard', 'americano', 'king_of_table', 'league'
);
create type tournament_status as enum ('draft', 'registration', 'active', 'finished');
create type seeding_method    as enum ('standard', 'pots', 'sequential', 'manual', 'elo');
create type registration_mode as enum ('invite', 'open');
create type match_status      as enum ('pending', 'scheduled', 'in_progress', 'finished');
create type bracket_side      as enum ('winners', 'losers', 'group', 'placement');
create type signup_status     as enum ('invited', 'signed_up', 'confirmed');

-- Torneios
create table tournaments (
  id                uuid          primary key default gen_random_uuid(),
  name              text          not null,
  format            tournament_format not null,
  best_of           int           not null default 5 check (best_of in (1,3,5,7)),
  status            tournament_status not null default 'draft',
  seeding_method    seeding_method not null default 'standard',
  registration_mode registration_mode not null default 'invite',
  verification_code text,
  max_participants  int,
  season_id         uuid          references seasons(id) on delete set null,
  champion_user_id  uuid          references users(id)   on delete set null,
  champion_name     text,
  branding          jsonb,
  created_by        uuid          not null references users(id),
  created_at        timestamptz   not null default now(),
  finished_at       timestamptz
);

create index on tournaments(status);
create index on tournaments(created_by);
create index on tournaments(season_id);

-- Participantes
create table tournament_participants (
  id                    uuid         primary key default gen_random_uuid(),
  tournament_id         uuid         not null references tournaments(id) on delete cascade,
  user_id               uuid         references users(id) on delete set null,
  guest_name            text,
  seed                  int,
  group_id              text,
  pot                   int,
  flag                  text,
  avatar_url            text,
  color                 text,
  signup_status         signup_status not null default 'invited',
  partner_participant_id uuid         references tournament_participants(id) on delete set null,
  created_at            timestamptz  not null default now(),
  constraint participant_identity check (user_id is not null or guest_name is not null)
);

create index on tournament_participants(tournament_id);
create index on tournament_participants(user_id);

-- Partidas
create table tournament_matches (
  id                   uuid        primary key default gen_random_uuid(),
  tournament_id        uuid        not null references tournaments(id) on delete cascade,
  round                int         not null,
  bracket              bracket_side not null default 'winners',
  slot                 int         not null default 0,
  group_id             text,
  participant_a_id     uuid        references tournament_participants(id) on delete set null,
  participant_b_id     uuid        references tournament_participants(id) on delete set null,
  score_a              int,
  score_b              int,
  sets                 jsonb,
  winner_participant_id uuid       references tournament_participants(id) on delete set null,
  next_match_id        uuid        references tournament_matches(id) on delete set null,
  next_match_slot      int         check (next_match_slot in (0,1)),
  status               match_status not null default 'pending',
  deadline_at          timestamptz,
  scheduled_at         timestamptz,
  table_no             int,
  started_at           timestamptz,
  finished_at          timestamptz,
  created_at           timestamptz not null default now()
);

create index on tournament_matches(tournament_id, round);
create index on tournament_matches(status);

-- RLS: leitura pública de torneios ativos/encerrados
alter table tournaments          enable row level security;
alter table tournament_participants enable row level security;
alter table tournament_matches   enable row level security;

create policy "leitura pública de torneios ativos/encerrados"
  on tournaments for select
  using (status in ('active', 'finished', 'registration'));

create policy "admins gerenciam torneios"
  on tournaments for all
  using (exists (
    select 1 from users where id = auth.uid() and role = 'admin'
  ));

create policy "leitura pública de participantes (torneio visível)"
  on tournament_participants for select
  using (exists (
    select 1 from tournaments t
    where t.id = tournament_id
    and t.status in ('active','finished','registration')
  ));

create policy "admins gerenciam participantes"
  on tournament_participants for all
  using (exists (
    select 1 from users where id = auth.uid() and role = 'admin'
  ));

create policy "leitura pública de partidas (torneio visível)"
  on tournament_matches for select
  using (exists (
    select 1 from tournaments t
    where t.id = tournament_id
    and t.status in ('active','finished','registration')
  ));

create policy "admins gerenciam partidas"
  on tournament_matches for all
  using (exists (
    select 1 from users where id = auth.uid() and role = 'admin'
  ));
