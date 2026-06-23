# 10 — Modo TV & Realtime

## Parte A — Modo TV (cidadão de primeira classe)

### A.1 Modos (`/tv?mode=...`)
- **`ranking`** (já existe) — manter, repaginar para arena.
- **`torneio`** — bracket projetado, fit automático, glows ambientes, destaque na partida ativa, realtime sem reload.
- **`now-playing`** — foco rotativo nas partidas em andamento + próximos confrontos + cartela de confronto.
- **`evento`** (F4) — cicla entre várias chaves do dia + placar geral.

### A.2 Características
- **Sem chrome**, type grande, `tabular-nums`.
- **Fit automático** (reusar lógica de `scale` step já implementada em `/tv`).
- **Som** opcional (toggle já existe).
- **Anti burn-in** (deslocamento 1–2px/min), **safe area** ~5%, **modo claro de emergência**.
- **Ticker** inferior (próximos/últimos/zebra).
- **Hype**: spotlight em momento decisivo, chuva de reações (ver `09-diferenciais.md`).

### A.3 Reuso
`/tv` atual já tem: realtime ranking, demo de troca de posições, controle de escala, toggle de som, view grid/table. Estender, não reescrever.

## Parte B — Realtime (Supabase)

### B.1 Contrato
- **Canal por torneio:** `tournament:<id>`.
- **Publica:** `tournament_matches` (INSERT/UPDATE), `tournament_participants`, e mudanças de standings.
- **TV** assina o mesmo canal (read-only) + **Presence** opcional (quantos assistindo).

### B.2 Hook (`lib/realtime/use-realtime-bracket.ts`)
```
useRealtimeBracket(id):
  subscribe('tournament:'+id)
  on change:
    buffer eventos por ~150ms (coalesce)        // evita rajada da propagação
    aplicar diff por match.id em queryClient.setQueryData(['tournament-bracket', id])
    marcar nós alterados → animação localizada (não re-render global)
  onReconnect: refetch + flush
```

### B.3 Garantias
- **Coalesce** (debounce ~150ms) — a propagação de um vencedor pela chave gera vários UPDATEs; agrupar.
- **Idempotência** — aplicar por `id`, ignorar eventos fora de ordem por timestamp.
- **Fallback** — se WS cair: `refetchOnReconnect` + polling leve (padrão já usado no app).
- **Presence** (opcional) — contador de espectadores na TV/página pública.

### B.4 Eventos derivados (UI)
| Evento banco | Reação UI |
|---|---|
| match → finished | roll do placar + **avanço do vencedor** + (se zebra) badge dourado + post no feed |
| match → scheduled (slots completos) | slot "TBD" vira participante (`AnimatePresence`) |
| participant inserted (inscrição) | atualiza lista de inscritos |
| tournament → finished | **coroação** + recap |

### B.5 Segurança
- Realtime respeita **RLS**: leitura pública só de torneios `active|finished`; mutações nunca pelo client (sempre Server Action → RPC).
