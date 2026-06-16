-- =============================================================================
-- Sistema de Temporadas (ranking por periodo)
-- =============================================================================
-- Ranking duplo:
--   - "Geral"     = ELO vitalicio existente (users.rating_atual), intocado.
--   - "Temporada" = pontos por periodo, zeram a cada temporada (esta migration).
--
-- Pontuacao da temporada (configuravel em settings):
--   - vitoria: +season_points_win  (default 3)
--   - derrota: +season_points_loss (default 1, nunca negativo)
--   - bonus de zebra (opcional, desligado por padrao): vencer alguem acima de
--     voce no ranking Geral soma +season_zebra_bonus.
--
-- Encerramento: automatico "preguicoso" (sem cron) — verificado ao abrir o
-- ranking / validar jogo (implementado nas proximas etapas). Datas planejadas
-- manualmente pelo admin.
-- =============================================================================

-- 1. Enums -------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'season_status') THEN
    CREATE TYPE season_status AS ENUM ('upcoming', 'active', 'closed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'season_recurrence') THEN
    CREATE TYPE season_recurrence AS ENUM ('none', 'weekly', 'monthly', 'quarterly', 'semiannual');
  END IF;
END$$;

-- 2. Tabela seasons ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS seasons (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  slug              TEXT UNIQUE,
  starts_at         TIMESTAMPTZ NOT NULL,
  ends_at           TIMESTAMPTZ NOT NULL,
  status            season_status NOT NULL DEFAULT 'upcoming',
  -- recorrencia: usada apenas como atalho para pre-preencher datas da proxima
  -- temporada na criacao manual. Nada roda sozinho a partir dela.
  recurrence        season_recurrence NOT NULL DEFAULT 'none',
  champion_user_id  UUID REFERENCES users(id),
  closed_at         TIMESTAMPTZ,
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT seasons_dates_check CHECK (ends_at > starts_at)
);

-- Garante no maximo UMA temporada ativa por vez.
CREATE UNIQUE INDEX IF NOT EXISTS seasons_single_active_idx
  ON seasons ((status))
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS seasons_status_idx ON seasons (status);
CREATE INDEX IF NOT EXISTS seasons_ends_at_idx ON seasons (ends_at);

-- 3. Tabela season_standings (classificacao materializada) -------------------
-- Para a temporada ativa: mantida atualizada. Para temporadas fechadas: tabela
-- final congelada (Hall da Fama).

CREATE TABLE IF NOT EXISTS season_standings (
  season_id   UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points      INT NOT NULL DEFAULT 0,
  wins        INT NOT NULL DEFAULT 0,
  losses      INT NOT NULL DEFAULT 0,
  games       INT NOT NULL DEFAULT 0,
  zebra_wins  INT NOT NULL DEFAULT 0,
  position    INT,
  win_rate    NUMERIC(5,2) NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (season_id, user_id)
);

CREATE INDEX IF NOT EXISTS season_standings_rank_idx
  ON season_standings (season_id, points DESC, win_rate DESC, wins DESC);

-- 4. Vincular partidas a temporada -------------------------------------------
-- Carimbado no registro pela data_partida (proxima etapa). Partidas antigas
-- ficam com season_id NULL (o historico vive no ranking Geral).

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES seasons(id);

CREATE INDEX IF NOT EXISTS matches_season_id_idx ON matches (season_id);

-- 5. RLS ---------------------------------------------------------------------
-- Leitura publica (igual achievements). Escrita somente via service_role /
-- funcoes SECURITY DEFINER (admin e logica de pontuacao das proximas etapas).

ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE season_standings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Seasons are viewable by everyone" ON seasons;
CREATE POLICY "Seasons are viewable by everyone"
  ON seasons FOR SELECT USING (true);

DROP POLICY IF EXISTS "Season standings are viewable by everyone" ON season_standings;
CREATE POLICY "Season standings are viewable by everyone"
  ON season_standings FOR SELECT USING (true);

-- 6. Configuracoes (settings) ------------------------------------------------

INSERT INTO settings (key, value, description) VALUES
  ('season_points_win',    '3',     'Pontos de temporada por vitoria'),
  ('season_points_loss',   '1',     'Pontos de temporada por derrota (nunca negativo)'),
  ('season_zebra_bonus',   '2',     'Pontos extras ao vencer alguem acima de voce no ranking Geral'),
  ('season_zebra_enabled', 'false', 'Liga/desliga o bonus de zebra na temporada')
ON CONFLICT (key) DO NOTHING;

-- 7. Conquista "Campeao da Temporada" ----------------------------------------
-- Concedida manualmente no fechamento da temporada (proxima etapa), nao pelo
-- avaliador automatico de conquistas.

INSERT INTO achievements (key, name, description, category, rarity, icon, points, condition_type, condition_value, is_active)
VALUES (
  'season_champion',
  'Campeao da Temporada',
  'Terminou em 1o lugar no ranking de uma temporada.',
  'temporada',
  'especial',
  '🏆',
  100,
  'season_champion',
  1,
  true
)
ON CONFLICT (key) DO NOTHING;

-- 8. Temporada inicial -------------------------------------------------------
-- Cria uma temporada ATIVA comecando agora (o historico anterior fica so no
-- ranking Geral). Datas/nome editaveis pelo admin depois. ends_at planejado
-- em +1 mes apenas como referencia inicial (encerramento e manual/automatico).

INSERT INTO seasons (name, slug, starts_at, ends_at, status, recurrence)
SELECT
  'Temporada Inaugural',
  'temporada-inaugural',
  now(),
  now() + interval '1 month',
  'active',
  'monthly'
WHERE NOT EXISTS (SELECT 1 FROM seasons);
