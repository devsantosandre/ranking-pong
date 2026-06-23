-- Contagem de linhas de todas as tabelas de public + auth.users, para conferir
-- a integridade da migração (origem vs destino). Saída: schema.tabela,contagem
SELECT format('%I.%I', n.nspname, c.relname) AS tabela,
       c.reltuples::bigint AS estimado,
       (xpath('/row/c/text()',
              query_to_xml(format('SELECT count(*) AS c FROM %I.%I', n.nspname, c.relname),
                           false, true, '')))[1]::text::bigint AS exato
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND (n.nspname = 'public'
       OR (n.nspname = 'auth' AND c.relname IN ('users', 'identities')))
ORDER BY 1;
