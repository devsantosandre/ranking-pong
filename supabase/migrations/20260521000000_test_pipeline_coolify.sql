-- pipeline smoke-test: verifica que o fluxo rsync → migrate-hml.sh → coolify funciona
DO $$
BEGIN
  RAISE NOTICE 'pipeline-test: migration executada com sucesso em %', now();
END;
$$;
