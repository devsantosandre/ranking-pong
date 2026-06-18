# 06 — Animações (catálogo + specs)

> Princípio: **impacto máximo, leve**. Tudo `transform`/`opacity` (GPU). `prefers-reduced-motion` desliga o supérfluo (estado final imediato). Ver orçamento em `05-performance.md`.

## 1. Easings padrão
```css
--ease-arena:       cubic-bezier(0.22, 1, 0.36, 1);  /* entradas (easeOutExpo-ish) */
--ease-arena-inout: cubic-bezier(0.65, 0, 0.35, 1);  /* movimentos */
```

## 2. Catálogo (com specs)
| # | Animação | Onde | Lib | Spec |
|---|---|---|---|---|
| 1 | **Reveal em cascata** do bracket | abrir a chave | Motion | `staggerChildren:0.04`, item `y:12→0` + `opacity 0→1`, `dur .28`, `--ease-arena` |
| 2 | **Avanço do vencedor → próxima partida** | lançar placar | ViewTransition (shared `participant-<id>`) + Motion fallback | nome "viaja" do slot atual para o próximo; **GSAP** dispara **pulso na linha conectora** (`MotionPath`, `dur .6`, `power2.inOut`) |
| 3 | **Glow pulse** | partida/rodada ativa | CSS | `glow-pulse 1.8s ease-in-out infinite` (já existe) — zero JS |
| 4 | **Roll/flip do placar** | mudança de score | Motion | spring `{stiffness:500, damping:30}`, eixo Y, mask overflow |
| 5 | **UPSET / Zebra** | seed baixo vence alto | Motion + CSS | flash dourado + badge `scale .8→1` spring + shake leve 1× |
| 6 | **Coroação do campeão** | fim do torneio | GSAP + canvas-confetti | timeline: dim palco .3 → troféu `scale .6→1` spring → confetti burst 1.2s → settle |
| 7 | **Draw-on dos conectores** | primeiro render | CSS/Motion | `stroke-dashoffset` `len→0`, `dur .5`, stagger por profundidade |
| 8 | **Ambient glows** | fundo do palco/TV | CSS | `translate`/`scale` lentíssimo `~12s` linear infinite, `blur(60px)` |
| 9 | **Troca de posição (ranking/TV)** | realtime | Motion `layout` | spring `{stiffness:400, damping:40}` (reusa demo de `/tv`) |
| 10 | **Transição de rota** | navegação | ViewTransition | CSS keyframes co-localizados; cross-fade + slide 8px |
| 11 | **Now-playing ticker** | TV | GSAP | timeline em loop, foco rotativo na partida ativa |
| 12 | **Chuva de reações** | TV (espectadores) | CSS | emoji caindo, `translateY`, recicla nós (pool), descarta |
| 13 | **Win probability bar** | match card | Motion | largura via `scaleX` (não `width`), `dur .4` |
| 14 | **Recap / Wrapped** | pós-torneio | GSAP timeline | fast-forward do preenchimento da chave + destaques |

## 3. Implementação responsável
- **`AnimatePresence`** para entrada/saída de slots (TBD → participante definido).
- **`layoutId`/`view-transition-name`** para continuidade do mesmo participante entre telas/slots.
- **Pool de nós** para partículas/reações (não criar/destruir DOM em loop).
- **Desabilitar** animações 2, 5, 6, 8, 11, 12 quando `prefers-reduced-motion: reduce`.
- **Toggle global** "reduzir movimento" em configurações (persistido).

## 4. Hierarquia de "uau" (onde investir)
1. **Avanço do vencedor** (#2) — é o momento que vende o produto.
2. **Coroação do campeão** (#6).
3. **Zebra** (#5) + **probabilidade** (#13) — diferencial de ELO.
4. **TV ticker/reações** (#11/#12) — transmissão.
Resto = polimento.

## 5. Som (opcional, já há toggle em `/tv`)
- Whoosh sutil no avanço; "ding" na vitória; aplauso no campeão. Curtos, pré-carregados, respeitam o toggle e o mudo do sistema.
