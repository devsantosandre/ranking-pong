#!/usr/bin/env bash
#
# Fase E (ensaio): compara o tempo de resposta de dois ambientes (VPS x Vercel).
# Mede TTFB (time to first byte) e tempo total, em N requisições, e mostra a média.
#
#   ./04-medir-latencia.sh https://teste.rankingpong.com.br https://smashpong.rankingpong.com.br
#   ./04-medir-latencia.sh URL_A URL_B [N_REQUISICOES] [CAMINHO]
#
# Ex. medindo uma rota específica (mesma nos dois):
#   ./04-medir-latencia.sh https://teste... https://smashpong... 15 /ranking
#
set -euo pipefail

URL_A="${1:?uso: $0 URL_A URL_B [N] [CAMINHO]}"
URL_B="${2:?informe a segunda URL}"
N="${3:-10}"
PATH_SUFFIX="${4:-/}"

medir() {
  local base="$1" total=0 ttfb_total=0 i t f
  echo ">> $base$PATH_SUFFIX  ($N requisições)"
  for ((i = 1; i <= N; i++)); do
    # -L segue redirect; -o /dev/null descarta o corpo; -s silencioso
    read -r t f < <(curl -L -o /dev/null -s \
      -w '%{time_total} %{time_starttransfer}' \
      "$base$PATH_SUFFIX" || echo "0 0")
    total=$(awk -v a="$total" -v b="$t" 'BEGIN{print a+b}')
    ttfb_total=$(awk -v a="$ttfb_total" -v b="$f" 'BEGIN{print a+b}')
    printf '   #%2d  total=%6.3fs  ttfb=%6.3fs\n' "$i" "$t" "$f"
  done
  awk -v tt="$total" -v ft="$ttfb_total" -v n="$N" \
    'BEGIN{printf "   média: total=%.3fs  ttfb=%.3fs\n\n", tt/n, ft/n}'
}

command -v curl >/dev/null || { echo "ERRO: curl não encontrado."; exit 1; }

echo "Comparando tempo de resposta (rota: $PATH_SUFFIX)"
echo "================================================"
medir "$URL_A"
medir "$URL_B"
echo "Dica: rode também em rotas com mais queries (ex. /ranking) — é onde a"
echo "colocalização app+banco da VPS mais aparece vs Vercel+Supabase free."
