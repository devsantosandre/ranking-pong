#!/usr/bin/env bash
#
# Fase 4 do runbook: compara contagem de linhas Cloud (origem) x VPS (destino).
# Rode de uma máquina com acesso a AMBOS, ou copie contagem-cloud.txt para a VPS.
#
set -euo pipefail
cd "$(dirname "$0")"

[[ -f config.env ]] || { echo "ERRO: copie config.example.env para config.env e preencha."; exit 1; }
# shellcheck disable=SC1091
source config.env

DST="${VPS_PG_URL:?defina VPS_PG_URL em config.env}"
OUT="${DUMP_DIR:-./dumps}"

[[ -f "$OUT/contagem-cloud.txt" ]] || { echo "ERRO: $OUT/contagem-cloud.txt não encontrado (rode 01-...sh primeiro)."; exit 1; }

echo ">> Contando linhas na VPS…"
psql "$DST" -At -F',' -f conta-linhas.sql > "$OUT/contagem-vps.txt"

echo ""
echo ">> Diferenças (tabela | exato-CLOUD | exato-VPS):"
echo "   (linhas só aparecem aqui se a contagem EXATA divergir)"
# coluna 1 = tabela, coluna 3 = contagem exata
join -t',' -1 1 -2 1 \
  <(cut -d',' -f1,3 "$OUT/contagem-cloud.txt" | sort) \
  <(cut -d',' -f1,3 "$OUT/contagem-vps.txt"   | sort) \
  | awk -F',' '$2 != $3 { print $1" | cloud="$2" | vps="$3 }'

echo ""
echo ">> Se nada apareceu acima, todas as contagens batem. ✅"
echo ">> Confira também manualmente:  psql \"\$VPS_PG_URL\" -c 'SELECT count(*) FROM auth.users;'"
