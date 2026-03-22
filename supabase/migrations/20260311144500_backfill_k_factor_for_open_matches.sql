BEGIN;

DO $$
DECLARE
  v_k_factor integer := 24;
BEGIN
  SELECT
    CASE
      WHEN s.value ~ '^[0-9]+$' THEN s.value::integer
      ELSE 24
    END
  INTO v_k_factor
  FROM public.settings s
  WHERE s.key = 'k_factor'
  LIMIT 1;

  v_k_factor := COALESCE(v_k_factor, 24);

  IF v_k_factor < 1 OR v_k_factor > 100 THEN
    RAISE EXCEPTION 'invalid_k_factor';
  END IF;

  UPDATE public.matches
  SET k_factor_used = v_k_factor
  WHERE status IN ('pendente', 'edited')
    AND k_factor_used IS NULL;
END
$$;

COMMIT;
