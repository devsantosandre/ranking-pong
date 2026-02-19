-- Adicionar coluna para status ativo/inativo
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Criar indice para buscas por is_active
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
