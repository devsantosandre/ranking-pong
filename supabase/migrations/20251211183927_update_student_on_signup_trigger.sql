-- Remove trigger existente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Remove funcao existente
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Funcao que cria um student quando um novo usuario e registrado
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.students (
    user_id,
    nome_completo,
    email,
    rating_atual,
    streak,
    jogos_disputados,
    vitorias,
    derrotas,
    inactivity_days,
    role
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
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

-- Trigger que executa a funcao quando um novo usuario e criado
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Migrar usuarios existentes de auth.users que ainda nao estao em students
INSERT INTO public.students (user_id, nome_completo, email, rating_atual)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data->>'name', au.email),
  au.email,
  250
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.students s WHERE s.user_id = au.id
)
ON CONFLICT (user_id) DO NOTHING;
