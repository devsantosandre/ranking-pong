-- Alterar replica identity para FULL para que o Realtime envie os valores antigos
ALTER TABLE public.users REPLICA IDENTITY FULL;
