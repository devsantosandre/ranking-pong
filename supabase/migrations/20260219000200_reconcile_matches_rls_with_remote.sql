BEGIN;

-- Remote state currently has RLS enabled on matches.
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

COMMIT;
