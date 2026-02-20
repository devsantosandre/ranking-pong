-- Criar tabela de configuracoes
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- Inserir configuracoes padrao
INSERT INTO settings (key, value, description) VALUES
  ('limite_jogos_diarios', '2', 'Limite de jogos por dia contra mesmo adversario'),
  ('rating_inicial', '250', 'Rating inicial para novos jogadores')
ON CONFLICT (key) DO NOTHING;
