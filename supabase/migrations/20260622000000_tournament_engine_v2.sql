-- ============================================================================
-- Tournament Engine v2 — Reescrita das RPCs + tabela auxiliar + view corrigida
--
-- Corrige:
--   • generate_bracket: todos os formatos (single_elimination, round_robin,
--     groups_knockout, king_of_table) + seeding espelhado + BYEs distribuídos
--     + partida de 3º lugar (placement)
--   • report_match_result: permite corrigir resultado já lançado + limpa
--     sub-árvore recursivamente + auto-avança grupo após resultado
--   • revert_match_result: limpeza recursiva da cadeia completa
--   • close_group_stage: implementação completa usando tournament_group_slots
--   • tournament_standings: view corrigida com `position` e join via participantes
--
-- Não altera nenhuma tabela do core (users, seasons, matches, rating_transactions).
-- Toda interação com o core é leitura (auth check + rating para seeding ELO).
--
-- ⚠️ NÃO APLICAR automaticamente — aplicar manualmente em HML/PROD.
--    Ordem de aplicação: esta migration depende das 20260617* e 20260619*.
-- ============================================================================

-- ── Tabela auxiliar: mapa grupo → slot do bracket (grupos_knockout) ──────────
create table if not exists tournament_group_slots (
  tournament_id uuid not null references tournaments(id)        on delete cascade,
  group_id      text not null,
  rank          int  not null,   -- 0 = 1º colocado, 1 = 2º, …
  match_id      uuid not null references tournament_matches(id) on delete cascade,
  match_slot    int  not null check (match_slot in (0, 1)),
  primary key   (tournament_id, group_id, rank)
);

create index if not exists tournament_group_slots_tournament
  on tournament_group_slots(tournament_id);

-- ── Helper: seeding espelhado clássico ───────────────────────────────────────
-- Gera a ordem de seeds por posição de bracket.
-- Exemplo n=8 → {1,8,5,4,3,6,7,2}  (seed 1 e 2 nos lados opostos, BYEs no topo)
create or replace function tournament_standard_order(p_n int)
returns int[]
language plpgsql immutable
as $$
declare
  half   int[];
  result int[] := '{}';
  s      int;
begin
  if p_n = 1 then return array[1]; end if;
  half := tournament_standard_order(p_n / 2);
  foreach s in array half loop
    result := result || array[s, p_n + 1 - s];
  end loop;
  return result;
end;
$$;

-- ── Helper: limpeza recursiva da sub-árvore ───────────────────────────────────
-- Remove o vencedor antigo do próximo jogo e propaga recursivamente.
create or replace function tournament_clear_forward(p_match_id uuid, p_old_winner uuid)
returns void
language plpgsql
as $$
declare
  v_next_id     uuid;
  v_next_winner uuid;
  v_new_a       uuid;
  v_new_b       uuid;
begin
  if p_old_winner is null then return; end if;

  select next_match_id into v_next_id
  from tournament_matches where id = p_match_id;
  if v_next_id is null then return; end if;

  select winner_participant_id,
         case when participant_a_id = p_old_winner then null else participant_a_id end,
         case when participant_b_id = p_old_winner then null else participant_b_id end
  into v_next_winner, v_new_a, v_new_b
  from tournament_matches where id = v_next_id;
  if not found then return; end if;

  -- Desce recursivamente antes de mutar (depth-first)
  if v_next_winner is not null then
    perform tournament_clear_forward(v_next_id, v_next_winner);
  end if;

  update tournament_matches
    set participant_a_id      = v_new_a,
        participant_b_id      = v_new_b,
        score_a               = null,
        score_b               = null,
        sets                  = null,
        winner_participant_id = null,
        finished_at           = null,
        status = case
          when v_new_a is not null and v_new_b is not null then 'scheduled'::match_status
          else 'pending'::match_status
        end
    where id = v_next_id;
end;
$$;

-- ── Helper: sincroniza disputa de 3º lugar com os perdedores das semis ────────
create or replace function tournament_sync_placement(p_tournament uuid)
returns void
language plpgsql
as $$
declare
  v_final_id  uuid;
  v_pl        tournament_matches%rowtype;
  v_s1        tournament_matches%rowtype;
  v_s2        tournament_matches%rowtype;
  v_loser1    uuid;
  v_loser2    uuid;
begin
  select * into v_pl
  from tournament_matches
  where tournament_id = p_tournament and bracket = 'placement'
  limit 1;
  if not found then return; end if;

  select id into v_final_id
  from tournament_matches
  where tournament_id = p_tournament and bracket = 'winners' and next_match_id is null
  order by round limit 1;
  if v_final_id is null then return; end if;

  -- semis: winners cujo next_match_id aponta para a final, ordenados por slot
  select * into v_s1 from tournament_matches
  where tournament_id = p_tournament and bracket = 'winners' and next_match_id = v_final_id
  order by slot asc limit 1;

  select * into v_s2 from tournament_matches
  where tournament_id = p_tournament and bracket = 'winners' and next_match_id = v_final_id
  order by slot desc limit 1;

  if v_s1.id is null or v_s2.id is null or v_s1.id = v_s2.id then return; end if;

  if v_s1.status <> 'finished' or v_s2.status <> 'finished' then
    if v_pl.participant_a_id is not null or v_pl.participant_b_id is not null
       or v_pl.winner_participant_id is not null then
      update tournament_matches
        set participant_a_id = null, participant_b_id = null,
            score_a = null, score_b = null, sets = null,
            winner_participant_id = null, finished_at = null, status = 'pending'
        where id = v_pl.id;
    end if;
    return;
  end if;

  v_loser1 := case
    when v_s1.winner_participant_id = v_s1.participant_a_id then v_s1.participant_b_id
    else v_s1.participant_a_id end;
  v_loser2 := case
    when v_s2.winner_participant_id = v_s2.participant_a_id then v_s2.participant_b_id
    else v_s2.participant_a_id end;

  if v_pl.participant_a_id is distinct from v_loser1
     or v_pl.participant_b_id is distinct from v_loser2 then
    update tournament_matches
      set participant_a_id      = v_loser1,
          participant_b_id      = v_loser2,
          score_a               = null,
          score_b               = null,
          sets                  = null,
          winner_participant_id = null,
          finished_at           = null,
          status = case
            when v_loser1 is not null and v_loser2 is not null then 'scheduled'::match_status
            else 'pending'::match_status end
      where id = v_pl.id;
  end if;
end;
$$;

-- ── Helper: standings de um grupo (para close_group_stage / auto_advance) ─────
create or replace function tournament_group_standings(p_tournament uuid, p_group_id text)
returns table(participant_id uuid, rank int)
language sql stable
as $$
  with stats as (
    select
      p.id as participant_id,
      coalesce(sum(case when m.winner_participant_id = p.id then 3 else 0 end), 0)         as points,
      coalesce(sum(case when m.participant_a_id = p.id then m.score_a else m.score_b end), 0)
        - coalesce(sum(case when m.participant_a_id = p.id then m.score_b else m.score_a end), 0) as saldo,
      coalesce(sum(case when m.participant_a_id = p.id then m.score_a else m.score_b end), 0) as sets_won
    from tournament_participants p
    left join tournament_matches m
      on  m.tournament_id = p.tournament_id
      and (m.participant_a_id = p.id or m.participant_b_id = p.id)
      and m.bracket = 'group'
      and m.status  = 'finished'
    where p.tournament_id = p_tournament
      and p.group_id = p_group_id
    group by p.id
  )
  select
    participant_id,
    (row_number() over (order by points desc, saldo desc, sets_won desc) - 1)::int as rank
  from stats;
$$;

-- ── Helper: limpa slots do knockout de um grupo (ao corrigir resultado de grupo)
create or replace function tournament_clear_group_slots(p_tournament uuid, p_group_id text)
returns void
language plpgsql
as $$
declare
  v_slot  record;
  v_match tournament_matches%rowtype;
begin
  for v_slot in
    select match_id, match_slot
    from tournament_group_slots
    where tournament_id = p_tournament and group_id = p_group_id
  loop
    select * into v_match from tournament_matches where id = v_slot.match_id;
    if not found then continue; end if;

    -- Se o jogo do knockout já tem resultado, limpa a sub-árvore antes
    if v_match.winner_participant_id is not null then
      perform tournament_clear_forward(v_match.id, v_match.winner_participant_id);
      update tournament_matches
        set score_a = null, score_b = null, sets = null,
            winner_participant_id = null, finished_at = null, status = 'pending'
        where id = v_match.id;
    end if;

    -- Esvazia o slot
    if v_slot.match_slot = 0 then
      update tournament_matches set participant_a_id = null, status = 'pending'
      where id = v_slot.match_id;
    else
      update tournament_matches set participant_b_id = null, status = 'pending'
      where id = v_slot.match_id;
    end if;
  end loop;
end;
$$;

-- ── Helper: avança grupo para o mata-mata quando todos os jogos terminam ──────
create or replace function tournament_auto_advance_group(p_tournament uuid, p_group_id text)
returns void
language plpgsql
as $$
declare
  v_pending int;
  v_slot    record;
  v_winner  uuid;
begin
  select count(*) into v_pending
  from tournament_matches
  where tournament_id = p_tournament
    and bracket       = 'group'
    and group_id      = p_group_id
    and status        <> 'finished';
  if v_pending > 0 then return; end if;

  for v_slot in
    select tgs.rank, tgs.match_id, tgs.match_slot
    from tournament_group_slots tgs
    where tgs.tournament_id = p_tournament and tgs.group_id = p_group_id
  loop
    select gs.participant_id into v_winner
    from tournament_group_standings(p_tournament, p_group_id) gs
    where gs.rank = v_slot.rank;

    if v_winner is null then continue; end if;

    if v_slot.match_slot = 0 then
      update tournament_matches set participant_a_id = v_winner where id = v_slot.match_id;
    else
      update tournament_matches set participant_b_id = v_winner where id = v_slot.match_id;
    end if;
  end loop;

  -- Ativa os jogos do knockout que agora têm os dois lados preenchidos
  update tournament_matches
  set status = 'scheduled'
  where id in (select match_id from tournament_group_slots where tournament_id = p_tournament and group_id = p_group_id)
    and participant_a_id is not null
    and participant_b_id is not null
    and status = 'pending';
end;
$$;

-- ── generate_bracket (reescrita completa) ─────────────────────────────────────
create or replace function generate_bracket(
  p_tournament uuid,
  p_method     seeding_method default 'standard'
)
returns setof tournament_matches
language plpgsql
security definer
as $$
declare
  v_admin       boolean;
  v_t           tournaments%rowtype;
  v_parts       uuid[];          -- participantes ordenados pelo método
  v_n_actual    int;
  v_n           int;             -- próxima potência de 2
  v_rounds      int;
  v_order       int[];           -- seeding espelhado (standard_order)
  v_ids         uuid[];          -- IDs pré-alocados indexados por (round, slot)
  v_total       int;
  v_a           uuid;
  v_b           uuid;
  v_is_bye      boolean;
  v_winner      uuid;
  v_next_id     uuid;
  v_next_slot   int;
  r             int;
  i             int;
  -- grupos
  v_group_ids   text[];
  v_group_count int;
  v_group_size  int;
  v_spots       int;
  v_total_class int;
  v_slot        int;
  g             text;
  v_pair_a      uuid;
  v_pair_b      uuid;
  v_gparts      uuid[];
  v_km_ids      uuid[];          -- IDs do knockout (indexados igual ao single_elim)
  v_km_rounds   int;
  v_km_total    int;
  -- seeded slots para grupos→knockout
  v_seed_groups text[];
  v_seed_ranks  int[];
  v_tier_groups text[];
  v_rev_groups  text[];
  ins_pos       int;
  k             int;
begin
  -- ── Verificar admin ──────────────────────────────────────────────────────
  select exists(select 1 from users where id = auth.uid() and role = 'admin') into v_admin;
  if not v_admin then raise exception 'Acesso negado'; end if;

  select * into v_t from tournaments where id = p_tournament;
  if not found then raise exception 'Torneio não encontrado'; end if;
  if v_t.status not in ('draft','registration') then
    raise exception 'Chave só pode ser gerada em status draft ou registration';
  end if;

  -- Limpa estado anterior
  delete from tournament_group_slots where tournament_id = p_tournament;
  delete from tournament_matches       where tournament_id = p_tournament;

  -- ── Carregar participantes conforme método ───────────────────────────────
  if p_method = 'elo' then
    select array_agg(tp.id order by coalesce(u.rating_atual, 0) desc, tp.created_at)
    into v_parts
    from tournament_participants tp
    left join users u on u.id = tp.user_id
    where tp.tournament_id = p_tournament and tp.signup_status = 'confirmed';
  elsif p_method = 'sequential' then
    select array_agg(id order by created_at)
    into v_parts
    from tournament_participants
    where tournament_id = p_tournament and signup_status = 'confirmed';
  else
    select array_agg(id order by coalesce(seed, 9999), created_at)
    into v_parts
    from tournament_participants
    where tournament_id = p_tournament and signup_status = 'confirmed';
  end if;

  v_n_actual := coalesce(array_length(v_parts, 1), 0);
  if v_n_actual < 2 then
    raise exception 'Mínimo de 2 participantes confirmados para gerar a chave';
  end if;

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- ROUND ROBIN PURO — todos contra todos, grupo único "GERAL"
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if v_t.format = 'round_robin' then
    update tournament_participants set group_id = 'GERAL'
    where tournament_id = p_tournament and signup_status = 'confirmed';

    v_slot := 0;
    for i in 1..v_n_actual loop
      for k in (i+1)..v_n_actual loop
        insert into tournament_matches (
          tournament_id, round, bracket, slot, group_id,
          participant_a_id, participant_b_id, status
        ) values (
          p_tournament, 100, 'group', v_slot, 'GERAL',
          v_parts[i], v_parts[k], 'scheduled'
        );
        v_slot := v_slot + 1;
      end loop;
    end loop;

    update tournaments set status = 'active' where id = p_tournament;
    return query select * from tournament_matches where tournament_id = p_tournament order by slot;
    return;
  end if;

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- GROUPS + KNOCKOUT — round-robin por grupo → bracket espelhado cross-group
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if v_t.format = 'groups_knockout' then
    select array_agg(distinct tp.group_id order by tp.group_id)
    into v_group_ids
    from tournament_participants tp
    where tp.tournament_id = p_tournament
      and tp.group_id is not null
      and tp.signup_status = 'confirmed';

    if v_group_ids is null or array_length(v_group_ids, 1) < 2 then
      raise exception 'Configure os grupos antes de gerar (mínimo 2 grupos)';
    end if;
    v_group_count := array_length(v_group_ids, 1);

    -- Tamanho máximo de grupo → vagas por grupo
    select max(cnt) into v_group_size
    from (
      select count(*)::int as cnt
      from tournament_participants
      where tournament_id = p_tournament and signup_status = 'confirmed'
        and group_id = any(v_group_ids)
      group by group_id
    ) t;
    v_spots := greatest(1, ceil(v_group_size::numeric / 2)::int);
    v_total_class := v_group_count * v_spots;

    -- Valida que o total classificado é potência de 2
    v_n := 1;
    while v_n < v_total_class loop v_n := v_n * 2; end loop;
    if v_n <> v_total_class then
      raise exception 'Configuração inválida: % classificados não é potência de 2 (use 2, 4 ou 8 grupos)', v_total_class;
    end if;

    -- ── Round-robin por grupo ──────────────────────────────────────────────
    v_slot := 0;
    foreach g in array v_group_ids loop
      select array_agg(id order by coalesce(seed, 9999), created_at) into v_gparts
      from tournament_participants
      where tournament_id = p_tournament and group_id = g and signup_status = 'confirmed';

      for i in 1..array_length(v_gparts, 1) loop
        for k in (i+1)..array_length(v_gparts, 1) loop
          insert into tournament_matches (
            tournament_id, round, bracket, slot, group_id,
            participant_a_id, participant_b_id, status
          ) values (
            p_tournament, 100, 'group', v_slot, g,
            v_gparts[i], v_gparts[k], 'scheduled'
          );
          v_slot := v_slot + 1;
        end loop;
      end loop;
    end loop;

    -- ── Skeleton do mata-mata ──────────────────────────────────────────────
    v_km_rounds := cast(log(2, v_total_class) as int);
    v_km_total  := v_total_class - 1;   -- 2^rounds - 1

    v_km_ids := '{}';
    for i in 1..v_km_total loop
      v_km_ids := v_km_ids || gen_random_uuid();
    end loop;
    -- Índice: match (round=r, slot=s) → v_km_ids[ 2^(r-1) + s ]  (1-indexed)

    for r in 1..v_km_rounds loop
      for i in 0..( (2^(v_km_rounds - r + 1) / 2)::int - 1 ) loop
        -- next match
        if r > 1 then
          v_next_id   := v_km_ids[ (2^(r-2))::int + i/2 ];
          v_next_slot := i % 2;
        else
          v_next_id   := null;
          v_next_slot := null;
        end if;

        insert into tournament_matches (
          id, tournament_id, round, bracket, slot,
          next_match_id, next_match_slot, status
        ) values (
          v_km_ids[ (2^(r-1))::int + i ],
          p_tournament,
          r,
          'winners',
          i,
          v_next_id,
          v_next_slot,
          'pending'
        );
      end loop;
    end loop;

    -- ── Seeded slots: seeding cross-group (evita confronto do mesmo grupo nas semis)
    -- Algoritmo: rank 0 → grupos em ordem; rank 1 → grupos invertidos, intercalados
    v_seed_groups := '{}';
    v_seed_ranks  := '{}';

    for r in 0..(v_spots - 1) loop
      if r % 2 = 0 then
        v_tier_groups := v_group_ids;
      else
        -- reverse
        v_rev_groups := '{}';
        for i in reverse array_length(v_group_ids, 1)..1 loop
          v_rev_groups := v_rev_groups || v_group_ids[i];
        end loop;
        v_tier_groups := v_rev_groups;
      end if;

      if r = 0 then
        for i in 1..array_length(v_tier_groups, 1) loop
          v_seed_groups := v_seed_groups || v_tier_groups[i];
          v_seed_ranks  := v_seed_ranks  || 0;
        end loop;
      else
        for i in 0..(array_length(v_tier_groups, 1) - 1) loop
          ins_pos := i * v_spots + r;  -- 0-indexed insertion position (becomes 1-indexed +1)
          v_seed_groups := v_seed_groups[1:ins_pos] || v_tier_groups[i+1] || v_seed_groups[ins_pos+1:array_length(v_seed_groups,1)];
          v_seed_ranks  := v_seed_ranks[1:ins_pos]  || r                  || v_seed_ranks[ins_pos+1:array_length(v_seed_ranks,1)];
        end loop;
      end if;
    end loop;

    -- ── Insere entradas na tabela de slots ──────────────────────────────────
    -- Primeira rodada do knockout: round = v_km_rounds
    -- Match na posição i do primeiro round: v_km_ids[ 2^(km_rounds-1) + i ]
    -- participante A = seeded_slots[i*2], participante B = seeded_slots[i*2+1]
    for i in 0..( v_total_class / 2 - 1 ) loop
      declare
        v_mid    uuid := v_km_ids[ (2^(v_km_rounds - 1))::int + i ];
        v_grp_a  text := v_seed_groups[ i*2 + 1 ];
        v_rnk_a  int  := v_seed_ranks [ i*2 + 1 ];
        v_grp_b  text := v_seed_groups[ i*2 + 2 ];
        v_rnk_b  int  := v_seed_ranks [ i*2 + 2 ];
      begin
        insert into tournament_group_slots (tournament_id, group_id, rank, match_id, match_slot)
        values (p_tournament, v_grp_a, v_rnk_a, v_mid, 0)
        on conflict (tournament_id, group_id, rank) do update
          set match_id = excluded.match_id, match_slot = excluded.match_slot;

        insert into tournament_group_slots (tournament_id, group_id, rank, match_id, match_slot)
        values (p_tournament, v_grp_b, v_rnk_b, v_mid, 1)
        on conflict (tournament_id, group_id, rank) do update
          set match_id = excluded.match_id, match_slot = excluded.match_slot;
      end;
    end loop;

    update tournaments set status = 'active' where id = p_tournament;
    return query select * from tournament_matches where tournament_id = p_tournament
                 order by bracket desc, round desc, slot;
    return;
  end if;

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- KING OF TABLE — cadeia sequencial: vencedor fica como rei, próximo desafia
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if v_t.format = 'king_of_table' then
    v_km_ids := '{}';
    for i in 1..(v_n_actual - 1) loop
      v_km_ids := v_km_ids || gen_random_uuid();
    end loop;

    for i in 1..(v_n_actual - 1) loop
      insert into tournament_matches (
        id, tournament_id, round, bracket, slot,
        participant_a_id, participant_b_id,
        next_match_id, next_match_slot,
        status
      ) values (
        v_km_ids[i],
        p_tournament,
        i,
        'winners',
        0,
        case when i = 1 then v_parts[1] else null end,  -- rei começa na rodada 1
        v_parts[i + 1],                                   -- desafiante
        case when i < v_n_actual - 1 then v_km_ids[i+1] else null end,
        0,
        case when i = 1 then 'scheduled'::match_status else 'pending'::match_status end
      );
    end loop;

    update tournaments set status = 'active' where id = p_tournament;
    return query select * from tournament_matches where tournament_id = p_tournament order by round;
    return;
  end if;

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- SINGLE ELIMINATION (padrão, inclui double_elimination etc. ainda sem engine)
  -- Seeding espelhado: seed 1 vs N/2+1, seed 2 vs N/2+2, etc. (evita top vs top)
  -- BYEs distribuídos pelos seeds mais altos — nunca dois BYEs no mesmo jogo.
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  v_n := 1;
  while v_n < v_n_actual loop v_n := v_n * 2; end loop;
  v_rounds := cast(log(2, v_n) as int);
  v_total  := v_n - 1;  -- total de partidas no bracket (2^rounds - 1)

  -- Pré-aloca IDs: posição no array = 2^(round-1) + slot  (1-indexed, round começa em 1=final)
  v_ids := '{}';
  for i in 1..v_total loop
    v_ids := v_ids || gen_random_uuid();
  end loop;

  -- Ordem espelhada de seeds
  v_order := tournament_standard_order(v_n);

  -- ── Insere todas as rodadas ──────────────────────────────────────────────
  for r in 1..v_rounds loop
    for i in 0..( (2^(r-1))::int - 1 ) loop
      -- next_match: (round=r-1, slot=floor(i/2)) → v_ids[ 2^(r-2) + i/2 ]
      if r > 1 then
        v_next_id   := v_ids[ (2^(r-2))::int + i/2 ];
        v_next_slot := i % 2;
      else
        v_next_id   := null;
        v_next_slot := null;
      end if;

      -- Participantes só na rodada inicial (r = v_rounds)
      if r = v_rounds then
        declare
          seed_a int := v_order[ i*2 + 1 ];
          seed_b int := v_order[ i*2 + 2 ];
        begin
          v_a       := case when seed_a <= v_n_actual then v_parts[seed_a] else null end;
          v_b       := case when seed_b <= v_n_actual then v_parts[seed_b] else null end;
          v_is_bye  := (v_a is not null and v_b is null) or (v_b is not null and v_a is null);
          v_winner  := case when v_is_bye then coalesce(v_a, v_b) else null end;
        end;
      else
        v_a      := null;
        v_b      := null;
        v_is_bye := false;
        v_winner := null;
      end if;

      insert into tournament_matches (
        id, tournament_id, round, bracket, slot,
        participant_a_id, participant_b_id, winner_participant_id,
        next_match_id, next_match_slot,
        status, finished_at
      ) values (
        v_ids[ (2^(r-1))::int + i ],
        p_tournament,
        r,
        'winners',
        i,
        v_a, v_b, v_winner,
        v_next_id, v_next_slot,
        case when v_is_bye     then 'finished'::match_status
             when v_a is not null and v_b is not null then 'scheduled'::match_status
             else 'pending'::match_status end,
        case when v_is_bye then now() else null end
      );

      -- Propaga BYE para a próxima rodada imediatamente
      if v_is_bye and v_winner is not null and v_next_id is not null then
        update tournament_matches
          set participant_a_id = case when v_next_slot = 0 then v_winner else participant_a_id end,
              participant_b_id = case when v_next_slot = 1 then v_winner else participant_b_id end
          where id = v_next_id;
        -- Se agora tem os dois lados, passa para scheduled
        update tournament_matches set status = 'scheduled'
          where id = v_next_id
            and participant_a_id is not null
            and participant_b_id is not null
            and status = 'pending';
      end if;
    end loop;
  end loop;

  -- Disputa de 3º lugar (se habilitada e tiver pelo menos 4 jogadores / semis)
  if v_t.third_place_match and v_n_actual >= 4 then
    insert into tournament_matches (
      tournament_id, round, bracket, slot, status
    ) values (
      p_tournament, 1, 'placement', 1, 'pending'
    );
  end if;

  update tournaments set status = 'active' where id = p_tournament;
  return query select * from tournament_matches
               where tournament_id = p_tournament
               order by bracket desc, round desc, slot;
end;
$$;

-- ── report_match_result (corrigido) ───────────────────────────────────────────
-- Permite editar resultado já lançado. Propaga recursivamente. Suporta grupo→KO.
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
  v_admin      boolean;
  v_match      tournament_matches%rowtype;
  v_t_status   tournament_status;
  v_best_of    int;
  v_needed     int;
  v_old_winner uuid;
  v_new_winner uuid;
  v_next       tournament_matches%rowtype;
begin
  select exists(select 1 from users where id = auth.uid() and role = 'admin') into v_admin;
  if not v_admin then raise exception 'Acesso negado'; end if;

  select * into v_match from tournament_matches where id = p_match;
  if not found then raise exception 'Partida não encontrada'; end if;

  select status, best_of into v_t_status, v_best_of
  from tournaments where id = v_match.tournament_id;
  if v_t_status = 'finished' then
    raise exception 'Torneio já encerrado. Reabra antes de editar.';
  end if;

  if v_match.participant_a_id is null or v_match.participant_b_id is null then
    raise exception 'Defina os dois participantes antes de lançar o placar.';
  end if;

  if p_a = p_b then
    raise exception 'Empate não é permitido no tênis de mesa.';
  end if;

  v_needed := ceil(v_best_of::numeric / 2)::int;
  if p_a < v_needed and p_b < v_needed then
    raise exception 'Placar inválido para melhor de %: nenhum atingiu % vitórias', v_best_of, v_needed;
  end if;

  v_old_winner := v_match.winner_participant_id;
  v_new_winner := case when p_a > p_b then v_match.participant_a_id else v_match.participant_b_id end;

  -- Corrigindo resultado anterior com vencedor diferente
  if v_old_winner is not null and v_old_winner <> v_new_winner then
    -- Limpa sub-árvore do bracket
    perform tournament_clear_forward(p_match, v_old_winner);

    -- Para partidas de grupo: limpa slots do mata-mata e re-avança depois
    if v_match.bracket = 'group' and v_match.group_id is not null then
      perform tournament_clear_group_slots(v_match.tournament_id, v_match.group_id);
    end if;
  end if;

  -- Salva resultado
  update tournament_matches
    set score_a               = p_a,
        score_b               = p_b,
        sets                  = p_sets,
        winner_participant_id = v_new_winner,
        status                = 'finished',
        finished_at           = now()
    where id = p_match
    returning * into v_match;

  -- Propaga vencedor para próxima partida (bracket winners/placement)
  if v_match.next_match_id is not null then
    update tournament_matches
      set participant_a_id = case when v_match.next_match_slot = 0 then v_new_winner else participant_a_id end,
          participant_b_id = case when v_match.next_match_slot = 1 then v_new_winner else participant_b_id end
      where id = v_match.next_match_id
      returning * into v_next;

    if v_next.participant_a_id is not null and v_next.participant_b_id is not null then
      update tournament_matches set status = 'scheduled' where id = v_next.id and status = 'pending';
    end if;
  end if;

  -- Auto-avança grupo para o mata-mata quando o grupo termina
  if v_match.bracket = 'group' and v_match.group_id is not null then
    perform tournament_auto_advance_group(v_match.tournament_id, v_match.group_id);
  end if;

  -- Sincroniza disputa de 3º lugar se for uma semifinal
  if v_match.bracket = 'winners' then
    perform tournament_sync_placement(v_match.tournament_id);
  end if;

  return v_match;
end;
$$;

-- ── revert_match_result (recursivo) ───────────────────────────────────────────
create or replace function revert_match_result(p_match uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_admin  boolean;
  v_match  tournament_matches%rowtype;
begin
  select exists(select 1 from users where id = auth.uid() and role = 'admin') into v_admin;
  if not v_admin then raise exception 'Acesso negado'; end if;

  select * into v_match from tournament_matches where id = p_match;
  if not found then raise exception 'Partida não encontrada'; end if;

  -- Limpa sub-árvore recursivamente antes de desfazer este resultado
  if v_match.winner_participant_id is not null then
    perform tournament_clear_forward(p_match, v_match.winner_participant_id);
  end if;

  -- Para partidas de grupo: limpa slots do mata-mata
  if v_match.bracket = 'group' and v_match.group_id is not null then
    perform tournament_clear_group_slots(v_match.tournament_id, v_match.group_id);
  end if;

  update tournament_matches
    set score_a               = null,
        score_b               = null,
        sets                  = null,
        winner_participant_id = null,
        finished_at           = null,
        status = case
          when participant_a_id is not null and participant_b_id is not null then 'scheduled'::match_status
          else 'pending'::match_status end
    where id = p_match;

  -- Ressincroniza 3º lugar
  if v_match.bracket = 'winners' then
    perform tournament_sync_placement(v_match.tournament_id);
  end if;
end;
$$;

-- ── walkover (atualizado para usar helpers) ───────────────────────────────────
create or replace function walkover(p_match uuid, p_winner uuid)
returns tournament_matches
language plpgsql
security definer
as $$
declare
  v_admin boolean;
  v_match tournament_matches%rowtype;
begin
  select exists(select 1 from users where id = auth.uid() and role = 'admin') into v_admin;
  if not v_admin then raise exception 'Acesso negado'; end if;

  select * into v_match from tournament_matches where id = p_match;
  if not found then raise exception 'Partida não encontrada'; end if;
  if v_match.participant_a_id <> p_winner and v_match.participant_b_id <> p_winner then
    raise exception 'Vencedor não está nesta partida';
  end if;

  return report_match_result(
    p_match,
    case when v_match.participant_a_id = p_winner then 1 else 0 end,
    case when v_match.participant_b_id = p_winner then 1 else 0 end
  );
end;
$$;

-- ── close_group_stage (implementação completa) ────────────────────────────────
create or replace function close_group_stage(p_tournament uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_admin    boolean;
  v_group_id text;
begin
  select exists(select 1 from users where id = auth.uid() and role = 'admin') into v_admin;
  if not v_admin then raise exception 'Acesso negado'; end if;

  -- Percorre cada grupo e tenta avançar para o mata-mata
  for v_group_id in
    select distinct group_id
    from tournament_group_slots
    where tournament_id = p_tournament
    order by group_id
  loop
    perform tournament_auto_advance_group(p_tournament, v_group_id);
  end loop;
end;
$$;

-- ── tournament_standings (view corrigida: position + join correto) ─────────────
create or replace view tournament_standings as
with stats as (
  select
    p.tournament_id,
    p.id                                                                                         as participant_id,
    p.group_id,
    coalesce(sum(case when m.winner_participant_id = p.id  then 3 else 0 end), 0)::int           as points,
    count(*) filter (where m.status='finished' and m.winner_participant_id = p.id)::int          as wins,
    count(*) filter (where m.status='finished'
                       and m.winner_participant_id is not null
                       and m.winner_participant_id <> p.id)::int                                 as losses,
    coalesce(sum(case when m.participant_a_id = p.id then m.score_a else m.score_b end)
             filter (where m.status='finished'), 0)::int                                         as sets_won,
    coalesce(sum(case when m.participant_a_id = p.id then m.score_b else m.score_a end)
             filter (where m.status='finished'), 0)::int                                         as sets_lost
  from tournament_participants p
  left join tournament_matches m
    on  m.tournament_id = p.tournament_id
    and (m.participant_a_id = p.id or m.participant_b_id = p.id)
    and m.bracket = 'group'
  where p.group_id is not null
  group by p.tournament_id, p.id, p.group_id
)
select
  tournament_id,
  participant_id,
  group_id,
  wins,
  losses,
  sets_won,
  sets_lost,
  points,
  row_number() over (
    partition by tournament_id, group_id
    order by points desc, (sets_won - sets_lost) desc, sets_won desc
  )::int as position
from stats;
