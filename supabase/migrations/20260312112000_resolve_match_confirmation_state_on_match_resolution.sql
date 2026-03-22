BEGIN;

CREATE OR REPLACE FUNCTION public.sync_match_confirmation_resolution_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('validado', 'cancelado')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.match_confirmation_state
    SET
      resolved_at = COALESCE(resolved_at, now()),
      escalated_at = NULL,
      restriction_active = false,
      updated_at = now()
    WHERE match_id = NEW.id
      AND resolved_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_match_confirmation_resolution
  ON public.matches;

CREATE TRIGGER trg_sync_match_confirmation_resolution
AFTER UPDATE OF status ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.sync_match_confirmation_resolution_v1();

COMMIT;
