# 05 — Performance & Aceleração ("impacto máximo sem pesar")

## 1. Orçamento (metas)
| Métrica | Alvo |
|---|---|
| FPS das animações | **60fps** estável (sem jank no avanço da chave) |
| INP | **< 200ms** |
| LCP | **< 2.5s** |
| CLS | **< 0.1** (zero layout shift nos números → `tabular-nums`) |
| JS de ilha interativa | enxuto (medir por rota) |
| TV (tela grande) | sem banding/repaint perceptível |

## 2. Regras de animação (inegociáveis)
1. **Só GPU:** animar **`transform`/`opacity`**. Nunca `width/height/top/left/margin`.
2. **`will-change` cirúrgico** — aplicar antes de animar, remover depois; nunca global.
3. **Composite layers controladas** — evitar centenas de camadas; agrupar.
4. **`prefers-reduced-motion`** + toggle global → estado final imediato, sem supérfluo.

## 3. Regras de render
1. **RSC-first** — mandar o mínimo de JS; ilhas de cliente isoladas.
2. **`LazyMotion`** (Motion) + import só das features usadas → bundle menor.
3. **Virtualizar** brackets gigantes; **lazy-mount** colunas fora da viewport (IntersectionObserver).
4. **Memoizar** layout do bracket (`useMemo` + recalcular só em `ResizeObserver`).
5. **CSS > JS** para microinterações (usar `tw-animate-css`).
6. **Code-split** por rota; TV e admin em chunks separados.

## 4. Regras de dados/realtime
1. **Coalesce** de eventos realtime (debounce ~150ms) — rajada de propagação da chave não re-renderiza N vezes.
2. **Diff por `match.id`** — reanimar só os nós alterados, não a chave inteira.
3. **`setQueryData`** em vez de refetch quando o evento já traz o dado.
4. **`refetchOnReconnect`** + polling leve como fallback de WS.

## 5. Regras de assets
1. **Confete em canvas** descartável; nunca no DOM.
2. **Bandeiras em sprite** (`flag-icons`); sem layout shift.
3. **Ruído/textura** = 1 PNG pequeno tiled (não SVG pesado).
4. **OG images** geradas no edge (`ImageResponse`), cacheadas.
5. **Fontes** com `display: swap` e subset.

## 6. Específico de TV (pior caso)
- **Fit automático** (escala) para caber sem reflow.
- **Anti burn-in:** deslocamento sutil periódico (1–2px/min) + brilho moderado em elementos estáticos.
- **Safe area / overscan:** padding ~5% nas bordas.
- **Ambient glows** com `filter: blur` pesado → manter poucos e grandes, `transform`-only.
- **Modo claro de emergência** para salas com reflexo.

## 7. Medição (parte do Definition of Done)
- **Vercel Speed Insights** (já instalado) — INP/LCP em produção.
- **Lighthouse** com foco na rota `/tv` e `/torneios/[id]/chave`.
- **React DevTools Profiler** — caçar re-renders no bracket.
- **Chrome Performance** — confirmar 60fps no avanço da chave (sem long tasks).
- Budget no CI: alertar se o bundle de rota passar do limite definido.

## 8. Antipadrões a evitar
- Animar a chave inteira a cada evento realtime.
- `backdrop-filter` em dezenas de elementos sobrepostos (custo de repaint) → limitar profundidade de vidro.
- Motion "blanket" em telas data-densas (lançar `motion.*` em listas longas) → usar virtualização + CSS.
- Recalcular layout do bracket em todo render (memoizar!).
