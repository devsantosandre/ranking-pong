-- Função RPC para buscar partidas da janela de analytics sem limite de linhas.
-- Funções que retornam JSON escalar não passam pelo filtro max-rows do PostgREST,
-- garantindo que todos os dados sejam retornados independentemente do volume.
CREATE OR REPLACE FUNCTION get_analytics_matches(
  p_trend_start TEXT,
  p_month_end   TEXT
)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    json_agg(t ORDER BY t.data_partida ASC, t.id ASC),
    '[]'::json
  )
  FROM (
    SELECT
      id,
      player_a_id,
      player_b_id,
      vencedor_id,
      status,
      created_at,
      updated_at,
      data_partida::text
    FROM matches
    WHERE data_partida >= p_trend_start::date
      AND data_partida <= p_month_end::date
  ) t;
$$;
