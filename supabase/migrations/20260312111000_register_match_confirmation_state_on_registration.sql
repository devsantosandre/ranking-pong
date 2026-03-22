BEGIN;

CREATE OR REPLACE FUNCTION public.register_match_with_notification_v1(
  p_player_id uuid,
  p_opponent_id uuid,
  p_resultado_a integer,
  p_resultado_b integer,
  p_request_id uuid,
  p_timezone text DEFAULT 'America/Sao_Paulo'
)
RETURNS TABLE (
  match_id uuid,
  opponent_id uuid,
  actor_name text,
  was_inserted boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_actor_id uuid;
  v_limite integer := 2;
  v_k_factor integer := 24;
  v_pending_deadline_hours integer := 6;
  v_today date;
  v_pair_low text;
  v_pair_high text;
  v_lock_key text;
  v_lock_hash bigint;
  v_current_games integer := 0;
  v_next_games integer := 0;
  v_vencedor_id uuid;
  v_match_id uuid;
  v_match_created_at timestamptz;
  v_existing_opponent_id uuid;
  v_actor_name text;
BEGIN
  v_actor_id := auth.uid();

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_player_id IS NULL OR p_opponent_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;

  IF v_actor_id <> p_player_id THEN
    RAISE EXCEPTION 'actor_mismatch';
  END IF;

  IF p_player_id = p_opponent_id THEN
    RAISE EXCEPTION 'same_player';
  END IF;

  IF p_resultado_a IS NULL OR p_resultado_b IS NULL THEN
    RAISE EXCEPTION 'invalid_score';
  END IF;

  IF p_resultado_a < 0 OR p_resultado_b < 0 OR p_resultado_a > 99 OR p_resultado_b > 99 THEN
    RAISE EXCEPTION 'invalid_score';
  END IF;

  IF p_resultado_a = p_resultado_b THEN
    RAISE EXCEPTION 'invalid_score';
  END IF;

  SELECT m.id, m.player_b_id
    INTO v_match_id
       , v_existing_opponent_id
  FROM public.matches m
  WHERE m.player_a_id = p_player_id
    AND m.request_id = p_request_id
  LIMIT 1;

  IF v_match_id IS NOT NULL THEN
    SELECT COALESCE(u.full_name, u.name, split_part(u.email, '@', 1))
      INTO v_actor_name
    FROM public.users u
    WHERE u.id = p_player_id;

    RETURN QUERY SELECT v_match_id, v_existing_opponent_id, v_actor_name, false;
    RETURN;
  END IF;

  BEGIN
    v_today := (
      timezone(COALESCE(NULLIF(trim(p_timezone), ''), 'America/Sao_Paulo'), now())
    )::date;
  EXCEPTION
    WHEN OTHERS THEN
      v_today := (timezone('America/Sao_Paulo', now()))::date;
  END;

  SELECT
    CASE
      WHEN s.value ~ '^[0-9]+$' THEN s.value::integer
      ELSE 2
    END
  INTO v_limite
  FROM public.settings s
  WHERE s.key = 'limite_jogos_diarios'
  LIMIT 1;

  v_limite := GREATEST(COALESCE(v_limite, 2), 1);

  SELECT
    CASE
      WHEN s.value ~ '^[0-9]+$' THEN s.value::integer
      ELSE 24
    END
  INTO v_k_factor
  FROM public.settings s
  WHERE s.key = 'k_factor'
  LIMIT 1;

  v_k_factor := COALESCE(v_k_factor, 24);

  IF v_k_factor < 1 OR v_k_factor > 100 THEN
    RAISE EXCEPTION 'invalid_k_factor';
  END IF;

  SELECT
    CASE
      WHEN s.value ~ '^[0-9]+$' THEN s.value::integer
      ELSE 6
    END
  INTO v_pending_deadline_hours
  FROM public.settings s
  WHERE s.key = 'pending_confirmation_deadline_hours'
  LIMIT 1;

  v_pending_deadline_hours := LEAST(GREATEST(COALESCE(v_pending_deadline_hours, 6), 1), 168);

  v_pair_low := LEAST(p_player_id::text, p_opponent_id::text);
  v_pair_high := GREATEST(p_player_id::text, p_opponent_id::text);
  v_lock_key := v_pair_low || '|' || v_pair_high || '|' || v_today::text;
  v_lock_hash := hashtextextended(v_lock_key, 0);

  PERFORM pg_advisory_xact_lock(v_lock_hash);

  SELECT m.id, m.player_b_id
    INTO v_match_id
       , v_existing_opponent_id
  FROM public.matches m
  WHERE m.player_a_id = p_player_id
    AND m.request_id = p_request_id
  LIMIT 1;

  IF v_match_id IS NOT NULL THEN
    SELECT COALESCE(u.full_name, u.name, split_part(u.email, '@', 1))
      INTO v_actor_name
    FROM public.users u
    WHERE u.id = p_player_id;

    RETURN QUERY SELECT v_match_id, v_existing_opponent_id, v_actor_name, false;
    RETURN;
  END IF;

  SELECT COALESCE(MAX(dl.jogos_registrados), 0)
    INTO v_current_games
  FROM public.daily_limits dl
  WHERE dl.data = v_today
    AND (
      (dl.user_id = p_player_id AND dl.opponent_id = p_opponent_id)
      OR (dl.user_id = p_opponent_id AND dl.opponent_id = p_player_id)
    );

  IF v_current_games >= v_limite THEN
    RAISE EXCEPTION 'daily_limit_reached';
  END IF;

  v_next_games := v_current_games + 1;
  v_vencedor_id := CASE
    WHEN p_resultado_a > p_resultado_b THEN p_player_id
    ELSE p_opponent_id
  END;

  INSERT INTO public.matches (
    player_a_id,
    player_b_id,
    vencedor_id,
    resultado_a,
    resultado_b,
    k_factor_used,
    status,
    criado_por,
    tipo_resultado,
    request_id
  )
  VALUES (
    p_player_id,
    p_opponent_id,
    v_vencedor_id,
    p_resultado_a,
    p_resultado_b,
    v_k_factor,
    'pendente',
    p_player_id,
    CASE
      WHEN p_resultado_a > p_resultado_b THEN 'win'::public.resultado_tipo
      ELSE 'loss'::public.resultado_tipo
    END,
    p_request_id
  )
  RETURNING id, created_at INTO v_match_id, v_match_created_at;

  INSERT INTO public.match_confirmation_state (
    match_id,
    responsible_user_id,
    initial_deadline_at,
    current_deadline_at
  )
  VALUES (
    v_match_id,
    p_opponent_id,
    v_match_created_at + make_interval(hours => v_pending_deadline_hours),
    v_match_created_at + make_interval(hours => v_pending_deadline_hours)
  )
  ON CONFLICT (match_id) DO NOTHING;

  INSERT INTO public.daily_limits (user_id, opponent_id, data, jogos_registrados)
  VALUES
    (p_player_id, p_opponent_id, v_today, v_next_games),
    (p_opponent_id, p_player_id, v_today, v_next_games)
  ON CONFLICT ON CONSTRAINT daily_limits_user_id_opponent_id_data_key
  DO UPDATE SET jogos_registrados = EXCLUDED.jogos_registrados;

  SELECT COALESCE(u.full_name, u.name, split_part(u.email, '@', 1))
    INTO v_actor_name
  FROM public.users u
  WHERE u.id = p_player_id;

  INSERT INTO public.notifications (user_id, tipo, payload, lida)
  VALUES (
    p_opponent_id,
    'confirmacao',
    jsonb_build_object(
      'event', 'pending_created',
      'match_id', v_match_id::text,
      'status', 'pendente',
      'actor_id', p_player_id::text,
      'actor_name', v_actor_name,
      'created_by', p_player_id::text
    ),
    false
  );

  RETURN QUERY SELECT v_match_id, p_opponent_id, v_actor_name, true;
END;
$$;

COMMENT ON COLUMN public.matches.k_factor_used IS 'K factor do ELO congelado no momento do registro da partida';

COMMIT;
