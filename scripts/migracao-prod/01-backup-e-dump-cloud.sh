#!/usr/bin/env bash
#
# Fase 0/1 do runbook: backup completo do Cloud + dump de dados (public + auth).
# Roda de qualquer máquina com pg_dump >= 15 e acesso ao Supabase Cloud.
#
#   ./01-backup-e-dump-cloud.sh             # backup full + dumps de dados + contagem
#   ./01-backup-e-dump-cloud.sh --apenas-dados   # só os dumps de dados (re-rodar após congelar)
#
set -euo pipefail
cd "$(dirname "$0")"

[[ -f config.env ]] || { echo "ERRO: copie config.example.env para config.env e preencha."; exit 1; }
# shellcheck disable=SC1091
source config.env

SRC="${SUPABASE_CLOUD_DB_URL:?defina SUPABASE_CLOUD_DB_URL em config.env}"
OUT="${DUMP_DIR:-./dumps}"
mkdir -p "$OUT"

APENAS_DADOS=0
[[ "${1:-}" == "--apenas-dados" ]] && APENAS_DADOS=1

command -v pg_dump >/dev/null || { echo "ERRO: pg_dump não encontrado (instale postgresql >= 15)."; exit 1; }
echo ">> pg_dump versão: $(pg_dump --version)"

if [[ $APENAS_DADOS -eq 0 ]]; then
  echo ">> [1/4] Backup COMPLETO do Cloud (rollback)…"
  pg_dump "$SRC" -Fc -f "$OUT/backup-cloud-full.dump"
fi

echo ">> [2/4] Dump de dados de AUTH (${AUTH_TABLES})…"
# shellcheck disable=SC2086
AUTH_T_ARGS=""; for t in $AUTH_TABLES; do AUTH_T_ARGS="$AUTH_T_ARGS -t $t"; done
# --disable-triggers: desativa FK/triggers durante o COPY no restore (precisa superuser no destino)
# (COPY é o formato padrão do pg_dump --data-only; não precisa flag extra)
pg_dump "$SRC" --data-only --disable-triggers $AUTH_T_ARGS -f "$OUT/data_auth.sql"

echo ">> [3/4] Dump de dados do schema PUBLIC…"
pg_dump "$SRC" --data-only --disable-triggers -n public -f "$OUT/data_public.sql"

echo ">> [4/4] Contagem de linhas por tabela (para conferência)…"
psql "$SRC" -At -F',' -f conta-linhas.sql > "$OUT/contagem-cloud.txt"

echo ""
echo "OK. Arquivos em $OUT:"
ls -lh "$OUT"
echo ""
echo "Confira que data_public.sql NÃO está vazio antes de prosseguir."
