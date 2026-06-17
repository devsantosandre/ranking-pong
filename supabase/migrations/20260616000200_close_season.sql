-- =============================================================================
-- Etapa 4 — Encerramento de temporada
-- =============================================================================
-- 1. Adiciona 'temporada' ao enum news_tipo.
-- 2. Cria close_season(p_season_id, p_actor_id) que:
--    - Recalcula e congela standings (idempotente)
--    - Define campeão (position = 1)
--    - Concede conquista season_champion
--    - Insere notícia e notificações in-app
--    - Retorna jsonb com dados do campeão (push feito no TypeScript)
--
-- Nota: ALTER TYPE ADD VALUE + CREATE FUNCTION no mesmo bloco é seguro porque
-- o corpo PL/pgSQL é armazenado como texto; a resolução do enum ocorre na
-- execução, não na criação da função.
-- =============================================================================

-- 1. Enum ─────────────────────────────────────────────────────────────────────

ALTER TYPE public.news_tipo ADD VALUE IF NOT EXISTS 'temporada';

-- 2. Função close_season ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.close_season(
  p_season_id uuid,
  p_actor_id  uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season       record;
  v_champion_id  uuid;
  v_champion_name text;
  v_news_slug    text;
BEGIN
  -- Bloquear a temporada para evitar fechamentos concorrentes
  SELECT * INTO v_season
  FROM public.seasons
  WHERE id = p_season_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'season_not_found');
  END IF;

  -- Idempotente: já encerrada → retornar sem duplicar efeitos
  IF v_season.status = 'closed' THEN
    RETURN jsonb_build_object(
      'ok',               true,
      'already_closed',   true,
      'champion_user_id', v_season.champion_user_id
    );
  END IF;

  -- Recalcular standings (garante dados frescos antes de congelar)
  PERFORM public.recalc_season_standings(p_season_id);

  -- Congelar posições usando desempate canônico
  WITH ranked AS (
    SELECT user_id,
           ROW_NUMBER() OVER (
             ORDER BY points DESC, win_rate DESC, wins DESC, games DESC
           ) AS pos
    FROM public.season_standings
    WHERE season_id = p_season_id
  )
  UPDATE public.season_standings ss
  SET    position = ranked.pos
  FROM   ranked
  WHERE  ss.season_id = p_season_id
    AND  ss.user_id   = ranked.user_id;

  -- Determinar campeão (posição 1)
  SELECT user_id INTO v_champion_id
  FROM   public.season_standings
  WHERE  season_id = p_season_id
    AND  position  = 1
  LIMIT  1;

  IF v_champion_id IS NOT NULL THEN
    SELECT COALESCE(full_name, name, split_part(email, '@', 1))
    INTO   v_champion_name
    FROM   public.users
    WHERE  id = v_champion_id;
  END IF;

  -- Fechar a temporada
  UPDATE public.seasons SET
    status           = 'closed',
    champion_user_id = v_champion_id,
    closed_at        = now(),
    updated_at       = now()
  WHERE id = p_season_id;

  -- Conceder conquista ao campeão (sem duplicar se já tiver)
  IF v_champion_id IS NOT NULL THEN
    INSERT INTO public.user_achievements (user_id, achievement_id)
    SELECT v_champion_id, a.id
    FROM   public.achievements a
    WHERE  a.key = 'season_champion'
    ON CONFLICT (user_id, achievement_id) DO NOTHING;
  END IF;

  -- Notícia de encerramento
  v_news_slug := 'campeao-' || COALESCE(v_season.slug, p_season_id::text);

  INSERT INTO public.news_posts (title, slug, resumo, tipo, published_at)
  VALUES (
    'Campeão da ' || v_season.name || ': ' || COALESCE(v_champion_name, 'nenhum jogador'),
    v_news_slug,
    COALESCE(v_champion_name, 'Nenhum jogador') || ' venceu a ' || v_season.name || '!',
    'temporada',
    now()
  )
  ON CONFLICT (slug) DO NOTHING;

  -- Notificações in-app para todos os participantes da temporada
  INSERT INTO public.notifications (user_id, tipo, payload, lida)
  SELECT
    ss.user_id,
    'news',
    jsonb_build_object(
      'event',         'season_closed',
      'season_id',     p_season_id,
      'season_name',   v_season.name,
      'champion_id',   v_champion_id,
      'champion_name', v_champion_name
    ),
    false
  FROM public.season_standings ss
  WHERE ss.season_id = p_season_id;

  RETURN jsonb_build_object(
    'ok',               true,
    'already_closed',   false,
    'champion_user_id', v_champion_id,
    'champion_name',    v_champion_name,
    'season_name',      v_season.name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.close_season(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.close_season(uuid, uuid) TO service_role;
