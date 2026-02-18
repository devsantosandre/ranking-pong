BEGIN;

CREATE INDEX IF NOT EXISTS idx_matches_validated_created_at
  ON public.matches (created_at DESC)
  WHERE status = 'validado';

COMMIT;
