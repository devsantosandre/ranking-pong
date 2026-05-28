-- pipeline smoke-test #2: valida fluxo rsync → migrate-hml.sh → coolify
DO $$
BEGIN
  RAISE NOTICE 'pipeline-test-2: migration executada com sucesso em %', now();
END;
$$;
