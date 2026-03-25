ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS correction_kind text,
  ADD COLUMN IF NOT EXISTS correction_reason text,
  ADD COLUMN IF NOT EXISTS correction_applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS correction_applied_by uuid,
  ADD COLUMN IF NOT EXISTS correction_compensation_a integer,
  ADD COLUMN IF NOT EXISTS correction_compensation_b integer,
  ADD COLUMN IF NOT EXISTS correction_impacted_match_count integer,
  ADD COLUMN IF NOT EXISTS correction_impacted_player_count integer;

ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_correction_kind_check;

ALTER TABLE public.matches
  ADD CONSTRAINT matches_correction_kind_check
  CHECK (
    correction_kind IS NULL
    OR correction_kind IN ('without_recalculation')
  );

ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_correction_applied_by_fkey;

ALTER TABLE public.matches
  ADD CONSTRAINT matches_correction_applied_by_fkey
  FOREIGN KEY (correction_applied_by)
  REFERENCES public.users(id)
  ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.apply_exceptional_match_correction_v1(
  p_match_id uuid,
  p_admin_id uuid,
  p_reason text,
  p_impacted_match_count integer DEFAULT NULL,
  p_impacted_player_count integer DEFAULT NULL
)
RETURNS TABLE(
  match_id uuid,
  old_status public.match_status,
  correction_kind text,
  player_a_id uuid,
  player_b_id uuid,
  player_a_name text,
  player_b_name text,
  score_a integer,
  score_b integer,
  compensation_a integer,
  compensation_b integer,
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
  v_player_a_rating_before integer;
  v_player_b_rating_before integer;
  v_player_a_rating_after integer;
  v_player_b_rating_after integer;
  v_player_a_wins_after integer;
  v_player_b_wins_after integer;
  v_player_a_losses_after integer;
  v_player_b_losses_after integer;
  v_player_a_games_after integer;
  v_player_b_games_after integer;
  v_player_a_compensation integer;
  v_player_b_compensation integer;
  v_revoked_count integer := 0;
BEGIN
  IF p_match_id IS NULL THEN
    RAISE EXCEPTION 'match_not_found';
  END IF;

  IF p_admin_id IS NULL THEN
    RAISE EXCEPTION 'admin_not_found';
  END IF;

  IF p_reason IS NULL OR char_length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'correction_reason_too_short';
  END IF;

  SELECT *
  INTO v_match
  FROM public.matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'match_not_found';
  END IF;

  IF v_match.status <> 'validado' THEN
    RAISE EXCEPTION 'match_not_validated';
  END IF;

  IF v_match.correction_kind IS NOT NULL THEN
    RAISE EXCEPTION 'match_already_corrected';
  END IF;

  IF v_match.pontos_variacao_a IS NULL OR v_match.pontos_variacao_b IS NULL THEN
    RAISE EXCEPTION 'missing_rating_delta';
  END IF;

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

  v_player_a_name := COALESCE(v_player_a.full_name, v_player_a.name, 'Jogador A');
  v_player_b_name := COALESCE(v_player_b.full_name, v_player_b.name, 'Jogador B');

  v_player_a_compensation := -COALESCE(v_match.pontos_variacao_a, 0);
  v_player_b_compensation := -COALESCE(v_match.pontos_variacao_b, 0);

  v_player_a_rating_before := COALESCE(v_player_a.rating_atual, 250);
  v_player_b_rating_before := COALESCE(v_player_b.rating_atual, 250);
  v_player_a_rating_after := v_player_a_rating_before + v_player_a_compensation;
  v_player_b_rating_after := v_player_b_rating_before + v_player_b_compensation;

  v_player_a_wins_after := GREATEST(
    0,
    COALESCE(v_player_a.vitorias, 0) - CASE WHEN v_match.vencedor_id = v_match.player_a_id THEN 1 ELSE 0 END
  );
  v_player_b_wins_after := GREATEST(
    0,
    COALESCE(v_player_b.vitorias, 0) - CASE WHEN v_match.vencedor_id = v_match.player_b_id THEN 1 ELSE 0 END
  );
  v_player_a_losses_after := GREATEST(
    0,
    COALESCE(v_player_a.derrotas, 0) - CASE WHEN v_match.vencedor_id = v_match.player_b_id THEN 1 ELSE 0 END
  );
  v_player_b_losses_after := GREATEST(
    0,
    COALESCE(v_player_b.derrotas, 0) - CASE WHEN v_match.vencedor_id = v_match.player_a_id THEN 1 ELSE 0 END
  );
  v_player_a_games_after := GREATEST(0, COALESCE(v_player_a.jogos_disputados, 0) - 1);
  v_player_b_games_after := GREATEST(0, COALESCE(v_player_b.jogos_disputados, 0) - 1);

  UPDATE public.users
  SET
    rating_atual = v_player_a_rating_after,
    vitorias = v_player_a_wins_after,
    derrotas = v_player_a_losses_after,
    jogos_disputados = v_player_a_games_after
  WHERE id = v_match.player_a_id;

  UPDATE public.users
  SET
    rating_atual = v_player_b_rating_after,
    vitorias = v_player_b_wins_after,
    derrotas = v_player_b_losses_after,
    jogos_disputados = v_player_b_games_after
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
      v_player_a_compensation,
      v_player_a_rating_before,
      v_player_a_rating_after
    ),
    (
      p_match_id,
      v_match.player_b_id,
      'reversao_admin',
      v_player_b_compensation,
      v_player_b_rating_before,
      v_player_b_rating_after
    );

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
    correction_kind = 'without_recalculation',
    correction_reason = trim(p_reason),
    correction_applied_at = now(),
    correction_applied_by = p_admin_id,
    correction_compensation_a = v_player_a_compensation,
    correction_compensation_b = v_player_b_compensation,
    correction_impacted_match_count = p_impacted_match_count,
    correction_impacted_player_count = p_impacted_player_count,
    updated_at = now()
  WHERE id = p_match_id
    AND status = 'validado'
    AND correction_kind IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'match_already_processed';
  END IF;

  UPDATE public.users
  SET streak = public.current_win_streak_v1(v_match.player_a_id)
  WHERE id = v_match.player_a_id;

  UPDATE public.users
  SET streak = public.current_win_streak_v1(v_match.player_b_id)
  WHERE id = v_match.player_b_id;

  RETURN QUERY
  SELECT
    v_match.id,
    v_match.status,
    'without_recalculation'::text,
    v_match.player_a_id,
    v_match.player_b_id,
    v_player_a_name,
    v_player_b_name,
    COALESCE(v_match.resultado_a, 0),
    COALESCE(v_match.resultado_b, 0),
    v_player_a_compensation,
    v_player_b_compensation,
    v_revoked_count;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_exceptional_match_correction_v1(uuid, uuid, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_exceptional_match_correction_v1(uuid, uuid, text, integer, integer) TO service_role;
