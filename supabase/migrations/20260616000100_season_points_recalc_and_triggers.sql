-- =============================================================================
-- Etapa 2 — Pontuacao da temporada (recalc) + triggers
-- =============================================================================
-- Abordagem: NAO altera nenhuma funcao do ELO. Em vez disso, dois triggers em
-- public.matches disparam sozinhos sempre que o status muda — cobrindo TODOS os
-- caminhos que ja existem (confirmacao manual, confirmacao automatica via SLA,
-- cancelamento seguro manual/automatico e correcao excepcional), porque todos
-- terminam em UPDATE matches SET status = ...
--
--   1. BEFORE UPDATE: ao virar 'validado', carimba season_id = temporada ativa.
--   2. AFTER UPDATE : ao mudar status, recalcula a classificacao da(s)
--      temporada(s) afetada(s) a partir do zero (idempotente).
--
-- Fonte unica da verdade: recalc_season_standings(season_id) conta apenas as
-- partidas 'validado' daquela temporada. Cancelou/corrigiu => reconstroi certo.
-- =============================================================================

-- 1. Recalc da classificacao de uma temporada ------------------------------

CREATE OR REPLACE FUNCTION public.recalc_season_standings(p_season_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_win_points integer;
  v_loss_points integer;
  v_zebra_bonus integer;
  v_zebra_enabled boolean;
BEGIN
  IF p_season_id IS NULL THEN
    RETURN;
  END IF;

  -- Parametros configuraveis (settings) com defaults seguros.
  SELECT
    COALESCE((SELECT s.value FROM public.settings s
              WHERE s.key = 'season_points_win'  AND s.value ~ '^-?[0-9]+$')::integer, 3),
    COALESCE((SELECT s.value FROM public.settings s
              WHERE s.key = 'season_points_loss' AND s.value ~ '^-?[0-9]+$')::integer, 1),
    COALESCE((SELECT s.value FROM public.settings s
              WHERE s.key = 'season_zebra_bonus' AND s.value ~ '^-?[0-9]+$')::integer, 2),
    COALESCE((SELECT lower(s.value) = 'true' FROM public.settings s
              WHERE s.key = 'season_zebra_enabled'), false)
  INTO v_win_points, v_loss_points, v_zebra_bonus, v_zebra_enabled;

  -- Reconstroi a classificacao do zero.
  DELETE FROM public.season_standings WHERE season_id = p_season_id;

  INSERT INTO public.season_standings (
    season_id, user_id, points, wins, losses, games, zebra_wins, win_rate, updated_at
  )
  SELECT
    p_season_id,
    pmp.user_id,
    SUM(CASE WHEN pmp.is_win THEN v_win_points ELSE v_loss_points END)
      + SUM(CASE WHEN pmp.is_zebra THEN v_zebra_bonus ELSE 0 END) AS points,
    SUM(CASE WHEN pmp.is_win THEN 1 ELSE 0 END) AS wins,
    SUM(CASE WHEN NOT pmp.is_win THEN 1 ELSE 0 END) AS losses,
    COUNT(*) AS games,
    SUM(CASE WHEN pmp.is_zebra THEN 1 ELSE 0 END) AS zebra_wins,
    ROUND(100.0 * SUM(CASE WHEN pmp.is_win THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS win_rate,
    now()
  FROM (
    SELECT
      p.user_id,
      (sm.vencedor_id = p.user_id) AS is_win,
      (
        sm.vencedor_id = p.user_id
        AND v_zebra_enabled
        AND COALESCE(w.rating_antes, 0) < COALESCE(l.rating_antes, 0)
      ) AS is_zebra
    FROM (
      SELECT m.id, m.player_a_id, m.player_b_id, m.vencedor_id
      FROM public.matches m
      WHERE m.season_id = p_season_id
        AND m.status = 'validado'
        AND m.vencedor_id IS NOT NULL
    ) sm
    CROSS JOIN LATERAL (VALUES
      (sm.player_a_id, sm.player_b_id),
      (sm.player_b_id, sm.player_a_id)
    ) AS p(user_id, opponent_id)
    -- rating Geral "antes" de cada lado no momento do jogo (para a zebra)
    LEFT JOIN public.rating_transactions w
      ON w.match_id = sm.id AND w.user_id = p.user_id
      AND w.motivo IN ('vitoria', 'derrota')
    LEFT JOIN public.rating_transactions l
      ON l.match_id = sm.id AND l.user_id = p.opponent_id
      AND l.motivo IN ('vitoria', 'derrota')
  ) pmp
  GROUP BY pmp.user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.recalc_season_standings(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalc_season_standings(uuid) TO service_role;

-- 2. Trigger BEFORE UPDATE: carimba a temporada ativa ao validar -------------

CREATE OR REPLACE FUNCTION public.tg_matches_stamp_season_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'validado'
     AND OLD.status IN ('pendente', 'edited')
     AND NEW.season_id IS NULL THEN
    SELECT s.id
    INTO NEW.season_id
    FROM public.seasons s
    WHERE s.status = 'active'
    ORDER BY s.starts_at DESC
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS matches_stamp_season ON public.matches;
CREATE TRIGGER matches_stamp_season
  BEFORE UPDATE OF status ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_matches_stamp_season_v1();

-- 3. Trigger AFTER UPDATE: recalcula a temporada afetada ---------------------

CREATE OR REPLACE FUNCTION public.tg_matches_recalc_season_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.season_id IS NOT NULL THEN
      PERFORM public.recalc_season_standings(NEW.season_id);
    END IF;
    IF OLD.season_id IS NOT NULL AND OLD.season_id IS DISTINCT FROM NEW.season_id THEN
      PERFORM public.recalc_season_standings(OLD.season_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS matches_recalc_season ON public.matches;
CREATE TRIGGER matches_recalc_season
  AFTER UPDATE OF status ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_matches_recalc_season_v1();
