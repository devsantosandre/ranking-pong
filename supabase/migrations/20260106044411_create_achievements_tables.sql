-- Tabela de definicao das conquistas
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('bronze', 'prata', 'ouro', 'platina', 'diamante', 'especial')),
  icon TEXT,
  points INT DEFAULT 0,
  condition_type TEXT NOT NULL,
  condition_value INT NOT NULL DEFAULT 0,
  condition_extra JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de conquistas desbloqueadas por usuario
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  match_id UUID REFERENCES matches(id),
  UNIQUE(user_id, achievement_id)
);

-- Indices para performance
CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_achievement_id ON user_achievements(achievement_id);
CREATE INDEX idx_achievements_category ON achievements(category);
CREATE INDEX idx_achievements_key ON achievements(key);

-- RLS policies
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- Conquistas sao publicas (leitura para todos)
CREATE POLICY "Achievements are viewable by everyone"
  ON achievements FOR SELECT
  USING (true);

-- User achievements: leitura publica, escrita apenas pelo sistema
CREATE POLICY "User achievements are viewable by everyone"
  ON user_achievements FOR SELECT
  USING (true);

-- Permite insercao via authenticated user para o proprio user_id
CREATE POLICY "User achievements can be inserted by authenticated users"
  ON user_achievements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
