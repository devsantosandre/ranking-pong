BEGIN;

-- get_player_season_matches_v1: partidas validadas de um jogador numa temporada,
-- com pontos de temporada por jogo calculados server-side usando a MESMA regra de
-- recalc_season_standings (migration 20260616000100). Manter as duas em sincronia.
--
--   p_player_id → jogador cujas partidas serão listadas
--   p_season_id → temporada a filtrar
--   p_limit     → tamanho da página (default 20)
--   p_offset    → offset para paginação (default 0)
--
-- Colunas retornadas: campos da partida + nomes dos dois lados (join users) +
--   season_points_player (pontos de p_player_id naquele jogo) +
--   total_count (window, para calcular nextPage no cliente)
--
-- Índice reutilizado: matches_season_id_idx (season_id) + filtro por player_id.

DROP FUNCTION IF EXISTS public.get_player_season_matches_v1(uuid, uuid, integer, integer);

CREATE FUNCTION public.get_player_season_matches_v1(
  p_player_id uuid,
  p_season_id uuid,
  p_limit     integer DEFAULT 20,
  p_offset    integer DEFAULT 0
)
RETURNS TABLE (
  id                   uuid,
  player_a_id          uuid,
  player_b_id          uuid,
  vencedor_id          uuid,
  resultado_a          integer,
  resultado_b          integer,
  created_at           timestamptz,
  pa_id                uuid,
  pa_name              text,
  pa_full_name         text,
  pa_email             text,
  pb_id                uuid,
  pb_name              text,
  pb_full_name         text,
  pb_email             text,
  season_points_player integer,
  total_count          bigint
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_win_points    integer;
  v_loss_points   integer;
  v_zebra_bonus   integer;
  v_zebra_enabled boolean;
BEGIN
  -- Mesmos parâmetros que recalc_season_standings — manter em sincronia.
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

  RETURN QUERY
  SELECT
    m.id,
    m.player_a_id,
    m.player_b_id,
    m.vencedor_id,
    m.resultado_a,
    m.resultado_b,
    m.created_at,
    ua.id        AS pa_id,
    ua.name      AS pa_name,
    ua.full_name AS pa_full_name,
    ua.email     AS pa_email,
    ub.id        AS pb_id,
    ub.name      AS pb_name,
    ub.full_name AS pb_full_name,
    ub.email     AS pb_email,
    CASE
      WHEN m.vencedor_id = p_player_id THEN
        v_win_points
        + CASE
            WHEN v_zebra_enabled
                 AND COALESCE(rt_self.rating_antes, 0) < COALESCE(rt_opp.rating_antes, 0)
            THEN v_zebra_bonus
            ELSE 0
          END
      ELSE v_loss_points
    END::integer AS season_points_player,
    COUNT(*) OVER ()::bigint AS total_count
  FROM public.matches m
  LEFT JOIN public.users ua ON ua.id = m.player_a_id
  LEFT JOIN public.users ub ON ub.id = m.player_b_id
  -- rating_antes de p_player_id neste jogo (para o cálculo da zebra)
  LEFT JOIN public.rating_transactions rt_self
    ON rt_self.match_id = m.id
    AND rt_self.user_id = p_player_id
    AND rt_self.motivo IN ('vitoria', 'derrota')
  -- rating_antes do adversário de p_player_id neste jogo
  LEFT JOIN public.rating_transactions rt_opp
    ON rt_opp.match_id = m.id
    AND rt_opp.user_id IN (m.player_a_id, m.player_b_id)
    AND rt_opp.user_id <> p_player_id
    AND rt_opp.motivo IN ('vitoria', 'derrota')
  WHERE m.season_id = p_season_id
    AND m.status = 'validado'
    AND (m.player_a_id = p_player_id OR m.player_b_id = p_player_id)
    AND m.vencedor_id IS NOT NULL
  ORDER BY m.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.get_player_season_matches_v1(uuid, uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_player_season_matches_v1(uuid, uuid, integer, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
