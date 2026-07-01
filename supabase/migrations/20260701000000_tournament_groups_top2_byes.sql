-- ═══════════════════════════════════════════════════════════════════════════
-- Bloco A — Grupos (top 2 fixo) + Chaveamento ITTF 3.7 + Byes
-- ═══════════════════════════════════════════════════════════════════════════
-- Espelha a lógica TS testada (src/lib/tournaments/seeding.ts::seedQualifiersIntoBracket
-- + tests/helpers/mock-repo.ts::buildKnockoutSkeleton, cobertas por Vitest).
--
-- Muda SOMENTE a branch groups_knockout de `generate_bracket`:
--   • Top 2 fixos por grupo (CBTM), em vez de ceil(tamanho_do_grupo / 2).
--   • Remove a trava de "classificados = potência de 2".
--   • Monta o mata-mata de tamanho B = próxima potência de 2 de (2×grupos),
--     posicionando os classificados pela ITTF 3.7 (vencedor do grupo 1 no topo,
--     grupo 2 no fundo/metade oposta; 1º e 2º do mesmo grupo em metades opostas)
--     e distribuindo BYEs nos melhores seeds.
--   • `tournament_auto_advance_group` passa a avançar direto o classificado cujo
--     adversário de 1ª rodada é um BYE.
--
-- As demais branches (round_robin, king_of_table, single_elimination, 3º lugar)
-- são reproduzidas VERBATIM da migration 20260622000000_tournament_engine_v2.sql.
--
-- Idempotente (create or replace).
--
-- ✅ VALIDADA e APLICADA em HML (2026-07-01, PostgreSQL 15.8): compila; o helper
--    bate 100% com o ground truth do TS (g=4/6/8 + propriedades ITTF 3.7 g=3..8);
--    E2E de 20 jogadores/6 grupos → 24 jogos de grupo, 15 de KO, 12 slots, 4 byes;
--    auto-avanço por bye confirmado (4 byes finalizam e avançam).
-- 🐛 Correção de bug PRÉ-EXISTENTE: o skeleton do groups_knockout (herdado da
--    20260622) usava um limite de loop incompatível com a fórmula de id de
--    v_km_ids → chave duplicada. Qualquer geração grupos→KO no SQL quebrava.
--    Corrigido aqui (convenção round 1 = final, igual ao single_elimination/mock).
-- ⚠️ AINDA NÃO aplicada em PROD (regra: usuário aplica). Aplicar quando validado.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Helper: chaveamento ITTF 3.7 dos classificados + byes ─────────────────────
-- Para `p_g` grupos (top 2 cada → q = 2×g classificados), retorna, para cada
-- posição do bracket (0 = topo … B-1 = fundo), qual grupo/rank a ocupa.
-- grp_num = 0 marca uma posição de BYE. Espelha `seedQualifiersIntoBracket` (TS).
create or replace function tournament_seed_qualifiers_into_bracket(p_g int)
returns table(pos int, grp_num int, rnk int)
language plpgsql
immutable
as $$
declare
  v_q           int := p_g * 2;
  v_b           int;
  v_order       int[];
  v_seed_half   int[];      -- índice = seed → 0 (topo) / 1 (fundo)
  v_seed_group  int[];      -- índice = seed → grupo (1-indexed); 0 = vazio
  v_seed_rank   int[];      -- índice = seed → rank (0 = vencedor, 1 = 2º)
  v_runners_top int[] := '{}';
  v_runners_bot int[] := '{}';
  v_ti          int := 1;   -- ponteiro no pool do topo
  v_bi          int := 1;   -- ponteiro no pool do fundo
  v_seed        int;
  v_rseed       int;
  i             int;
  p             int;
begin
  -- B = próxima potência de 2 de q
  v_b := 1;
  while v_b < v_q loop v_b := v_b * 2; end loop;

  v_order := tournament_standard_order(v_b);  -- posição de bracket → seed

  -- Metade de cada seed dentro do bracket (0 = topo, 1 = fundo)
  v_seed_half := array_fill(0, array[v_b]);
  for p in 1..v_b loop
    v_seed := v_order[p];
    v_seed_half[v_seed] := case when p <= v_b / 2 then 0 else 1 end;
  end loop;

  v_seed_group := array_fill(0, array[v_q]);
  v_seed_rank  := array_fill(0, array[v_q]);

  -- Vencedores: grupo i (1-indexed) → seed i (cabeças de chave)
  for i in 1..p_g loop
    v_seed_group[i] := i;
    v_seed_rank[i]  := 0;
  end loop;

  -- Pools dos 2º colocados (seeds g+1 .. 2g), separados por metade
  for v_seed in (p_g + 1)..v_q loop
    if v_seed_half[v_seed] = 0 then
      v_runners_top := v_runners_top || v_seed;
    else
      v_runners_bot := v_runners_bot || v_seed;
    end if;
  end loop;

  -- Cada 2º colocado vai para a metade OPOSTA ao vencedor do seu grupo
  for i in 1..p_g loop
    if v_seed_half[i] = 0 then
      -- vencedor no topo → 2º colocado no fundo
      if v_bi <= coalesce(array_length(v_runners_bot, 1), 0) then
        v_rseed := v_runners_bot[v_bi]; v_bi := v_bi + 1;
      else
        v_rseed := v_runners_top[v_ti]; v_ti := v_ti + 1;
      end if;
    else
      -- vencedor no fundo → 2º colocado no topo
      if v_ti <= coalesce(array_length(v_runners_top, 1), 0) then
        v_rseed := v_runners_top[v_ti]; v_ti := v_ti + 1;
      else
        v_rseed := v_runners_bot[v_bi]; v_bi := v_bi + 1;
      end if;
    end if;
    v_seed_group[v_rseed] := i;
    v_seed_rank[v_rseed]  := 1;
  end loop;

  -- Emite uma linha por posição de bracket (0-indexed). Seeds > q = BYE.
  for p in 1..v_b loop
    v_seed := v_order[p];
    pos := p - 1;
    if v_seed <= v_q then
      grp_num := v_seed_group[v_seed];
      rnk     := v_seed_rank[v_seed];
    else
      grp_num := 0;  -- bye
      rnk     := 0;
    end if;
    return next;
  end loop;
end;
$$;

-- ── generate_bracket (só a branch groups_knockout muda) ───────────────────────
create or replace function generate_bracket(
  p_tournament uuid,
  p_method     seeding_method default 'standard'
)
returns setof tournament_matches
language plpgsql
security definer
as $$
declare
  v_t           tournaments%rowtype;
  v_parts       uuid[];
  v_n_actual    int;
  v_n           int;
  v_rounds      int;
  v_order       int[];
  v_ids         uuid[];
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
  v_km_ids      uuid[];
  v_km_rounds   int;
  v_km_total    int;
  -- seeded slots para grupos→knockout
  v_seed_groups text[];
  v_seed_ranks  int[];
  v_tier_groups text[];
  v_rev_groups  text[];
  ins_pos       int;
  k             int;
  v_qs          record;  -- linha do helper de chaveamento ITTF 3.7
begin
  -- ── Verificar admin (is_admin_caller cobre service_role — ver 20260623000100)
  if not is_admin_caller() then raise exception 'Acesso negado'; end if;

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
  -- GROUPS + KNOCKOUT — round-robin por grupo → mata-mata ITTF 3.7 + byes
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

    -- Top 2 fixos por grupo (CBTM). Classificados = 2 × nº de grupos.
    v_spots       := 2;
    v_total_class := v_group_count * v_spots;

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

    -- ── Skeleton do mata-mata (B = próxima potência de 2 de 2×grupos) ───────
    v_n := 1;
    while v_n < v_total_class loop v_n := v_n * 2; end loop;   -- B
    v_km_rounds := cast(log(2, v_n) as int);
    v_km_total  := v_n - 1;                                    -- 2^rounds - 1

    v_km_ids := '{}';
    for i in 1..v_km_total loop
      v_km_ids := v_km_ids || gen_random_uuid();
    end loop;
    -- Índice: match (round=r, slot=s) → v_km_ids[ 2^(r-1) + s ]  (1-indexed)

    -- Convenção (igual ao single_elimination e ao mock TS): round 1 = final,
    -- round v_km_rounds = 1ª rodada (mais jogos). A rodada r tem 2^(r-1) jogos e
    -- ocupa os IDs v_km_ids[2^(r-1) .. 2^r - 1] — bijeção sem colisão.
    for r in 1..v_km_rounds loop
      for i in 0..( (2^(r-1))::int - 1 ) loop
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

    -- ── Chaveamento ITTF 3.7 + byes: preenche tournament_group_slots ────────
    -- Primeira rodada: match (round=v_km_rounds, slot=idx) = v_km_ids[ 2^(km_rounds-1) + idx ].
    -- O helper diz, por posição de bracket (0-indexed), qual grupo/rank a ocupa
    -- (grp_num = 0 → BYE, sem slot). Posições 2*idx e 2*idx+1 formam o jogo idx.
    for v_qs in
      select pos, grp_num, rnk from tournament_seed_qualifiers_into_bracket(v_group_count)
    loop
      if v_qs.grp_num = 0 then
        continue;  -- bye: nenhuma entrada de slot
      end if;
      declare
        v_match_idx int  := v_qs.pos / 2;
        v_mid       uuid := v_km_ids[ (2^(v_km_rounds - 1))::int + v_match_idx ];
        v_mslot     int  := v_qs.pos % 2;         -- 0 = lado A, 1 = lado B
        v_grp       text := v_group_ids[ v_qs.grp_num ];
      begin
        insert into tournament_group_slots (tournament_id, group_id, rank, match_id, match_slot)
        values (p_tournament, v_grp, v_qs.rnk, v_mid, v_mslot)
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
        case when i = 1 then v_parts[1] else null end,
        v_parts[i + 1],
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
  -- SINGLE ELIMINATION (padrão)
  -- Seeding espelhado: seed 1 vs N/2+1, seed 2 vs N/2+2, etc. (evita top vs top)
  -- BYEs distribuídos pelos seeds mais altos — nunca dois BYEs no mesmo jogo.
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  v_n := 1;
  while v_n < v_n_actual loop v_n := v_n * 2; end loop;
  v_rounds := cast(log(2, v_n) as int);
  v_total  := v_n - 1;

  v_ids := '{}';
  for i in 1..v_total loop
    v_ids := v_ids || gen_random_uuid();
  end loop;

  v_order := tournament_standard_order(v_n);

  for r in 1..v_rounds loop
    for i in 0..( (2^(r-1))::int - 1 ) loop
      if r > 1 then
        v_next_id   := v_ids[ (2^(r-2))::int + i/2 ];
        v_next_slot := i % 2;
      else
        v_next_id   := null;
        v_next_slot := null;
      end if;

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

      if v_is_bye and v_winner is not null and v_next_id is not null then
        update tournament_matches
          set participant_a_id = case when v_next_slot = 0 then v_winner else participant_a_id end,
              participant_b_id = case when v_next_slot = 1 then v_winner else participant_b_id end
          where id = v_next_id;
        update tournament_matches set status = 'scheduled'
          where id = v_next_id
            and participant_a_id is not null
            and participant_b_id is not null
            and status = 'pending';
      end if;
    end loop;
  end loop;

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

-- ── tournament_auto_advance_group (base DEPLOYADA 20260622 + auto-avanço por BYE)
-- Reproduz a versão realmente deployada no HML (usa tournament_group_standings)
-- e acrescenta o auto-avanço por BYE ao final. (A versão de 000300, com FILTER
-- dentro do sum(), tem sintaxe inválida e nunca foi aplicada.)
create or replace function tournament_auto_advance_group(p_tournament uuid, p_group_id text)
returns void
language plpgsql
as $$
declare
  v_pending int;
  v_slot    record;
  v_winner  uuid;
  v_bye     record;
  v_match   tournament_matches%rowtype;
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

  -- Auto-avanço por BYE: jogos de 1ª rodada com um único slot (adversário
  -- inexistente) — o classificado avança direto para a rodada seguinte.
  for v_bye in
    select tgs.match_id
    from tournament_group_slots tgs
    where tgs.tournament_id = p_tournament and tgs.group_id = p_group_id
      and (select count(*) from tournament_group_slots x
           where x.tournament_id = p_tournament and x.match_id = tgs.match_id) = 1
  loop
    select * into v_match from tournament_matches where id = v_bye.match_id;
    if not found then continue; end if;
    if v_match.winner_participant_id is not null then continue; end if;

    v_winner := coalesce(v_match.participant_a_id, v_match.participant_b_id);
    if v_winner is null then continue; end if;

    update tournament_matches
      set winner_participant_id = v_winner, status = 'finished', finished_at = now()
      where id = v_match.id;

    if v_match.next_match_id is not null then
      if v_match.next_match_slot = 0 then
        update tournament_matches set participant_a_id = v_winner where id = v_match.next_match_id;
      else
        update tournament_matches set participant_b_id = v_winner where id = v_match.next_match_id;
      end if;
      update tournament_matches set status = 'scheduled'
        where id = v_match.next_match_id
          and participant_a_id is not null
          and participant_b_id is not null
          and status = 'pending';
    end if;
  end loop;
end;
$$;

-- Recarrega o cache de schema do PostgREST (RPCs novas/alteradas)
notify pgrst, 'reload schema';
