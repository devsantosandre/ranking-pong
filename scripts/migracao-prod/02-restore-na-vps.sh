#!/usr/bin/env bash
#
# Fase 3 do runbook: restaura os dados do Cloud no Postgres self-hosted da VPS.
# RODAR NA VPS (ou de uma máquina com acesso ao Postgres da VPS).
#
# Faz TRUNCATE das tabelas de HML e carrega os dados de PROD numa ÚNICA
# transação com triggers/FK desativados. Erro em qualquer passo => ROLLBACK
# total (o estado de HML antigo permanece intacto).
#
set -euo pipefail
cd "$(dirname "$0")"

[[ -f config.env ]] || { echo "ERRO: copie config.example.env para config.env e preencha."; exit 1; }
# shellcheck disable=SC1091
source config.env

DST="${VPS_PG_URL:?defina VPS_PG_URL em config.env}"
OUT="${DUMP_DIR:-./dumps}"

[[ -f "$OUT/data_auth.sql"   ]] || { echo "ERRO: $OUT/data_auth.sql não encontrado.";   exit 1; }
[[ -f "$OUT/data_public.sql" ]] || { echo "ERRO: $OUT/data_public.sql não encontrado."; exit 1; }

# Proteção: confirma que o destino NÃO é o Cloud (evita rodar no lugar errado).
if [[ "$DST" == *"supabase.co"* || "$DST" == *"pooler.supabase.com"* ]]; then
  echo "ERRO: VPS_PG_URL parece apontar para o Supabase CLOUD. Este script é só para a VPS."
  exit 1
fi

echo ">> Destino: $(echo "$DST" | sed -E 's#://[^@]+@#://***@#')"
read -r -p ">> Isso vai APAGAR os dados atuais (HML) da VPS e carregar os de PROD. Digite VIRAR para confirmar: " ok
[[ "$ok" == "VIRAR" ]] || { echo "Abortado."; exit 1; }

# Lista de tabelas de public para truncar (geradas dinamicamente).
TRUNCATE_PUBLIC=$(psql "$DST" -At -c \
  "SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
   FROM pg_tables WHERE schemaname = 'public';")

echo ">> Tabelas public a truncar: $TRUNCATE_PUBLIC"

psql "$DST" -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET session_replication_role = replica;   -- desativa triggers e checagem de FK

-- 1) limpa dados de HML
TRUNCATE auth.identities, auth.users CASCADE;
TRUNCATE ${TRUNCATE_PUBLIC} RESTART IDENTITY CASCADE;

-- 2) carrega auth (usuários/identidades, com hashes) e depois public
\i ${OUT}/data_auth.sql
\i ${OUT}/data_public.sql

-- 3) volta ao normal e avisa o PostgREST
SET session_replication_role = DEFAULT;
NOTIFY pgrst, 'reload schema';
COMMIT;
SQL

echo ""
echo "OK — restore concluído. Rode ./03-verificar.sh para conferir as contagens."
