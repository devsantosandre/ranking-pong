BEGIN;

CREATE INDEX IF NOT EXISTS idx_matches_validated_player_a_created_at
  ON public.matches (player_a_id, created_at DESC)
  WHERE status = 'validado';

CREATE INDEX IF NOT EXISTS idx_matches_validated_player_b_created_at
  ON public.matches (player_b_id, created_at DESC)
  WHERE status = 'validado';

CREATE INDEX IF NOT EXISTS idx_matches_validated_pair_created_at
  ON public.matches (
    LEAST(player_a_id, player_b_id),
    GREATEST(player_a_id, player_b_id),
    created_at DESC
  )
  WHERE status = 'validado';

DROP FUNCTION IF EXISTS public.get_head_to_head_stats_v1(uuid, uuid);

CREATE FUNCTION public.get_head_to_head_stats_v1(
  p_user_id uuid,
  p_opponent_id uuid
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
    AND GREATEST(m.player_a_id, m.player_b_id) = GREATEST(p_user_id, p_opponent_id);
$$;

REVOKE ALL ON FUNCTION public.get_head_to_head_stats_v1(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_head_to_head_stats_v1(uuid, uuid) TO authenticated;

COMMIT;
