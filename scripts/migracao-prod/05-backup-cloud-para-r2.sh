#!/usr/bin/env bash
#
# Backup completo do Supabase Cloud (PROD) -> Cloudflare R2 (off-site).
# Serve como apólice de seguro/rollback e como rotina recorrente (cron).
#
#   ./05-backup-cloud-para-r2.sh
#
# Pré-requisitos: pg_dump >= 15 e AWS CLI (Mac: brew install awscli).
# R2 é S3-compatível — usamos o aws cli com --endpoint-url do R2.
#
set -euo pipefail
cd "$(dirname "$0")"

[[ -f config.env ]] || { echo "ERRO: copie config.example.env para config.env e preencha."; exit 1; }
# shellcheck disable=SC1091
source config.env

SRC="${SUPABASE_CLOUD_DB_URL:?defina SUPABASE_CLOUD_DB_URL em config.env}"
: "${R2_ENDPOINT:?defina R2_ENDPOINT em config.env}"
: "${R2_BUCKET:?defina R2_BUCKET em config.env}"
PREFIXO="${R2_PREFIXO:-cloud-prod}"
RETENCAO="${R2_RETENCAO:-30}"

export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID:?defina R2_ACCESS_KEY_ID em config.env}"
export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY:?defina R2_SECRET_ACCESS_KEY em config.env}"
export AWS_DEFAULT_REGION="auto"          # R2 usa região "auto"
S3="aws s3 --endpoint-url $R2_ENDPOINT"

command -v pg_dump >/dev/null || { echo "ERRO: pg_dump não encontrado (postgresql >= 15)."; exit 1; }
command -v aws     >/dev/null || { echo "ERRO: aws cli não encontrado (brew install awscli)."; exit 1; }

TS="$(date +%Y-%m-%dT%H%M%S)"
ARQ="cloud-backup-${TS}.dump"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo ">> [1/3] pg_dump completo do Cloud…"
pg_dump "$SRC" -Fc -f "$TMP/$ARQ"
TAM=$(wc -c < "$TMP/$ARQ")
(( TAM > 1024 )) || { echo "ERRO: dump suspeito (muito pequeno: $TAM bytes). Abortando upload."; exit 1; }
echo "   gerado $ARQ ($(( TAM / 1024 )) KB)"

echo ">> [2/3] Upload para R2 (s3://$R2_BUCKET/$PREFIXO/$ARQ)…"
$S3 cp "$TMP/$ARQ" "s3://$R2_BUCKET/$PREFIXO/$ARQ"

echo ">> [3/3] Retenção: mantendo os $RETENCAO backups mais recentes…"
# nomes ordenam cronologicamente (timestamp ISO); apaga os que excedem a retenção.
# Sem mapfile (indisponível no bash 3.2 do macOS): lê numa array portável.
OBJS=()
while IFS= read -r line; do
  [[ -n "$line" ]] && OBJS+=("$line")
done < <($S3 ls "s3://$R2_BUCKET/$PREFIXO/" | awk '{print $4}' | grep -E '^cloud-backup-.*\.dump$' | sort)
TOTAL=${#OBJS[@]}
if (( TOTAL > RETENCAO )); then
  REMOVER=$(( TOTAL - RETENCAO ))
  echo "   $TOTAL backups; removendo $REMOVER mais antigos."
  for ((i = 0; i < REMOVER; i++)); do
    echo "   - apagando ${OBJS[i]}"
    $S3 rm "s3://$R2_BUCKET/$PREFIXO/${OBJS[i]}"
  done
else
  echo "   $TOTAL backups (<= $RETENCAO); nada a remover."
fi

echo ""
echo "OK — backup off-site concluído: s3://$R2_BUCKET/$PREFIXO/$ARQ"
echo ""
echo "Para RESTAURAR este backup (rollback) em qualquer Postgres/Supabase:"
echo "  aws s3 --endpoint-url $R2_ENDPOINT cp s3://$R2_BUCKET/$PREFIXO/$ARQ ./restore.dump"
echo "  pg_restore --clean --if-exists --no-owner -d \"\$DB_URL_DESTINO\" ./restore.dump"
