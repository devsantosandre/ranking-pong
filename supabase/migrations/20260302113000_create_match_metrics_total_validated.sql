BEGIN;

CREATE TABLE IF NOT EXISTS public.match_metrics (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  total_validated_matches BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.match_metrics (id, total_validated_matches, updated_at)
VALUES (
  true,
  (
    SELECT COUNT(*)::BIGINT
    FROM public.matches
    WHERE status = 'validado'
  ),
  now()
)
ON CONFLICT (id) DO UPDATE
SET total_validated_matches = EXCLUDED.total_validated_matches,
    updated_at = now();

ALTER TABLE public.match_metrics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'match_metrics'
      AND policyname = 'Match metrics are viewable by everyone'
  ) THEN
    CREATE POLICY "Match metrics are viewable by everyone"
      ON public.match_metrics
      FOR SELECT
      USING (true);
  END IF;
END
$$;

GRANT SELECT ON public.match_metrics TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_total_validated_matches_metric()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  delta INTEGER := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN
    delta := CASE WHEN NEW.status = 'validado' THEN 1 ELSE 0 END;
  ELSIF TG_OP = 'DELETE' THEN
    delta := CASE WHEN OLD.status = 'validado' THEN -1 ELSE 0 END;
  ELSE
    delta :=
      (CASE WHEN NEW.status = 'validado' THEN 1 ELSE 0 END) -
      (CASE WHEN OLD.status = 'validado' THEN 1 ELSE 0 END);
  END IF;

  IF delta <> 0 THEN
    UPDATE public.match_metrics
    SET total_validated_matches = GREATEST(0, total_validated_matches + delta),
        updated_at = now()
    WHERE id = true;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_total_validated_matches_metric ON public.matches;

CREATE TRIGGER trg_sync_total_validated_matches_metric
AFTER INSERT OR UPDATE OF status OR DELETE ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.sync_total_validated_matches_metric();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'match_metrics'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.match_metrics;
  END IF;
END
$$;

COMMIT;
