ALTER TYPE public.transaction_motivo
  ADD VALUE IF NOT EXISTS 'reversao_admin';

CREATE OR REPLACE FUNCTION public.current_win_streak_v1(
  p_user_id uuid,
  p_excluded_match_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_streak integer := 0;
  v_row record;
BEGIN
  FOR v_row IN
    SELECT m.vencedor_id
    FROM public.matches m
    WHERE m.status = 'validado'
      AND (m.player_a_id = p_user_id OR m.player_b_id = p_user_id)
      AND (p_excluded_match_id IS NULL OR m.id <> p_excluded_match_id)
    ORDER BY m.created_at DESC, m.id DESC
  LOOP
    IF v_row.vencedor_id = p_user_id THEN
      v_streak := v_streak + 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  RETURN v_streak;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_pending_match_v2(
  p_match_id uuid,
  p_actor_user_id uuid DEFAULT NULL,
  p_actor_name text DEFAULT NULL,
  p_actor_type text DEFAULT 'player'
)
RETURNS TABLE (
  match_id uuid,
  old_status match_status,
  player_a_id uuid,
  player_b_id uuid,
  winner_id uuid,
  loser_id uuid,
  player_a_name text,
  player_b_name text,
  score_label text,
  player_a_delta integer,
  player_b_delta integer,
  winner_rating_before integer,
  loser_rating_before integer,
  winner_rating_after integer,
  loser_rating_after integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.matches%ROWTYPE;
  v_player_a public.users%ROWTYPE;
  v_player_b public.users%ROWTYPE;
  v_waiting_user_id uuid;
  v_player_a_name text;
  v_player_b_name text;
  v_current_k_factor integer := 24;
  v_k_factor integer := 24;
  v_winner_rating integer;
  v_loser_rating integer;
  v_expected_winner numeric;
  v_expected_loser numeric;
  v_winner_delta integer;
  v_loser_delta integer;
  v_player_a_delta integer;
  v_player_b_delta integer;
  v_player_a_new_rating integer;
  v_player_b_new_rating integer;
  v_winner_id uuid;
  v_loser_id uuid;
  v_actor_display_name text;
  v_created_by uuid;
BEGIN
  IF p_actor_type NOT IN ('player', 'admin', 'system') THEN
    RAISE EXCEPTION 'invalid_actor_type';
  END IF;

  SELECT *
  INTO v_match
  FROM public.matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'match_not_found';
  END IF;

  IF v_match.status = 'validado' THEN
    RAISE EXCEPTION 'already_validated';
  END IF;

  IF v_match.status = 'cancelado' THEN
    RAISE EXCEPTION 'already_canceled';
  END IF;

  IF v_match.status NOT IN ('pendente', 'edited') THEN
    RAISE EXCEPTION 'match_not_pending';
  END IF;

  IF v_match.vencedor_id IS NULL THEN
    RAISE EXCEPTION 'missing_winner';
  END IF;

  IF v_match.vencedor_id <> v_match.player_a_id
     AND v_match.vencedor_id <> v_match.player_b_id THEN
    RAISE EXCEPTION 'invalid_winner';
  END IF;

  IF p_actor_type = 'player' THEN
    v_waiting_user_id := CASE
      WHEN v_match.criado_por = v_match.player_a_id THEN v_match.player_b_id
      WHEN v_match.criado_por = v_match.player_b_id THEN v_match.player_a_id
      ELSE NULL
    END;

    IF p_actor_user_id IS NULL
       OR v_waiting_user_id IS NULL
       OR p_actor_user_id <> v_waiting_user_id THEN
      RAISE EXCEPTION 'actor_not_waiting_user';
    END IF;
  END IF;

  IF v_match.player_a_id::text <= v_match.player_b_id::text THEN
    SELECT *
    INTO v_player_a
    FROM public.users
    WHERE id = v_match.player_a_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'player_a_not_found';
    END IF;

    SELECT *
    INTO v_player_b
    FROM public.users
    WHERE id = v_match.player_b_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'player_b_not_found';
    END IF;
  ELSE
    SELECT *
    INTO v_player_b
    FROM public.users
    WHERE id = v_match.player_b_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'player_b_not_found';
    END IF;

    SELECT *
    INTO v_player_a
    FROM public.users
    WHERE id = v_match.player_a_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'player_a_not_found';
    END IF;
  END IF;

  v_player_a_name := COALESCE(v_player_a.full_name, v_player_a.name, split_part(v_player_a.email, '@', 1), 'Jogador');
  v_player_b_name := COALESCE(v_player_b.full_name, v_player_b.name, split_part(v_player_b.email, '@', 1), 'Jogador');

  IF v_match.k_factor_used IS NOT NULL THEN
    v_k_factor := v_match.k_factor_used;

    IF v_k_factor < 1 OR v_k_factor > 100 THEN
      RAISE EXCEPTION 'invalid_stored_k_factor';
    END IF;
  ELSE
    SELECT
      CASE
        WHEN s.value ~ '^[0-9]+$' THEN s.value::integer
        ELSE 24
      END
    INTO v_current_k_factor
    FROM public.settings s
    WHERE s.key = 'k_factor'
    LIMIT 1;

    v_current_k_factor := COALESCE(v_current_k_factor, 24);

    IF v_current_k_factor < 1 OR v_current_k_factor > 100 THEN
      RAISE EXCEPTION 'invalid_k_factor';
    END IF;

    v_k_factor := v_current_k_factor;
  END IF;

  v_winner_id := v_match.vencedor_id;
  v_loser_id := CASE
    WHEN v_winner_id = v_match.player_a_id THEN v_match.player_b_id
    ELSE v_match.player_a_id
  END;

  v_winner_rating := CASE
    WHEN v_winner_id = v_match.player_a_id THEN COALESCE(v_player_a.rating_atual, 250)
    ELSE COALESCE(v_player_b.rating_atual, 250)
  END;
  v_loser_rating := CASE
    WHEN v_loser_id = v_match.player_a_id THEN COALESCE(v_player_a.rating_atual, 250)
    ELSE COALESCE(v_player_b.rating_atual, 250)
  END;

  v_expected_winner := 1 / (1 + power(10::numeric, (v_loser_rating - v_winner_rating) / 400.0));
  v_expected_loser := 1 / (1 + power(10::numeric, (v_winner_rating - v_loser_rating) / 400.0));
  v_winner_delta := round(v_k_factor * (1 - v_expected_winner))::integer;
  v_loser_delta := round(v_k_factor * (0 - v_expected_loser))::integer;

  v_player_a_delta := CASE
    WHEN v_winner_id = v_match.player_a_id THEN v_winner_delta
    ELSE v_loser_delta
  END;
  v_player_b_delta := CASE
    WHEN v_winner_id = v_match.player_b_id THEN v_winner_delta
    ELSE v_loser_delta
  END;

  v_player_a_new_rating := GREATEST(COALESCE(v_player_a.rating_atual, 250) + v_player_a_delta, 100);
  v_player_b_new_rating := GREATEST(COALESCE(v_player_b.rating_atual, 250) + v_player_b_delta, 100);

  UPDATE public.users
  SET
    rating_atual = v_player_a_new_rating,
    vitorias = COALESCE(vitorias, 0) + CASE WHEN v_winner_id = v_match.player_a_id THEN 1 ELSE 0 END,
    derrotas = COALESCE(derrotas, 0) + CASE WHEN v_loser_id = v_match.player_a_id THEN 1 ELSE 0 END,
    jogos_disputados = COALESCE(jogos_disputados, 0) + 1
  WHERE id = v_match.player_a_id;

  UPDATE public.users
  SET
    rating_atual = v_player_b_new_rating,
    vitorias = COALESCE(vitorias, 0) + CASE WHEN v_winner_id = v_match.player_b_id THEN 1 ELSE 0 END,
    derrotas = COALESCE(derrotas, 0) + CASE WHEN v_loser_id = v_match.player_b_id THEN 1 ELSE 0 END,
    jogos_disputados = COALESCE(jogos_disputados, 0) + 1
  WHERE id = v_match.player_b_id;

  INSERT INTO public.rating_transactions (
    match_id,
    user_id,
    motivo,
    valor,
    rating_antes,
    rating_depois
  )
  VALUES
    (
      p_match_id,
      v_winner_id,
      'vitoria',
      v_winner_delta,
      v_winner_rating,
      GREATEST(v_winner_rating + v_winner_delta, 100)
    ),
    (
      p_match_id,
      v_loser_id,
      'derrota',
      v_loser_delta,
      v_loser_rating,
      GREATEST(v_loser_rating + v_loser_delta, 100)
    );

  UPDATE public.matches
  SET
    status = 'validado',
    aprovado_por = CASE
      WHEN p_actor_type = 'system' THEN NULL
      ELSE p_actor_user_id
    END,
    pontos_variacao_a = v_player_a_delta,
    pontos_variacao_b = v_player_b_delta,
    rating_final_a = v_player_a_new_rating,
    rating_final_b = v_player_b_new_rating,
    k_factor_used = v_k_factor,
    updated_at = now()
  WHERE id = p_match_id
    AND status IN ('pendente', 'edited');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'match_already_processed';
  END IF;

  v_actor_display_name := CASE
    WHEN p_actor_type = 'system' THEN COALESCE(p_actor_name, 'Confirmação automática')
    WHEN p_actor_name IS NOT NULL AND btrim(p_actor_name) <> '' THEN p_actor_name
    WHEN p_actor_user_id = v_match.player_a_id THEN v_player_a_name
    WHEN p_actor_user_id = v_match.player_b_id THEN v_player_b_name
    ELSE 'Admin'
  END;

  v_created_by := COALESCE(v_match.criado_por, v_match.player_a_id);

  INSERT INTO public.notifications (user_id, tipo, payload, lida)
  VALUES
    (
      v_match.player_a_id,
      'confirmacao',
      jsonb_build_object(
        'event', 'pending_resolved',
        'match_id', p_match_id::text,
        'status', 'validado',
        'actor_id', COALESCE(p_actor_user_id::text, 'system'),
        'actor_name', v_actor_display_name,
        'created_by', v_created_by::text
      ),
      false
    ),
    (
      v_match.player_b_id,
      'confirmacao',
      jsonb_build_object(
        'event', 'pending_resolved',
        'match_id', p_match_id::text,
        'status', 'validado',
        'actor_id', COALESCE(p_actor_user_id::text, 'system'),
        'actor_name', v_actor_display_name,
        'created_by', v_created_by::text
      ),
      false
    );

  RETURN QUERY
  SELECT
    v_match.id,
    v_match.status,
    v_match.player_a_id,
    v_match.player_b_id,
    v_winner_id,
    v_loser_id,
    v_player_a_name,
    v_player_b_name,
    CONCAT(COALESCE(v_match.resultado_a, 0), 'x', COALESCE(v_match.resultado_b, 0)),
    v_player_a_delta,
    v_player_b_delta,
    v_winner_rating,
    v_loser_rating,
    GREATEST(v_winner_rating + v_winner_delta, 100),
    GREATEST(v_loser_rating + v_loser_delta, 100);
END;
$$;

REVOKE ALL ON FUNCTION public.validate_pending_match_v2(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_pending_match_v2(uuid, uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.cancel_match_v2(
  p_match_id uuid
)
RETURNS TABLE (
  match_id uuid,
  old_status match_status,
  player_a_id uuid,
  player_b_id uuid,
  created_by uuid,
  player_a_name text,
  player_b_name text,
  score_a integer,
  score_b integer,
  player_a_delta integer,
  player_b_delta integer,
  achievements_revoked integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.matches%ROWTYPE;
  v_player_a public.users%ROWTYPE;
  v_player_b public.users%ROWTYPE;
  v_player_a_name text;
  v_player_b_name text;
  v_has_newer_validated_match boolean := false;
  v_revoked_count integer := 0;
  v_player_a_delta integer;
  v_player_b_delta integer;
  v_player_a_new_rating integer;
  v_player_b_new_rating integer;
  v_player_a_rating_before integer;
  v_player_b_rating_before integer;
BEGIN
  SELECT *
  INTO v_match
  FROM public.matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'match_not_found';
  END IF;

  IF v_match.status = 'cancelado' THEN
    RAISE EXCEPTION 'already_canceled';
  END IF;

  SELECT *
  INTO v_player_a
  FROM public.users
  WHERE id = v_match.player_a_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'player_a_not_found';
  END IF;

  SELECT *
  INTO v_player_b
  FROM public.users
  WHERE id = v_match.player_b_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'player_b_not_found';
  END IF;

  v_player_a_name := COALESCE(v_player_a.full_name, v_player_a.name, split_part(v_player_a.email, '@', 1), 'Jogador');
  v_player_b_name := COALESCE(v_player_b.full_name, v_player_b.name, split_part(v_player_b.email, '@', 1), 'Jogador');
  v_player_a_delta := v_match.pontos_variacao_a;
  v_player_b_delta := v_match.pontos_variacao_b;

  IF v_match.status = 'validado' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.status = 'validado'
        AND m.id <> v_match.id
        AND (
          m.player_a_id IN (v_match.player_a_id, v_match.player_b_id)
          OR m.player_b_id IN (v_match.player_a_id, v_match.player_b_id)
        )
        AND (m.created_at, m.id) > (v_match.created_at, v_match.id)
      LIMIT 1
    )
    INTO v_has_newer_validated_match;

    IF v_has_newer_validated_match THEN
      RAISE EXCEPTION 'cannot_cancel_historical_validated_match';
    END IF;

    IF v_match.player_a_id::text <= v_match.player_b_id::text THEN
      SELECT *
      INTO v_player_a
      FROM public.users
      WHERE id = v_match.player_a_id
      FOR UPDATE;

      SELECT *
      INTO v_player_b
      FROM public.users
      WHERE id = v_match.player_b_id
      FOR UPDATE;
    ELSE
      SELECT *
      INTO v_player_b
      FROM public.users
      WHERE id = v_match.player_b_id
      FOR UPDATE;

      SELECT *
      INTO v_player_a
      FROM public.users
      WHERE id = v_match.player_a_id
      FOR UPDATE;
    END IF;

    IF v_player_a_delta IS NULL OR v_player_b_delta IS NULL THEN
      SELECT
        MAX(rt.valor) FILTER (WHERE rt.user_id = v_match.player_a_id),
        MAX(rt.valor) FILTER (WHERE rt.user_id = v_match.player_b_id)
      INTO
        v_player_a_delta,
        v_player_b_delta
      FROM public.rating_transactions rt
      WHERE rt.match_id = p_match_id
        AND rt.motivo IN ('vitoria', 'derrota');
    END IF;

    IF v_player_a_delta IS NULL OR v_player_b_delta IS NULL THEN
      RAISE EXCEPTION 'missing_rating_delta';
    END IF;

    v_player_a_rating_before := COALESCE(v_player_a.rating_atual, 250);
    v_player_b_rating_before := COALESCE(v_player_b.rating_atual, 250);
    v_player_a_new_rating := GREATEST(v_player_a_rating_before - v_player_a_delta, 100);
    v_player_b_new_rating := GREATEST(v_player_b_rating_before - v_player_b_delta, 100);

    UPDATE public.users
    SET
      rating_atual = v_player_a_new_rating,
      vitorias = GREATEST(0, COALESCE(vitorias, 0) - CASE WHEN v_match.vencedor_id = v_match.player_a_id THEN 1 ELSE 0 END),
      derrotas = GREATEST(0, COALESCE(derrotas, 0) - CASE WHEN v_match.vencedor_id = v_match.player_b_id THEN 1 ELSE 0 END),
      jogos_disputados = GREATEST(0, COALESCE(jogos_disputados, 0) - 1),
      streak = public.current_win_streak_v1(v_match.player_a_id, v_match.id)
    WHERE id = v_match.player_a_id;

    UPDATE public.users
    SET
      rating_atual = v_player_b_new_rating,
      vitorias = GREATEST(0, COALESCE(vitorias, 0) - CASE WHEN v_match.vencedor_id = v_match.player_b_id THEN 1 ELSE 0 END),
      derrotas = GREATEST(0, COALESCE(derrotas, 0) - CASE WHEN v_match.vencedor_id = v_match.player_a_id THEN 1 ELSE 0 END),
      jogos_disputados = GREATEST(0, COALESCE(jogos_disputados, 0) - 1),
      streak = public.current_win_streak_v1(v_match.player_b_id, v_match.id)
    WHERE id = v_match.player_b_id;

    INSERT INTO public.rating_transactions (
      match_id,
      user_id,
      motivo,
      valor,
      rating_antes,
      rating_depois
    )
    VALUES
      (
        p_match_id,
        v_match.player_a_id,
        'reversao_admin',
        -v_player_a_delta,
        v_player_a_rating_before,
        v_player_a_new_rating
      ),
      (
        p_match_id,
        v_match.player_b_id,
        'reversao_admin',
        -v_player_b_delta,
        v_player_b_rating_before,
        v_player_b_new_rating
      );
  END IF;

  DELETE FROM public.user_achievements
  WHERE match_id = p_match_id;

  GET DIAGNOSTICS v_revoked_count = ROW_COUNT;

  UPDATE public.daily_limits
  SET jogos_registrados = GREATEST(0, COALESCE(jogos_registrados, 0) - 1)
  WHERE data = v_match.data_partida
    AND (
      (user_id = v_match.player_a_id AND opponent_id = v_match.player_b_id)
      OR (user_id = v_match.player_b_id AND opponent_id = v_match.player_a_id)
    );

  UPDATE public.matches
  SET
    status = 'cancelado',
    updated_at = now()
  WHERE id = p_match_id
    AND status = v_match.status;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'match_already_processed';
  END IF;

  RETURN QUERY
  SELECT
    v_match.id,
    v_match.status,
    v_match.player_a_id,
    v_match.player_b_id,
    v_match.criado_por,
    v_player_a_name,
    v_player_b_name,
    COALESCE(v_match.resultado_a, 0),
    COALESCE(v_match.resultado_b, 0),
    v_player_a_delta,
    v_player_b_delta,
    v_revoked_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_match_v2(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_match_v2(uuid) TO service_role;
