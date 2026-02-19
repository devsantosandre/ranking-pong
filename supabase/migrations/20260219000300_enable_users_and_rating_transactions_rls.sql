BEGIN;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rating_transactions ENABLE ROW LEVEL SECURITY;

-- Remove permissive write policies.
DROP POLICY IF EXISTS "Usuarios autenticados podem atualizar users" ON public.users;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar users" ON public.users;
DROP POLICY IF EXISTS "Usuarios autenticados podem inserir rating_transactions" ON public.rating_transactions;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir rating_transactions" ON public.rating_transactions;

-- Keep inserts via service_role/admin backend only.
DROP POLICY IF EXISTS "Moderadores e admins podem inserir users" ON public.users;
DROP POLICY IF EXISTS "Moderadores e admins podem atualizar users" ON public.users;
DROP POLICY IF EXISTS "Moderadores e admins podem inserir rating_transactions" ON public.rating_transactions;

COMMIT;
