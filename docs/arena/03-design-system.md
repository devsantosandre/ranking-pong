# 03 — Design System "Arena"

## 1. Filosofia
Dark profundo + **vidro** + **glow neon por estado** + **roxo de marca** como assinatura. O roxo deixa de ser o fundo e vira **acento de energia**; o palco é escuro. Inspiração direta na referência de bracket do Tourney.

## 2. Tokens (Tailwind v4 `@theme`, dark como padrão)
```css
:root {
  /* Palco */
  --arena-bg-1:#0b0612; --arena-bg-2:#150a22; --arena-vignette:#050208;
  /* Vidro */
  --glass-bg: color-mix(in srgb,#fff 4%,transparent);
  --glass-bg-strong: color-mix(in srgb,#fff 7%,transparent);
  --glass-border: color-mix(in srgb,#fff 10%,transparent);
  --glass-blur:14px;
  /* Marca */
  --primary:#c04bff; --primary-glow: color-mix(in srgb,#c04bff 55%,transparent);
  /* Estados (espelham a referência) */
  --state-active:#22d3ee;     /* ciano  — em andamento / rodada ativa */
  --state-scheduled:#f5a524;  /* âmbar  — agendado / deadline */
  --state-played:#2dd4a7;     /* verde  — jogado / vitória */
  --state-noshow:#f43f5e;     /* vermelho — no-show */
  --state-tbd:#8b8197;        /* neutro — indefinido */
  /* Texto */
  --foreground:#f3ecff; --muted-foreground:#b6a8c9;
  --radius:0.9rem;
  --ease-arena:cubic-bezier(0.22,1,0.36,1);
  --ease-arena-inout:cubic-bezier(0.65,0,0.35,1);
}
```

## 3. Receitas visuais
- **Card de vidro:** `.glass` = `bg-[--glass-bg] border border-[--glass-border] backdrop-blur-[14px] rounded-2xl` + sombra suave.
- **Glow por estado:** `box-shadow:0 0 0 1px <state>/30, 0 8px 32px <state>/15`. Partida/coluna ativa **pulsa** (reusar `@keyframes glow-pulse` que já existe).
- **Palco:** gradiente radial `--arena-bg-2 → --arena-bg-1` + vinheta + **ruído** (1 PNG ~1KB tiled, `mix-blend-mode:overlay`, opacity baixa) — mata banding na TV.
- **Ambient glows:** 2–3 blobs roxo/ciano desfocados, `translate` lento (baixo custo).
- **Variante alto contraste:** glass mais opaco (`--glass-bg-strong`) + borda mais forte, para sol/TV.

## 4. Tipografia
- **Display (headers/fases/nomes):** fonte variável esportiva — candidatas: **Space Grotesk**, **Unbounded**, **Clash Display**. (Decisão pendente do usuário.)
- **Corpo:** **Geist** (mantida).
- **Números (placar/seed/pontos):** `font-bold tabular-nums` **sempre** — zero "pulo" de largura na TV.
- **Microtítulos:** `text-[11px] font-semibold uppercase tracking-wide text-muted-foreground`.

## 5. Cor de estado → semântica (acessível)
Cada estado tem **cor + ícone + rótulo** (não depende só de cor — modo daltônico):
| Estado | Cor | Ícone | Rótulo |
|---|---|---|---|
| Ativo | ciano | ▶ | ACTIVE |
| Agendado | âmbar | ⏰ | Deadline … |
| Jogado | verde | ✓ | Played … |
| No-show / W/O | vermelho | ✕ | No-show / W/O |
| TBD | neutro | – | Waiting… |

## 6. Componentes UI (repaginar para vidro, mesma API)
Reusar e re-skin: `Button`, `Card`, `Tabs`, `Sheet`, `Popover`, `Command/cmdk`, `ConfirmModal`, `Input`, `Skeleton`, `LoadMoreButton`. Novos primitivos arena: `GlassCard`, `StatusPill`, `AmbientGlows`, `Halo`.

## 7. Anatomia do Bracket (componente-herói)
```
<BracketCanvas>            // pan/zoom/fit + minimap
  <BracketColumn round=Quarterfinal>
    <RoundHeader title deadline statusPill />
    <MatchCard status="played" time>
      <ParticipantRow seed flag name score variant=win />
      <ParticipantRow seed flag name score variant=lose />
    </MatchCard>
  </BracketColumn>
  <BracketConnectors />    // SVG por cima
```
### 7.1 Medidas (amostradas da referência, viram tokens)
- Card de partida **~270px**, raio **~10px**, padding **~10–12px**.
- Linha do participante **~38px**; seed em quadradinho **~18px**; bandeira **~16–20px**; caixa de placar **~28×28px**.
- Gap entre as 2 partidas de um par **~24px**; entre pares **~56px** (cresce por rodada).
- Coluna → coluna **~110–130px** (espaço dos conectores).
### 7.2 Conector
Ortogonal: sai do meio da borda direita de A e B → segmento horizontal → encontro vertical no **x médio** entre colunas → entra no destino (meio vertical do par). Stroke **~2px** `rgba(255,255,255,.18)`; aresta que leva a partida **ativa** ganha tint ciano + brilho. Path animável (`stroke-dashoffset`).

## 8. Responsividade (mobile → desktop → TV)
- **Mobile:** canvas vira **scroll horizontal com snap por rodada** + indicador de fase; ou "lista por rodada" (accordion) em chaves grandes. Mobile-first.
- **Desktop:** bracket inteiro com pan/zoom; minimap quando passa da viewport.
- **TV:** **fit automático** (reusar lógica de `scale` de `/tv`), type grande, sem chrome.

## 9. Checklist visual (antes de finalizar tela)
1. Reusa `AppShell`, tokens Arena, `divisions.ts`?
2. Três estados (loading/vazio/erro)?
3. `tabular-nums`? Acentuação correta?
4. Estado por cor **+ ícone** (daltônico)? Alto contraste disponível?
5. Passa `lint` + `build`?
