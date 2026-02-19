-- Adicionar campo para registrar o K factor usado na partida
ALTER TABLE matches ADD COLUMN IF NOT EXISTS k_factor_used integer;

-- Comentario explicativo
COMMENT ON COLUMN matches.k_factor_used IS 'K factor do ELO usado no momento da confirmação da partida';
