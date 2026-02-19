-- Criar ENUMs
CREATE TYPE player_role AS ENUM ('player', 'admin');
CREATE TYPE match_status AS ENUM ('pendente', 'validado', 'in_progress', 'cancelado', 'edited');
CREATE TYPE resultado_tipo AS ENUM ('win', 'loss', 'wo');
CREATE TYPE transaction_motivo AS ENUM ('vitoria', 'derrota', 'bonus', 'inatividade', 'wo');
CREATE TYPE news_tipo AS ENUM ('resultado');
CREATE TYPE notification_tipo AS ENUM ('desafio', 'ranking_update', 'news', 'confirmacao');

-- Tabela: users (base do app, sincronizada com auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: students (jogadores)
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  nome_completo TEXT NOT NULL,
  email TEXT,
  foto_url TEXT,
  rating_atual INTEGER DEFAULT 250 NOT NULL,
  streak INTEGER DEFAULT 0,
  jogos_disputados INTEGER DEFAULT 0,
  vitorias INTEGER DEFAULT 0,
  derrotas INTEGER DEFAULT 0,
  inactivity_days INTEGER DEFAULT 0,
  role player_role DEFAULT 'player',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: matches (partidas)
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_a_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  player_b_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  vencedor_id UUID REFERENCES students(id) ON DELETE SET NULL,
  data_partida DATE DEFAULT CURRENT_DATE NOT NULL,
  status match_status DEFAULT 'pendente' NOT NULL,
  resultado_a INTEGER DEFAULT 0,
  resultado_b INTEGER DEFAULT 0,
  pontos_variacao_a INTEGER DEFAULT 0,
  pontos_variacao_b INTEGER DEFAULT 0,
  rating_final_a INTEGER,
  rating_final_b INTEGER,
  tipo_resultado resultado_tipo,
  criado_por UUID REFERENCES students(id) ON DELETE SET NULL,
  aprovado_por UUID REFERENCES students(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT different_players CHECK (player_a_id != player_b_id)
);

-- Tabela: match_sets (sets das partidas)
CREATE TABLE match_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
  numero_set INTEGER NOT NULL CHECK (numero_set >= 1 AND numero_set <= 5),
  pontos_a INTEGER DEFAULT 0,
  pontos_b INTEGER DEFAULT 0,
  vencedor_set UUID REFERENCES students(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (match_id, numero_set)
);

-- Tabela: daily_limits (limite de jogos por dia)
CREATE TABLE daily_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  opponent_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  data DATE DEFAULT CURRENT_DATE NOT NULL,
  jogos_registrados INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_id, opponent_id, data)
);

-- Tabela: rating_transactions (historico de pontuacao)
CREATE TABLE rating_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  motivo transaction_motivo NOT NULL,
  valor INTEGER NOT NULL,
  rating_antes INTEGER NOT NULL,
  rating_depois INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: ranking_snapshots (historico do ranking)
CREATE TABLE ranking_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_referencia DATE DEFAULT CURRENT_DATE NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  posicao INTEGER NOT NULL,
  rating INTEGER NOT NULL,
  vitorias INTEGER DEFAULT 0,
  derrotas INTEGER DEFAULT 0,
  jogos_no_periodo INTEGER DEFAULT 0,
  inatividade INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (data_referencia, student_id)
);

-- Tabela: news_posts (noticias/feed)
CREATE TABLE news_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  resumo TEXT,
  content_md TEXT,
  tags TEXT[] DEFAULT '{}',
  cover_url TEXT,
  tipo news_tipo DEFAULT 'resultado',
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES students(id) ON DELETE SET NULL,
  pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: notifications (notificacoes)
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  tipo notification_tipo NOT NULL,
  payload JSONB DEFAULT '{}',
  lida BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: live_updates (atualizacoes em tempo real - opcional)
CREATE TABLE live_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices para performance
CREATE INDEX idx_students_user_id ON students(user_id);
CREATE INDEX idx_students_rating ON students(rating_atual DESC);
CREATE INDEX idx_matches_player_a ON matches(player_a_id);
CREATE INDEX idx_matches_player_b ON matches(player_b_id);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_data ON matches(data_partida DESC);
CREATE INDEX idx_daily_limits_lookup ON daily_limits(student_id, opponent_id, data);
CREATE INDEX idx_rating_transactions_student ON rating_transactions(student_id);
CREATE INDEX idx_news_posts_published ON news_posts(published_at DESC);
CREATE INDEX idx_notifications_student ON notifications(student_id, lida);

-- Habilitar RLS em todas as tabelas
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE rating_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_updates ENABLE ROW LEVEL SECURITY;

-- Politicas RLS basicas (leitura para autenticados)
CREATE POLICY "Usuarios autenticados podem ver students" ON students FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuarios podem editar proprio perfil" ON students FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Usuarios autenticados podem ver matches" ON matches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuarios podem criar matches" ON matches FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Jogadores podem atualizar suas matches" ON matches FOR UPDATE TO authenticated USING (
  player_a_id IN (SELECT id FROM students WHERE user_id = auth.uid()) OR
  player_b_id IN (SELECT id FROM students WHERE user_id = auth.uid())
);

CREATE POLICY "Usuarios autenticados podem ver match_sets" ON match_sets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuarios podem criar match_sets" ON match_sets FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Usuarios autenticados podem ver daily_limits" ON daily_limits FOR SELECT TO authenticated USING (true);
CREATE POLICY "Sistema pode gerenciar daily_limits" ON daily_limits FOR ALL TO authenticated USING (true);

CREATE POLICY "Usuarios autenticados podem ver rating_transactions" ON rating_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Sistema pode criar rating_transactions" ON rating_transactions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Usuarios autenticados podem ver ranking_snapshots" ON ranking_snapshots FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuarios autenticados podem ver news_posts" ON news_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Sistema pode criar news_posts" ON news_posts FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Usuarios podem ver proprias notificacoes" ON notifications FOR SELECT TO authenticated USING (
  student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
);
CREATE POLICY "Usuarios podem atualizar proprias notificacoes" ON notifications FOR UPDATE TO authenticated USING (
  student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
);
CREATE POLICY "Sistema pode criar notificacoes" ON notifications FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Usuarios autenticados podem ver live_updates" ON live_updates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Sistema pode criar live_updates" ON live_updates FOR INSERT TO authenticated WITH CHECK (true);
