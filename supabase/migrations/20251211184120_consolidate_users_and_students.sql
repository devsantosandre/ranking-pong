-- PASSO 1: Adicionar colunas faltantes em users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS rating_atual INTEGER DEFAULT 250 NOT NULL,
  ADD COLUMN IF NOT EXISTS streak INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS jogos_disputados INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vitorias INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS derrotas INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inactivity_days INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS role player_role DEFAULT 'player';

-- PASSO 2: Atualizar dados dos usuarios existentes com dados de students (se houver)
UPDATE public.users u
SET
  rating_atual = COALESCE(s.rating_atual, 250),
  streak = COALESCE(s.streak, 0),
  jogos_disputados = COALESCE(s.jogos_disputados, 0),
  vitorias = COALESCE(s.vitorias, 0),
  derrotas = COALESCE(s.derrotas, 0),
  inactivity_days = COALESCE(s.inactivity_days, 0),
  foto_url = s.foto_url,
  role = COALESCE(s.role, 'player')
FROM public.students s
WHERE u.id = s.user_id;

-- PASSO 3: Dropar FKs das outras tabelas que apontam para students
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_player_a_id_fkey;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_player_b_id_fkey;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_vencedor_id_fkey;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_criado_por_fkey;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_aprovado_por_fkey;

ALTER TABLE public.match_sets DROP CONSTRAINT IF EXISTS match_sets_vencedor_set_fkey;

ALTER TABLE public.daily_limits DROP CONSTRAINT IF EXISTS daily_limits_student_id_fkey;
ALTER TABLE public.daily_limits DROP CONSTRAINT IF EXISTS daily_limits_opponent_id_fkey;

ALTER TABLE public.rating_transactions DROP CONSTRAINT IF EXISTS rating_transactions_student_id_fkey;

ALTER TABLE public.ranking_snapshots DROP CONSTRAINT IF EXISTS ranking_snapshots_student_id_fkey;

ALTER TABLE public.news_posts DROP CONSTRAINT IF EXISTS news_posts_created_by_fkey;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_student_id_fkey;

-- PASSO 4: Renomear colunas student_id para user_id onde necessario
ALTER TABLE public.daily_limits RENAME COLUMN student_id TO user_id;
ALTER TABLE public.rating_transactions RENAME COLUMN student_id TO user_id;
ALTER TABLE public.ranking_snapshots RENAME COLUMN student_id TO user_id;
ALTER TABLE public.notifications RENAME COLUMN student_id TO user_id;

-- PASSO 5: Recriar FKs apontando para users
ALTER TABLE public.matches
  ADD CONSTRAINT matches_player_a_id_fkey FOREIGN KEY (player_a_id) REFERENCES public.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT matches_player_b_id_fkey FOREIGN KEY (player_b_id) REFERENCES public.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT matches_vencedor_id_fkey FOREIGN KEY (vencedor_id) REFERENCES public.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT matches_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES public.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT matches_aprovado_por_fkey FOREIGN KEY (aprovado_por) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.match_sets
  ADD CONSTRAINT match_sets_vencedor_set_fkey FOREIGN KEY (vencedor_set) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.daily_limits
  ADD CONSTRAINT daily_limits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT daily_limits_opponent_id_fkey FOREIGN KEY (opponent_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.rating_transactions
  ADD CONSTRAINT rating_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.ranking_snapshots
  ADD CONSTRAINT ranking_snapshots_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.news_posts
  ADD CONSTRAINT news_posts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- PASSO 6: Atualizar unique constraint em daily_limits
ALTER TABLE public.daily_limits DROP CONSTRAINT IF EXISTS daily_limits_student_id_opponent_id_data_key;
ALTER TABLE public.daily_limits ADD CONSTRAINT daily_limits_user_id_opponent_id_data_key UNIQUE (user_id, opponent_id, data);

-- PASSO 7: Atualizar unique constraint em ranking_snapshots
ALTER TABLE public.ranking_snapshots DROP CONSTRAINT IF EXISTS ranking_snapshots_data_referencia_student_id_key;
ALTER TABLE public.ranking_snapshots ADD CONSTRAINT ranking_snapshots_data_referencia_user_id_key UNIQUE (data_referencia, user_id);

-- PASSO 8: Dropar tabela students
DROP TABLE IF EXISTS public.students CASCADE;

-- PASSO 9: Atualizar trigger para users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    name,
    full_name,
    rating_atual,
    streak,
    jogos_disputados,
    vitorias,
    derrotas,
    inactivity_days,
    role
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    250,
    0,
    0,
    0,
    0,
    0,
    'player'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- PASSO 10: Criar indice para rating
CREATE INDEX IF NOT EXISTS idx_users_rating ON public.users(rating_atual DESC);

-- PASSO 11: Atualizar politicas RLS
DROP POLICY IF EXISTS "Usuarios autenticados podem ver students" ON public.users;
DROP POLICY IF EXISTS "Usuarios podem editar proprio perfil" ON public.users;

CREATE POLICY "Usuarios autenticados podem ver users" ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuarios podem editar proprio perfil" ON public.users FOR UPDATE TO authenticated USING (id = auth.uid());
