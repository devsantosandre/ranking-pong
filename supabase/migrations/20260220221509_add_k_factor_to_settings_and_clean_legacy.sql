-- Adicionar k_factor nas configuracoes do sistema ELO
-- ON CONFLICT DO NOTHING para nao sobrescrever se ja existir
INSERT INTO settings (key, value, description) VALUES
  ('k_factor', '24', 'Fator K do sistema ELO (maior = mais pontos por partida)')
ON CONFLICT (key) DO NOTHING;

-- Remover configuracoes legadas do sistema de pontos fixos
-- O ELO substitui pontos_vitoria e pontos_derrota
DELETE FROM settings WHERE key IN ('pontos_vitoria', 'pontos_derrota');
