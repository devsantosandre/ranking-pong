BEGIN;

-- get_head_to_head_stats_v2: igual à v1, mas com recorte opcional por temporada.
--   p_season_id IS NULL  → confronto direto geral (todas as temporadas), idêntico à v1
--   p_season_id = <uuid> → confronto direto apenas nas partidas daquela temporada
-- O índice idx_matches_validated_pair_created_at (par de jogadores) já cobre o filtro;
-- o recorte adicional por season_id incide sobre um conjunto já pequeno (partidas entre os dois).

DROP FUNCTION IF EXISTS public.get_head_to_head_stats_v2(uuid, uuid, uuid);

CREATE FUNCTION public.get_head_to_head_stats_v2(
  p_user_id uuid,
  p_opponent_id uuid,
  p_season_id uuid DEFAULT NULL
)
RETURNS TABLE (
  wins integer,
  losses integer,
  total integer,
  win_rate integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COUNT(*) FILTER (WHERE m.vencedor_id = p_user_id)::integer AS wins,
    COUNT(*) FILTER (WHERE m.vencedor_id = p_opponent_id)::integer AS losses,
    COUNT(*)::integer AS total,
    CASE
      WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND(
        (
          COUNT(*) FILTER (WHERE m.vencedor_id = p_user_id)::numeric
          * 100.0
        )
        / COUNT(*)::numeric
      )::integer
    END AS win_rate
  FROM public.matches m
  WHERE m.status = 'validado'
    AND LEAST(m.player_a_id, m.player_b_id) = LEAST(p_user_id, p_opponent_id)
    AND GREATEST(m.player_a_id, m.player_b_id) = GREATEST(p_user_id, p_opponent_id)
    AND (p_season_id IS NULL OR m.season_id = p_season_id);
$$;

REVOKE ALL ON FUNCTION public.get_head_to_head_stats_v2(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_head_to_head_stats_v2(uuid, uuid, uuid) TO authenticated;

-- Recarrega o cache de schema do PostgREST para expor a nova função imediatamente
NOTIFY pgrst, 'reload schema';

COMMIT;
