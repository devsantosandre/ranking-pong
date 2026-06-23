-- ============================================================================
-- Recuperação completa do schema de torneios no VPS
--
-- O VPS tem match_status com valores em PT (pendente/validado/cancelado/edited)
-- criado pela migration original de ranking. As migrations de torneio tentaram
-- criar um novo match_status com valores EN mas caíram em duplicate_object.
-- Resultado: tournament_matches nunca foi criada.
--
-- Solução: adicionar os valores EN ao enum existente + criar tabelas/RPCs.
-- ============================================================================

-- ── Adicionar valores EN ao enum match_status existente ───────────────────────
alter type match_status add value if not exists 'pending';
alter type match_status add value if not exists 'scheduled';
alter type match_status add value if not exists 'finished';

-- ── Demais enums de torneio (idempotentes) ────────────────────────────────────
do $$ begin
  create type tournament_format as enum (
    'single_elimination', 'double_elimination', 'round_robin',
    'groups_knockout', 'swiss', 'scorecard', 'americano', 'king_of_table', 'league'
  );
exception when duplicate_object then null; end; $$;

do $$ begin
  create type tournament_status as enum ('draft', 'registration', 'active', 'finished');
exception when duplicate_object then null; end; $$;

do $$ begin
  create type seeding_method as enum ('standard', 'pots', 'sequential', 'manual', 'elo');
exception when duplicate_object then null; end; $$;

do $$ begin
  create type registration_mode as enum ('invite', 'open');
exception when duplicate_object then null; end; $$;

do $$ begin
  create type bracket_side as enum ('winners', 'losers', 'group', 'placement');
exception when duplicate_object then null; end; $$;

do $$ begin
  create type signup_status as enum ('invited', 'signed_up', 'confirmed');
exception when duplicate_object then null; end; $$;

-- ── tournament_matches ────────────────────────────────────────────────────────
create table if not exists tournament_matches (
  id                   uuid         primary key default gen_random_uuid(),
  tournament_id        uuid         not null references tournaments(id) on delete cascade,
  round                int          not null,
  bracket              bracket_side not null default 'winners',
  slot                 int          not null default 0,
  group_id             text,
  participant_a_id     uuid         references tournament_participants(id) on delete set null,
  participant_b_id     uuid         references tournament_participants(id) on delete set null,
  score_a              int,
  score_b              int,
  sets                 jsonb,
  winner_participant_id uuid        references tournament_participants(id) on delete set null,
  next_match_id        uuid         references tournament_matches(id) on delete set null,
  next_match_slot      int          check (next_match_slot in (0,1)),
  status               match_status not null default 'pending',
  deadline_at          timestamptz,
  scheduled_at         timestamptz,
  table_no             int,
  started_at           timestamptz,
  finished_at          timestamptz,
  created_at           timestamptz  not null default now()
);

create index if not exists tournament_matches_tournament_round
  on tournament_matches(tournament_id, round);
create index if not exists tournament_matches_status_idx
  on tournament_matches(status);
create index if not exists tournament_matches_group_bracket
  on tournament_matches(bracket) where bracket = 'group';

do $$ begin
  alter table tournament_matches enable row level security;
exception when others then null; end; $$;

do $$ begin
  create policy "leitura pública de partidas (torneio visível)"
    on tournament_matches for select
    using (exists (
      select 1 from tournaments t
      where t.id = tournament_id
        and t.status in ('active','finished','registration')
    ));
exception when duplicate_object then null; end; $$;

do $$ begin
  create policy "admins gerenciam partidas"
    on tournament_matches for all
    using (exists (
      select 1 from users where id = auth.uid() and role = 'admin'
    ));
exception when duplicate_object then null; end; $$;

-- ── tournament_group_slots ────────────────────────────────────────────────────
create table if not exists tournament_group_slots (
  tournament_id uuid not null references tournaments(id)        on delete cascade,
  group_id      text not null,
  rank          int  not null,
  match_id      uuid not null references tournament_matches(id) on delete cascade,
  match_slot    int  not null check (match_slot in (0, 1)),
  primary key   (tournament_id, group_id, rank)
);

create index if not exists tournament_group_slots_tournament_idx
  on tournament_group_slots(tournament_id);

-- ── Realtime ──────────────────────────────────────────────────────────────────
do $$ begin
  alter publication supabase_realtime add table tournament_matches;
exception when others then null; end; $$;

-- ── Views ─────────────────────────────────────────────────────────────────────
create or replace view tournament_standings as
with stats as (
  select
    p.tournament_id,
    p.id                                                                                         as participant_id,
    p.group_id,
    coalesce(sum(case when m.winner_participant_id = p.id  then 3 else 0 end), 0)::int           as points,
    count(*) filter (where m.status = 'finished' and m.winner_participant_id = p.id)::int        as wins,
    count(*) filter (where m.status = 'finished' and m.winner_participant_id is not null
                       and m.winner_participant_id <> p.id)::int                                 as losses,
    coalesce(sum(case when m.participant_a_id = p.id then m.score_a else m.score_b end)
             filter (where m.status = 'finished'), 0)::int                                       as sets_won,
    coalesce(sum(case when m.participant_a_id = p.id then m.score_b else m.score_a end)
             filter (where m.status = 'finished'), 0)::int                                       as sets_lost
  from tournament_participants p
  left join tournament_matches m
    on  m.tournament_id = p.tournament_id
    and (m.participant_a_id = p.id or m.participant_b_id = p.id)
    and m.bracket = 'group'
  where p.group_id is not null
  group by p.tournament_id, p.id, p.group_id
)
select
  tournament_id, participant_id, group_id, wins, losses, sets_won, sets_lost, points,
  row_number() over (
    partition by tournament_id, group_id
    order by points desc, (sets_won - sets_lost) desc, sets_won desc
  )::int as position
from stats;

-- ── Helper: aceita service_role OU usuário admin ──────────────────────────────
create or replace function is_admin_caller()
returns boolean
language plpgsql
security definer
as $$
declare v_jwt_role text;
begin
  begin
    v_jwt_role := coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role', '');
  exception when others then v_jwt_role := ''; end;
  if v_jwt_role = 'service_role' then return true; end if;
  return exists(select 1 from users where id = auth.uid() and role = 'admin');
end;
$$;

-- ── tournament_standard_order ─────────────────────────────────────────────────
create or replace function tournament_standard_order(p_n int)
returns int[]
language plpgsql immutable
as $$
declare half int[]; result int[] := '{}'; s int;
begin
  if p_n = 1 then return array[1]; end if;
  half := tournament_standard_order(p_n / 2);
  foreach s in array half loop result := result || array[s, p_n + 1 - s]; end loop;
  return result;
end;
$$;

-- ── Helpers internos ─────────────────────────────────────────────────────────
create or replace function tournament_clear_forward(p_match uuid, p_old_winner uuid)
returns void language plpgsql security definer
as $$
declare v_match tournament_matches%rowtype;
begin
  select * into v_match from tournament_matches where id = p_match;
  if not found then return; end if;
  if v_match.next_match_id is not null then
    update tournament_matches
      set participant_a_id = case when next_match_slot = 0 and participant_a_id = p_old_winner then null else participant_a_id end,
          participant_b_id = case when next_match_slot = 1 and participant_b_id = p_old_winner then null else participant_b_id end,
          status = 'pending'
      where id = v_match.next_match_id
        and (participant_a_id = p_old_winner or participant_b_id = p_old_winner);
    if exists (select 1 from tournament_matches where id = v_match.next_match_id and winner_participant_id = p_old_winner) then
      update tournament_matches
        set score_a = null, score_b = null, sets = null,
            winner_participant_id = null, finished_at = null, status = 'pending'
        where id = v_match.next_match_id;
      perform tournament_clear_forward(v_match.next_match_id, p_old_winner);
    end if;
  end if;
end;
$$;

create or replace function tournament_clear_group_slots(p_tournament uuid, p_group_id text)
returns void language plpgsql security definer
as $$
declare v_slot tournament_group_slots%rowtype;
begin
  for v_slot in select * from tournament_group_slots where tournament_id = p_tournament and group_id = p_group_id loop
    update tournament_matches
      set participant_a_id = case when v_slot.match_slot = 0 then null else participant_a_id end,
          participant_b_id = case when v_slot.match_slot = 1 then null else participant_b_id end,
          status = 'pending', score_a = null, score_b = null, sets = null,
          winner_participant_id = null, finished_at = null
      where id = v_slot.match_id;
  end loop;
end;
$$;

create or replace function tournament_auto_advance_group(p_tournament uuid, p_group_id text)
returns void language plpgsql security definer
as $$
declare
  v_total int; v_done int;
  v_slot tournament_group_slots%rowtype;
  v_winner uuid;
begin
  select count(*) into v_total from tournament_matches
  where tournament_id = p_tournament and group_id = p_group_id and bracket = 'group';
  select count(*) into v_done from tournament_matches
  where tournament_id = p_tournament and group_id = p_group_id and bracket = 'group' and status = 'finished';
  if v_total = 0 or v_done < v_total then return; end if;
  for v_slot in select gs.* from tournament_group_slots gs
    where gs.tournament_id = p_tournament and gs.group_id = p_group_id order by gs.rank loop
    select tp.id into v_winner
    from tournament_participants tp
    join (
      select tp2.id,
             row_number() over (order by
               sum(case when m2.winner_participant_id = tp2.id then 3 else 0 end) desc,
               sum(case when m2.participant_a_id = tp2.id then m2.score_a else m2.score_b end filter (where m2.status = 'finished')) -
               sum(case when m2.participant_a_id = tp2.id then m2.score_b else m2.score_a end filter (where m2.status = 'finished')) desc
             ) as pos
      from tournament_matches m2
      join tournament_participants tp2 on (tp2.id = m2.participant_a_id or tp2.id = m2.participant_b_id)
      where m2.tournament_id = p_tournament and m2.group_id = p_group_id and m2.bracket = 'group'
      group by tp2.id
    ) standings on standings.id = tp.id
    where tp.tournament_id = p_tournament and tp.group_id = p_group_id and standings.pos = v_slot.rank + 1
    limit 1;
    if v_winner is not null then
      update tournament_matches
        set participant_a_id = case when v_slot.match_slot = 0 then v_winner else participant_a_id end,
            participant_b_id = case when v_slot.match_slot = 1 then v_winner else participant_b_id end
        where id = v_slot.match_id;
      update tournament_matches set status = 'scheduled'
        where id = v_slot.match_id and participant_a_id is not null and participant_b_id is not null and status = 'pending';
    end if;
  end loop;
end;
$$;

create or replace function tournament_sync_placement(p_tournament uuid)
returns void language plpgsql security definer
as $$
declare
  v_pm tournament_matches%rowtype;
  v_loser_a uuid; v_loser_b uuid;
begin
  select * into v_pm from tournament_matches where tournament_id = p_tournament and bracket = 'placement' limit 1;
  if not found then return; end if;
  select case when m.winner_participant_id = m.participant_a_id then m.participant_b_id else m.participant_a_id end into v_loser_a
  from tournament_matches m
  where m.tournament_id = p_tournament and m.bracket = 'winners'
    and m.next_match_id = (select id from tournament_matches where tournament_id = p_tournament and bracket = 'winners' and round = 1 limit 1)
    and m.next_match_slot = 0 and m.winner_participant_id is not null limit 1;
  select case when m.winner_participant_id = m.participant_a_id then m.participant_b_id else m.participant_a_id end into v_loser_b
  from tournament_matches m
  where m.tournament_id = p_tournament and m.bracket = 'winners'
    and m.next_match_id = (select id from tournament_matches where tournament_id = p_tournament and bracket = 'winners' and round = 1 limit 1)
    and m.next_match_slot = 1 and m.winner_participant_id is not null limit 1;
  update tournament_matches
    set participant_a_id = v_loser_a, participant_b_id = v_loser_b,
        status = case when v_loser_a is not null and v_loser_b is not null then 'scheduled'::match_status else 'pending'::match_status end
    where id = v_pm.id and status in ('pending','scheduled');
end;
$$;

-- ── generate_bracket ──────────────────────────────────────────────────────────
create or replace function generate_bracket(p_tournament uuid, p_method seeding_method default 'standard')
returns setof tournament_matches language plpgsql security definer
as $$
declare
  v_t           tournaments%rowtype;
  v_parts       uuid[];
  v_n_actual    int; v_n int; v_rounds int;
  v_order       int[]; v_ids uuid[]; v_total int;
  v_a uuid; v_b uuid; v_is_bye boolean; v_winner uuid;
  v_next_id uuid; v_next_slot int;
  r int; i int; k int;
  v_group_ids text[]; v_group_count int; v_group_size int;
  v_spots int; v_total_class int; v_slot int; g text;
  v_gparts uuid[]; v_km_ids uuid[]; v_km_rounds int; v_km_total int;
  v_seed_groups text[]; v_seed_ranks int[];
  v_tier_groups text[]; v_rev_groups text[]; ins_pos int;
begin
  if not is_admin_caller() then raise exception 'Acesso negado'; end if;
  select * into v_t from tournaments where id = p_tournament;
  if not found then raise exception 'Torneio não encontrado'; end if;
  if v_t.status not in ('draft','registration') then
    raise exception 'Chave só pode ser gerada em status draft ou registration';
  end if;
  delete from tournament_group_slots where tournament_id = p_tournament;
  delete from tournament_matches       where tournament_id = p_tournament;

  if p_method = 'elo' then
    select array_agg(tp.id order by coalesce(u.rating_atual, 0) desc, tp.created_at) into v_parts
    from tournament_participants tp left join users u on u.id = tp.user_id
    where tp.tournament_id = p_tournament and tp.signup_status = 'confirmed';
  elsif p_method = 'sequential' then
    select array_agg(id order by created_at) into v_parts
    from tournament_participants where tournament_id = p_tournament and signup_status = 'confirmed';
  else
    select array_agg(id order by coalesce(seed, 9999), created_at) into v_parts
    from tournament_participants where tournament_id = p_tournament and signup_status = 'confirmed';
  end if;

  v_n_actual := coalesce(array_length(v_parts, 1), 0);
  if v_n_actual < 2 then raise exception 'Mínimo de 2 participantes confirmados para gerar a chave'; end if;

  -- ROUND ROBIN
  if v_t.format = 'round_robin' then
    update tournament_participants set group_id = 'GERAL' where tournament_id = p_tournament and signup_status = 'confirmed';
    v_slot := 0;
    for i in 1..v_n_actual loop
      for k in (i+1)..v_n_actual loop
        insert into tournament_matches (tournament_id,round,bracket,slot,group_id,participant_a_id,participant_b_id,status)
        values (p_tournament,100,'group',v_slot,'GERAL',v_parts[i],v_parts[k],'scheduled');
        v_slot := v_slot + 1;
      end loop;
    end loop;
    update tournaments set status = 'active' where id = p_tournament;
    return query select * from tournament_matches where tournament_id = p_tournament order by slot;
    return;
  end if;

  -- GROUPS + KNOCKOUT
  if v_t.format = 'groups_knockout' then
    select array_agg(distinct tp.group_id order by tp.group_id) into v_group_ids
    from tournament_participants tp where tp.tournament_id = p_tournament and tp.group_id is not null and tp.signup_status = 'confirmed';
    if v_group_ids is null or array_length(v_group_ids,1) < 2 then raise exception 'Configure os grupos antes de gerar (mínimo 2 grupos)'; end if;
    v_group_count := array_length(v_group_ids,1);
    select max(cnt) into v_group_size from (select count(*)::int as cnt from tournament_participants where tournament_id = p_tournament and signup_status = 'confirmed' and group_id = any(v_group_ids) group by group_id) t;
    v_spots := greatest(1, ceil(v_group_size::numeric/2)::int);
    v_total_class := v_group_count * v_spots;
    v_n := 1;
    while v_n < v_total_class loop v_n := v_n * 2; end loop;
    if v_n <> v_total_class then raise exception 'Configuração inválida: % classificados não é potência de 2', v_total_class; end if;
    v_slot := 0;
    foreach g in array v_group_ids loop
      select array_agg(id order by coalesce(seed,9999), created_at) into v_gparts
      from tournament_participants where tournament_id = p_tournament and group_id = g and signup_status = 'confirmed';
      for i in 1..array_length(v_gparts,1) loop
        for k in (i+1)..array_length(v_gparts,1) loop
          insert into tournament_matches (tournament_id,round,bracket,slot,group_id,participant_a_id,participant_b_id,status)
          values (p_tournament,100,'group',v_slot,g,v_gparts[i],v_gparts[k],'scheduled');
          v_slot := v_slot + 1;
        end loop;
      end loop;
    end loop;
    v_km_rounds := cast(log(2,v_total_class) as int); v_km_total := v_total_class - 1;
    v_km_ids := '{}';
    for i in 1..v_km_total loop v_km_ids := v_km_ids || gen_random_uuid(); end loop;
    for r in 1..v_km_rounds loop
      for i in 0..((2^(v_km_rounds-r+1)/2)::int-1) loop
        if r > 1 then v_next_id := v_km_ids[(2^(r-2))::int+i/2]; v_next_slot := i%2; else v_next_id := null; v_next_slot := null; end if;
        insert into tournament_matches (id,tournament_id,round,bracket,slot,next_match_id,next_match_slot,status)
        values (v_km_ids[(2^(r-1))::int+i],p_tournament,r,'winners',i,v_next_id,v_next_slot,'pending');
      end loop;
    end loop;
    v_seed_groups := '{}'; v_seed_ranks := '{}';
    for r in 0..(v_spots-1) loop
      if r%2=0 then v_tier_groups := v_group_ids;
      else v_rev_groups := '{}'; for i in reverse array_length(v_group_ids,1)..1 loop v_rev_groups := v_rev_groups || v_group_ids[i]; end loop; v_tier_groups := v_rev_groups; end if;
      if r=0 then
        for i in 1..array_length(v_tier_groups,1) loop v_seed_groups := v_seed_groups || v_tier_groups[i]; v_seed_ranks := v_seed_ranks || 0; end loop;
      else
        for i in 0..(array_length(v_tier_groups,1)-1) loop
          ins_pos := i*v_spots+r;
          v_seed_groups := v_seed_groups[1:ins_pos] || v_tier_groups[i+1] || v_seed_groups[ins_pos+1:array_length(v_seed_groups,1)];
          v_seed_ranks  := v_seed_ranks[1:ins_pos]  || r                  || v_seed_ranks[ins_pos+1:array_length(v_seed_ranks,1)];
        end loop;
      end if;
    end loop;
    for i in 0..(v_total_class/2-1) loop
      declare v_mid uuid := v_km_ids[(2^(v_km_rounds-1))::int+i]; v_ga text := v_seed_groups[i*2+1]; v_ra int := v_seed_ranks[i*2+1]; v_gb text := v_seed_groups[i*2+2]; v_rb int := v_seed_ranks[i*2+2]; begin
        insert into tournament_group_slots (tournament_id,group_id,rank,match_id,match_slot) values (p_tournament,v_ga,v_ra,v_mid,0) on conflict (tournament_id,group_id,rank) do update set match_id=excluded.match_id, match_slot=excluded.match_slot;
        insert into tournament_group_slots (tournament_id,group_id,rank,match_id,match_slot) values (p_tournament,v_gb,v_rb,v_mid,1) on conflict (tournament_id,group_id,rank) do update set match_id=excluded.match_id, match_slot=excluded.match_slot;
      end;
    end loop;
    update tournaments set status = 'active' where id = p_tournament;
    return query select * from tournament_matches where tournament_id = p_tournament order by bracket desc, round desc, slot;
    return;
  end if;

  -- KING OF TABLE
  if v_t.format = 'king_of_table' then
    v_km_ids := '{}';
    for i in 1..(v_n_actual-1) loop v_km_ids := v_km_ids || gen_random_uuid(); end loop;
    for i in 1..(v_n_actual-1) loop
      insert into tournament_matches (id,tournament_id,round,bracket,slot,participant_a_id,participant_b_id,next_match_id,next_match_slot,status)
      values (v_km_ids[i],p_tournament,i,'winners',0,case when i=1 then v_parts[1] else null end,v_parts[i+1],case when i<v_n_actual-1 then v_km_ids[i+1] else null end,0,case when i=1 then 'scheduled'::match_status else 'pending'::match_status end);
    end loop;
    update tournaments set status = 'active' where id = p_tournament;
    return query select * from tournament_matches where tournament_id = p_tournament order by round;
    return;
  end if;

  -- SINGLE ELIMINATION
  v_n := 1; while v_n < v_n_actual loop v_n := v_n * 2; end loop;
  v_rounds := cast(log(2,v_n) as int); v_total := v_n - 1;
  v_ids := '{}'; for i in 1..v_total loop v_ids := v_ids || gen_random_uuid(); end loop;
  v_order := tournament_standard_order(v_n);
  for r in 1..v_rounds loop
    for i in 0..((2^(r-1))::int-1) loop
      if r > 1 then v_next_id := v_ids[(2^(r-2))::int+i/2]; v_next_slot := i%2; else v_next_id := null; v_next_slot := null; end if;
      if r = v_rounds then
        declare seed_a int := v_order[i*2+1]; seed_b int := v_order[i*2+2]; begin
          v_a := case when seed_a <= v_n_actual then v_parts[seed_a] else null end;
          v_b := case when seed_b <= v_n_actual then v_parts[seed_b] else null end;
          v_is_bye := (v_a is not null and v_b is null) or (v_b is not null and v_a is null);
          v_winner := case when v_is_bye then coalesce(v_a,v_b) else null end;
        end;
      else v_a := null; v_b := null; v_is_bye := false; v_winner := null; end if;
      insert into tournament_matches (id,tournament_id,round,bracket,slot,participant_a_id,participant_b_id,winner_participant_id,next_match_id,next_match_slot,status,finished_at)
      values (v_ids[(2^(r-1))::int+i],p_tournament,r,'winners',i,v_a,v_b,v_winner,v_next_id,v_next_slot,
        case when v_is_bye then 'finished'::match_status when v_a is not null and v_b is not null then 'scheduled'::match_status else 'pending'::match_status end,
        case when v_is_bye then now() else null end);
      if v_is_bye and v_winner is not null and v_next_id is not null then
        update tournament_matches set participant_a_id=case when v_next_slot=0 then v_winner else participant_a_id end, participant_b_id=case when v_next_slot=1 then v_winner else participant_b_id end where id=v_next_id;
        update tournament_matches set status='scheduled' where id=v_next_id and participant_a_id is not null and participant_b_id is not null and status='pending';
      end if;
    end loop;
  end loop;
  if v_t.third_place_match and v_n_actual >= 4 then
    insert into tournament_matches (tournament_id,round,bracket,slot,status) values (p_tournament,1,'placement',1,'pending');
  end if;
  update tournaments set status = 'active' where id = p_tournament;
  return query select * from tournament_matches where tournament_id = p_tournament order by bracket desc, round desc, slot;
end;
$$;

-- ── report_match_result ───────────────────────────────────────────────────────
create or replace function report_match_result(p_match uuid, p_a int, p_b int, p_sets jsonb default null)
returns tournament_matches language plpgsql security definer
as $$
declare
  v_match tournament_matches%rowtype; v_t_status tournament_status; v_best_of int; v_needed int;
  v_old_winner uuid; v_new_winner uuid; v_next tournament_matches%rowtype;
begin
  if not is_admin_caller() then raise exception 'Acesso negado'; end if;
  select * into v_match from tournament_matches where id = p_match;
  if not found then raise exception 'Partida não encontrada'; end if;
  select status, best_of into v_t_status, v_best_of from tournaments where id = v_match.tournament_id;
  if v_t_status = 'finished' then raise exception 'Torneio já encerrado. Reabra antes de editar.'; end if;
  if v_match.participant_a_id is null or v_match.participant_b_id is null then raise exception 'Defina os dois participantes antes de lançar o placar.'; end if;
  if p_a = p_b then raise exception 'Empate não é permitido no tênis de mesa.'; end if;
  v_needed := ceil(v_best_of::numeric/2)::int;
  if p_a < v_needed and p_b < v_needed then raise exception 'Placar inválido para melhor de %: nenhum atingiu % vitórias', v_best_of, v_needed; end if;
  v_old_winner := v_match.winner_participant_id;
  v_new_winner := case when p_a > p_b then v_match.participant_a_id else v_match.participant_b_id end;
  if v_old_winner is not null and v_old_winner <> v_new_winner then
    perform tournament_clear_forward(p_match, v_old_winner);
    if v_match.bracket = 'group' and v_match.group_id is not null then perform tournament_clear_group_slots(v_match.tournament_id, v_match.group_id); end if;
  end if;
  update tournament_matches set score_a=p_a,score_b=p_b,sets=p_sets,winner_participant_id=v_new_winner,status='finished',finished_at=now() where id=p_match returning * into v_match;
  if v_match.next_match_id is not null then
    update tournament_matches set participant_a_id=case when v_match.next_match_slot=0 then v_new_winner else participant_a_id end,participant_b_id=case when v_match.next_match_slot=1 then v_new_winner else participant_b_id end where id=v_match.next_match_id returning * into v_next;
    if v_next.participant_a_id is not null and v_next.participant_b_id is not null then update tournament_matches set status='scheduled' where id=v_next.id and status='pending'; end if;
  end if;
  if v_match.bracket='group' and v_match.group_id is not null then perform tournament_auto_advance_group(v_match.tournament_id, v_match.group_id); end if;
  if v_match.bracket='winners' then perform tournament_sync_placement(v_match.tournament_id); end if;
  return v_match;
end;
$$;

-- ── revert_match_result ───────────────────────────────────────────────────────
create or replace function revert_match_result(p_match uuid)
returns void language plpgsql security definer
as $$
declare v_match tournament_matches%rowtype;
begin
  if not is_admin_caller() then raise exception 'Acesso negado'; end if;
  select * into v_match from tournament_matches where id = p_match;
  if not found then raise exception 'Partida não encontrada'; end if;
  if v_match.winner_participant_id is not null then perform tournament_clear_forward(p_match, v_match.winner_participant_id); end if;
  if v_match.bracket='group' and v_match.group_id is not null then perform tournament_clear_group_slots(v_match.tournament_id, v_match.group_id); end if;
  update tournament_matches set score_a=null,score_b=null,sets=null,winner_participant_id=null,finished_at=null,
    status=case when participant_a_id is not null and participant_b_id is not null then 'scheduled'::match_status else 'pending'::match_status end
    where id=p_match;
  if v_match.bracket='winners' then perform tournament_sync_placement(v_match.tournament_id); end if;
end;
$$;

-- ── walkover ──────────────────────────────────────────────────────────────────
create or replace function walkover(p_match uuid, p_winner uuid)
returns tournament_matches language plpgsql security definer
as $$
declare v_match tournament_matches%rowtype;
begin
  if not is_admin_caller() then raise exception 'Acesso negado'; end if;
  select * into v_match from tournament_matches where id=p_match;
  if not found then raise exception 'Partida não encontrada'; end if;
  if v_match.participant_a_id <> p_winner and v_match.participant_b_id <> p_winner then raise exception 'Vencedor não está nesta partida'; end if;
  return report_match_result(p_match, case when v_match.participant_a_id=p_winner then 1 else 0 end, case when v_match.participant_b_id=p_winner then 1 else 0 end);
end;
$$;

-- ── close_group_stage ─────────────────────────────────────────────────────────
create or replace function close_group_stage(p_tournament uuid)
returns void language plpgsql security definer
as $$
declare v_group_id text;
begin
  if not is_admin_caller() then raise exception 'Acesso negado'; end if;
  for v_group_id in select distinct group_id from tournament_group_slots where tournament_id=p_tournament order by group_id loop
    perform tournament_auto_advance_group(p_tournament, v_group_id);
  end loop;
end;
$$;
