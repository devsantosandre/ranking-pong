-- =============================================================================
-- Soft-delete reversivel de temporadas (ocultar / restaurar)
-- =============================================================================
-- Permite que o admin OCULTE uma temporada dos jogadores sem apaga-la:
--   - archived_at NULL      -> visivel normalmente (ranking, Hall da Fama, etc.)
--   - archived_at preenchido -> oculta para jogadores, mas preservada e
--     restauravel pelo admin (partidas seguem carimbadas, standings intactos).
--
-- Diferente de "encerrar" (mantem no historico/Hall da Fama) e de excluir de
-- verdade (que apagaria dados). Esta abordagem e 100% reversivel.
-- =============================================================================

ALTER TABLE seasons
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Index parcial: as consultas de jogador filtram sempre archived_at IS NULL.
CREATE INDEX IF NOT EXISTS idx_seasons_visiveis
  ON seasons (status, starts_at DESC)
  WHERE archived_at IS NULL;

COMMENT ON COLUMN seasons.archived_at IS
  'Quando preenchido, a temporada fica oculta dos jogadores (soft-delete reversivel). Restauravel pelo admin.';
