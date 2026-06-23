-- ============================================================
-- Torneios — RPCs Transacionais
-- NÃO APLICAR DIRETAMENTE — somente via banco local/HML
-- ============================================================

-- generate_bracket: lê participantes, aplica seeding, cria tournament_matches.
-- Idempotente: limpa e regenera se status=draft.
create or replace function generate_bracket(
  p_tournament uuid,
  p_method     seeding_method default 'standard'
)
returns setof tournament_matches
language plpgsql
security definer
as $$
declare
  v_admin boolean;
  v_status tournament_status;
  v_best_of int;
  v_parts   uuid[];
  v_n       int;
  v_rounds  int;
  v_ids     uuid[][];
  i         int;
  r         int;
  v_match   uuid;
  v_next    uuid;
  v_slot    int;
  v_a       uuid;
  v_b       uuid;
begin
  -- Verificar admin
  select exists(select 1 from users where id = auth.uid() and role = 'admin') into v_admin;
  if not v_admin then
    raise exception 'Acesso negado';
  end if;

  select status, best_of into v_status, v_best_of
  from tournaments where id = p_tournament;

  if v_status not in ('draft','registration') then
    raise exception 'Chave só pode ser gerada em draft ou registration';
  end if;

  -- Limpar partidas existentes
  delete from tournament_matches where tournament_id = p_tournament;

  -- Ordenar participantes conforme método
  if p_method = 'elo' then
    select array_agg(tp.id order by u.rating_atual desc nulls last)
    into v_parts
    from tournament_participants tp
    left join users u on u.id = tp.user_id
    where tp.tournament_id = p_tournament;
  elsif p_method = 'sequential' then
    select array_agg(id order by created_at)
    into v_parts
    from tournament_participants where tournament_id = p_tournament;
  else -- standard / manual / pots: respeitar seed já salvo
    select array_agg(id order by coalesce(seed, 999), created_at)
    into v_parts
    from tournament_participants where tournament_id = p_tournament;
  end if;

  v_n := array_length(v_parts, 1);
  if v_n < 2 then
    raise exception 'Mínimo de 2 participantes para gerar a chave';
  end if;

  -- Próxima potência de 2
  v_rounds := ceil(log(2, v_n::numeric))::int;
  v_n := power(2, v_rounds)::int;

  -- Pré-alocar IDs: v_ids[r] = array de IDs para a rodada r (r=v_rounds é a inicial)
  -- Indice 1 = final, indice v_rounds = primeira rodada
  v_ids := array[]::uuid[][];
  for r in 1..v_rounds loop
    v_ids := v_ids || array[array_fill(gen_random_uuid(), array[power(2, v_rounds - r)::int])];
  end loop;

  -- Inserir partidas
  for r in 1..v_rounds loop
    for i in 0..(power(2, v_rounds - r)::int - 1) loop
      -- next_match
      if r > 1 then
        v_next := (v_ids[r-1])[i/2 + 1];
        v_slot := i % 2;
      else
        v_next := null;
        v_slot := null;
      end if;

      -- participantes apenas na rodada inicial
      if r = v_rounds then
        v_a := v_parts[i*2 + 1];
        v_b := v_parts[i*2 + 2]; -- pode ser null (BYE)
      else
        v_a := null;
        v_b := null;
      end if;

      insert into tournament_matches (
        id, tournament_id, round, bracket, slot,
        participant_a_id, participant_b_id, winner_participant_id,
        next_match_id, next_match_slot, status
      ) values (
        (v_ids[r])[i+1], p_tournament, r, 'winners', i,
        v_a, v_b,
        case when v_b is null then v_a else null end,
        v_next, v_slot::int,
        case when v_b is null then 'finished' when v_a is not null and v_b is not null then 'scheduled' else 'pending' end
      );

      -- Propagar BYE imediatamente
      if v_b is null and v_a is not null and v_next is not null then
        update tournament_matches
          set participant_a_id = case when v_slot = 0 then v_a else participant_a_id end,
              participant_b_id = case when v_slot = 1 then v_a else participant_b_id end
          where id = v_next;
      end if;
    end loop;
  end loop;

  -- Ativar torneio
  update tournaments set status = 'active' where id = p_tournament;

  return query select * from tournament_matches where tournament_id = p_tournament order by round desc, slot;
end;
$$;

-- report_match_result: valida best_of, define winner, propaga para next_match.
create or replace function report_match_result(
  p_match uuid,
  p_a     int,
  p_b     int,
  p_sets  jsonb default null
)
returns tournament_matches
language plpgsql
security definer
as $$
declare
  v_admin   boolean;
  v_match   tournament_matches%rowtype;
  v_best_of int;
  v_winner  uuid;
  v_next    tournament_matches%rowtype;
begin
  select exists(select 1 from users where id = auth.uid() and role = 'admin') into v_admin;
  if not v_admin then raise exception 'Acesso negado'; end if;

  select * into v_match from tournament_matches where id = p_match;
  if not found then raise exception 'Partida não encontrada'; end if;
  if v_match.status = 'finished' then raise exception 'Partida já encerrada'; end if;

  select best_of into v_best_of from tournaments where id = v_match.tournament_id;

  -- Validar melhor de N
  declare v_needed int := ceil(v_best_of::numeric / 2);
  begin
    if p_a < v_needed and p_b < v_needed then
      raise exception 'Placar inválido para melhor de %', v_best_of;
    end if;
  end;

  v_winner := case when p_a > p_b then v_match.participant_a_id else v_match.participant_b_id end;

  update tournament_matches
    set score_a = p_a, score_b = p_b, sets = p_sets,
        winner_participant_id = v_winner,
        status = 'finished', finished_at = now()
    where id = p_match
    returning * into v_match;

  -- Propagar vencedor para next_match
  if v_match.next_match_id is not null then
    update tournament_matches
      set participant_a_id = case when v_match.next_match_slot = 0 then v_winner else participant_a_id end,
          participant_b_id = case when v_match.next_match_slot = 1 then v_winner else participant_b_id end
      where id = v_match.next_match_id
      returning * into v_next;

    -- Se next_match tem os 2 participantes, passa para scheduled
    if v_next.participant_a_id is not null and v_next.participant_b_id is not null then
      update tournament_matches set status = 'scheduled' where id = v_next.id;
    end if;
  end if;

  -- Log admin
  insert into admin_logs (action, details, created_by)
  values ('tournament_result', jsonb_build_object('match_id', p_match, 'score_a', p_a, 'score_b', p_b), auth.uid());

  return v_match;
end;
$$;

-- revert_match_result: desfaz resultado e limpa a sub-árvore.
create or replace function revert_match_result(p_match uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_admin  boolean;
  v_match  tournament_matches%rowtype;
  v_winner uuid;
begin
  select exists(select 1 from users where id = auth.uid() and role = 'admin') into v_admin;
  if not v_admin then raise exception 'Acesso negado'; end if;

  select * into v_match from tournament_matches where id = p_match;
  if not found then raise exception 'Partida não encontrada'; end if;

  v_winner := v_match.winner_participant_id;

  -- Limpar este resultado
  update tournament_matches
    set score_a = null, score_b = null, sets = null,
        winner_participant_id = null, status = 'scheduled',
        finished_at = null
    where id = p_match;

  -- Limpar propagação em next_match (recursivo simples — 1 nível por enquanto)
  if v_match.next_match_id is not null then
    update tournament_matches
      set participant_a_id = case when participant_a_id = v_winner then null else participant_a_id end,
          participant_b_id = case when participant_b_id = v_winner then null else participant_b_id end,
          score_a = null, score_b = null, sets = null,
          winner_participant_id = null, status = 'pending', finished_at = null
      where id = v_match.next_match_id;
  end if;

  insert into admin_logs (action, details, created_by)
  values ('tournament_revert', jsonb_build_object('match_id', p_match), auth.uid());
end;
$$;

-- walkover: propaga vencedor por W/O.
create or replace function walkover(p_match uuid, p_winner uuid)
returns tournament_matches
language plpgsql
security definer
as $$
declare
  v_admin boolean;
  v_match tournament_matches%rowtype;
  v_next  tournament_matches%rowtype;
begin
  select exists(select 1 from users where id = auth.uid() and role = 'admin') into v_admin;
  if not v_admin then raise exception 'Acesso negado'; end if;

  update tournament_matches
    set winner_participant_id = p_winner, status = 'finished', finished_at = now()
    where id = p_match
    returning * into v_match;

  if v_match.next_match_id is not null then
    update tournament_matches
      set participant_a_id = case when v_match.next_match_slot = 0 then p_winner else participant_a_id end,
          participant_b_id = case when v_match.next_match_slot = 1 then p_winner else participant_b_id end
      where id = v_match.next_match_id
      returning * into v_next;
    if v_next.participant_a_id is not null and v_next.participant_b_id is not null then
      update tournament_matches set status = 'scheduled' where id = v_next.id;
    end if;
  end if;

  return v_match;
end;
$$;

-- close_group_stage: calcula standings e semeia mata-mata.
create or replace function close_group_stage(p_tournament uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_admin boolean;
begin
  select exists(select 1 from users where id = auth.uid() and role = 'admin') into v_admin;
  if not v_admin then raise exception 'Acesso negado'; end if;
  -- Implementação completa na Fase 2
  raise notice 'close_group_stage: implementação na F2';
end;
$$;
