BEGIN;

CREATE TABLE IF NOT EXISTS public.match_reactions (
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reaction text NOT NULL CHECK (reaction IN ('clap', 'fire', 'wow', 'laugh', 'sad', 'pong')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, user_id)
);

CREATE OR REPLACE FUNCTION public.get_match_reactions_summary(p_match_ids uuid[])
RETURNS TABLE (
  match_id uuid,
  reaction text,
  total bigint,
  reacted_by_me boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    mr.match_id,
    mr.reaction,
    COUNT(*)::bigint AS total,
    BOOL_OR(mr.user_id = auth.uid()) AS reacted_by_me
  FROM public.match_reactions mr
  WHERE mr.match_id = ANY(p_match_ids)
  GROUP BY mr.match_id, mr.reaction;
$$;

REVOKE ALL ON FUNCTION public.get_match_reactions_summary(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_match_reactions_summary(uuid[]) TO authenticated;

ALTER TABLE public.match_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view match reactions" ON public.match_reactions;
DROP POLICY IF EXISTS "Users can insert own match reactions" ON public.match_reactions;
DROP POLICY IF EXISTS "Users can update own match reactions" ON public.match_reactions;
DROP POLICY IF EXISTS "Users can delete own match reactions" ON public.match_reactions;

CREATE POLICY "Authenticated users can view match reactions"
ON public.match_reactions
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert own match reactions"
ON public.match_reactions
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.id = match_id
      AND m.status = 'validado'
  )
);

CREATE POLICY "Users can update own match reactions"
ON public.match_reactions
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.id = match_id
      AND m.status = 'validado'
  )
);

CREATE POLICY "Users can delete own match reactions"
ON public.match_reactions
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

COMMIT;
