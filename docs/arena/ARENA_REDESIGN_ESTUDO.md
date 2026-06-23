# Estudo de Redesign — **Smash Pong Arena (v2)**

> Estudo abrangente para reconstruir o app do zero, unificado em uma identidade visual **dark / glassmorphism "arena"** inspirada na referência de bracket do Tourney, com **animações de impacto máximo (mas leves)**, **modo TV** de primeira classe e o **módulo de Torneios/Rachão** com todas as fontes/formatos do Tourney.
>
> Decisões travadas com o usuário (2026-06-17):
> 1. **Escopo:** refazer o app inteiro do zero.
> 2. **Visual:** unificar tudo no novo dark/glass.
> 3. **Animações:** impacto máximo (com guarda-rails de performance).
>
> **Invariantes que NÃO mudam mesmo no rebuild:**
> - A lógica de **ELO** e o **fluxo hardened de partidas** (`validate_pending_match_v2`, `cancel_match_v2`) são **portados como estão** e **re-testados** — não reescrever a matemática nem afrouxar a governança.
> - **Nunca aplicar migrations em produção** — só criar os arquivos; o usuário aplica.
> - **Torneios não disparam** triggers de ELO/standings — tabelas separadas.

---

## 0. Sumário executivo

Vamos transformar o Smash Pong de um "ranking mobile-first roxo" em uma **plataforma-arena imersiva**: fundo escuro profundo, superfícies de vidro, glows neon por estado, tipografia de display esportiva, e movimento cinematográfico que conta a história de cada jogo (avanço de chave, virada de placar, coroação do campeão). O coração novo é o **módulo de Torneios** com bracket visual ao vivo (eliminatória, grupos+mata-mata, round-robin, rei da mesa) — projetável na TV da escola em tempo real.

Tudo é construído sobre a stack que já domina o projeto (Next 16 + React 19 + Tailwind v4 + Supabase + TanStack Query), adicionando uma camada de **motion** (Motion + GSAP + canvas-confetti) e um **design system "Arena"** novo. Performance é requisito de produto, não detalhe: só `transform`/`opacity` na GPU, ilhas de cliente mínimas, RSC para o resto, e respeito a `prefers-reduced-motion`.

---

## 1. Decomposição da referência visual (o que faz o bracket do Tourney funcionar)

A imagem de referência é densa de sinais. Cada um vira um requisito de componente:

| Elemento na imagem | Função | Vira no nosso DS |
|---|---|---|
| Fundo escuro com leve vinheta | Foco no conteúdo, sensação premium | `--arena-bg` gradiente radial + vinheta + ruído sutil |
| Colunas por fase (Quarterfinal → Semifinal → Final & 3rd) | Leitura temporal da progressão | `BracketColumn` com header próprio |
| Header de fase com **deadline** e pill **ACTIVE** | Estado temporal da rodada | `RoundHeader` + `StatusPill` |
| Card "MATCH n" com badge (Played 17/06 19:15 / No-show / Unscheduled / W/O) | Estado da partida + quando | `MatchCard` + `MatchStatusBadge` |
| Linha do participante: **seed** + **bandeira** + **nome** + **placar** | Identidade + resultado | `ParticipantRow` (seed, flag, name, scoreBox) |
| Placar do vencedor em **verde**, perdedor neutro | Resultado num relance | `scoreBox` variantes win/lose/pending |
| Badges `WIN` / `W/O` (walkover) | Vitória por ausência | variante especial do scoreBox |
| Slots `-` e `TBD / Waiting for upstream…` | Partida ainda indefinida | estado `pending`/`tbd` |
| **Linhas conectoras** ligando os pares à próxima partida | Topologia da chave | `BracketConnectors` (SVG) |
| Bordas com leve brilho ciano na coluna ACTIVE | Destaque do "agora" | glow por estado (ver §4) |

**Insight central:** o bracket é um **grafo** (matches são nós, `next_match_id` são arestas). O visual é "só" a renderização desse grafo em colunas com conectores. Se acertarmos o modelo de dados + o layout em grid + os conectores SVG, todos os formatos caem no mesmo motor de render.

---

## 2. Stack escolhida (e por quê)

### 2.1 Base (mantida — já é estado da arte)
- **Next.js 16** (App Router, Turbopack default, RSC, **PPR/Partial Prerendering**, streaming com Suspense). `params`/`searchParams` são Promises. ([next 16](https://nextjs.org/blog/next-16))
- **React 19.2** — Server Components por padrão, ilhas de cliente só onde há interatividade/realtime. Reduz JS no cliente em até ~70% deixando o estático no servidor.
- **Tailwind CSS v4** (CSS-first `@theme`, já em uso) — onde definimos os tokens "Arena".
- **Supabase** (`@supabase/ssr`, Realtime, RPC/Postgres functions) — banco, auth, tempo real.
- **TanStack Query v5** (+ persist) — cache cliente, invalidado por eventos realtime.
- **Radix UI** + estilo shadcn — primitivos acessíveis (Dialog, Popover, Tabs, Sheet) já no projeto.
- **lucide-react** — ícones.
- **Vitest + Playwright** — testes (manter a cobertura, especialmente ELO/partidas).
- **web-push** — notificações.

### 2.2 Camada nova de **movimento** (impacto máximo, peso controlado)
- **Motion** (`motion/react`, ex‑Framer Motion) — **primária** para UI declarativa: `AnimatePresence`, **layout animations** (peça-chave para o nome "voar" para a próxima partida), gestos, variantes em cascata. De-facto standard em 2026 (~3.6M downloads/semana). Usar com **`LazyMotion`** para reduzir bundle e **só em ilhas interativas**, não em telas data-densas inteiras. ([logrocket](https://blog.logrocket.com/best-react-animation-libraries/), [good-fella lab](https://lab.good-fella.com/blog/gsap-vs-framer-motion-vs-react-spring))
- **GSAP** (+ `ScrollTrigger`, `MotionPathPlugin`) — **timelines cinematográficas** e o **pulso que viaja pela linha conectora** até a próxima partida; sequências da TV. Core ~23KB, controle fino. Usar pontualmente.
- **canvas-confetti** — coroação do campeão (canvas, descartável, não trava layout).
- **tw-animate-css** (já presente) — keyframes utilitários CSS para microinterações baratas (preferir CSS a JS quando der).
- **View Transitions NATIVAS do React 19.2 / Next 16** (`<ViewTransition>`, `addTransitionType`, shared-element) — released mar/2026. Transições de rota e **shared-element** (ex.: card do torneio → header da página) **sem lib**. Habilitar `viewTransition: true` no `next.config`. Cobertura ~78% (Chromium+Safari 18); Firefox atrás de flag → degradação graciosa. Isso **reduz a superfície do Motion**: Motion fica para `layout`/gesture/`AnimatePresence` onde View Transitions não alcança. ([next 16 view transitions](https://nextjs.org/docs/app/guides/view-transitions), [react ViewTransition](https://react.dev/reference/react/ViewTransition))

### 2.3 Camada nova de **funcionalidade**
- **@dnd-kit** — drag-and-drop acessível para **montar/semear o chaveamento** e reordenar grupos no admin.
- **react-hook-form + zod** — formulários do admin (criar torneio, participantes) com validação compartilhada client/server.
- **flag-icons** (CSS sprites) ou emoji-flags — **bandeiras** dos participantes (a referência usa país). Para escola/Brasil, opcional por participante.
- **Recharts** (ou **visx** se quisermos custom) — gráficos de métricas/admin, leve e React-first.
- **Serwist** — service worker do PWA (sucessor moderno de Workbox), offline e push.

### 2.4 **Bracket: construir custom** (decisão)
Avaliei libs prontas — **@g-loot/react-tournament-brackets** (single/double elimination, estrutura simples) e **react-brackets / @oliverlooney/react-brackets** ([npm](https://www.npmjs.com/package/react-brackets), [g-loot](https://github.com/g-loot/react-tournament-brackets)). **Conclusão: usar como referência de layout, mas renderizar custom.** Motivos:
1. O visual "arena" (glass, glows por estado, badges ricos, animação do avanço) é a alma do produto — libs prontas engessam o estilo e não fazem grupos+mata-mata do jeito da escola.
2. Já temos `divisions.ts`, tokens e padrões; o bracket precisa falar a mesma língua.
3. A matemática de layout (posição vertical de cada match por rodada) é simples e fica sob nosso controle (ver §5).

> Fallback de risco: se o custom atrasar, `@g-loot/react-tournament-brackets` cobre eliminatória simples/dupla como ponte temporária.

---

## 3. Arquitetura (Next 16 + Supabase)

### 3.1 Princípios
- **RSC por padrão**: shells, listas estáticas, cabeçalhos = servidor. **Client islands** só para: bracket interativo, realtime, formulários, TV.
- **Streaming + Suspense**: a casca do torneio aparece na hora; o bracket pesado streama.
- **PPR**: partes estáticas pré-renderizadas, partes dinâmicas streamadas.
- **Server Actions** para mutações (criar torneio, lançar placar, avançar chave), com `revalidateTag`.
- **RPC transacional no Postgres** para operações que precisam ser atômicas (gerar bracket, avançar vencedor para `next_match_id`, fechar grupo e semear mata-mata). Evita estados inconsistentes na chave.
- **Realtime** como fonte de verdade da UI ao vivo: canal por torneio → `tournament_matches` → invalida React Query / atualiza store local.

### 3.2 Estrutura de rotas (App Router)
```
src/app/
  (arena)/                      # layout dark/glass unificado
    page.tsx                    # Home v2
    ranking/                    # ranking geral + temporada (realtime)
    partidas/                   # feed social
    noticias/
    perfil/[id]/
    temporadas/
    torneios/                   # NOVO módulo
      page.tsx                  # lista de torneios (ativos/passados)
      [id]/
        page.tsx                # overview do torneio
        chave/page.tsx          # BRACKET ao vivo (client island)
        grupos/page.tsx         # standings de grupos
    regras/
  admin/
    torneios/
      page.tsx                  # criar/editar/encerrar
      [id]/page.tsx             # participantes + lançar resultados + montar chave
    ...(metricas, jogadores, partidas, temporadas, configuracoes, logs)
  tv/                           # modo projeção (ranking | torneio | now-playing)
  api/ (matches, push, health, auth)
  actions/ (admin, torneios, matches)
```

### 3.3 Camada de dados
- `src/lib/queries/` (TanStack) — `use-tournaments.ts`, `use-tournament-bracket.ts`, `use-tournament-standings.ts`, no mesmo padrão de `use-seasons.ts`; `queryKeys` centralizados.
- `src/lib/realtime/` — `use-realtime-bracket.ts` (assina mudanças do torneio).
- Tipos espelhados do Supabase (enums/colunas com o mesmo nome).

---

## 4. Design System **"Arena"** (tokens dark/glass)

### 4.1 Filosofia
Dark profundo + **vidro** + **glow neon por estado** + **roxo de marca** como assinatura. O roxo (`#a421d2`/`#d35eff`) deixa de ser o fundo e passa a ser **acento de energia**; o palco é escuro.

### 4.2 Tokens (Tailwind v4 `@theme`, modo escuro como padrão)
```css
:root {
  /* Palco */
  --arena-bg-1: #0b0612;        /* quase preto arroxeado */
  --arena-bg-2: #150a22;        /* radial central */
  --arena-vignette: #050208;

  /* Superfícies de vidro */
  --glass-bg: color-mix(in srgb, #ffffff 4%, transparent);
  --glass-bg-strong: color-mix(in srgb, #ffffff 7%, transparent);
  --glass-border: color-mix(in srgb, #ffffff 10%, transparent);
  --glass-blur: 14px;

  /* Marca */
  --primary: #c04bff;           /* neon roxo */
  --primary-glow: color-mix(in srgb, #c04bff 55%, transparent);

  /* Acentos por estado (espelham a referência) */
  --state-active:    #22d3ee;   /* ciano  — em andamento / rodada ativa */
  --state-scheduled: #f5a524;   /* âmbar  — agendado / deadline */
  --state-played:    #2dd4a7;   /* verde  — jogado / vitória */
  --state-noshow:    #f43f5e;   /* vermelho — no-show */
  --state-tbd:       #8b8197;   /* neutro — indefinido / aguardando */

  --foreground: #f3ecff;
  --muted-foreground: #b6a8c9;
  --radius: 0.9rem;
}
```

### 4.3 Receitas visuais
- **Card de vidro:** `bg-[--glass-bg] border border-[--glass-border] backdrop-blur-[14px] rounded-2xl` + sombra suave + **glow** condicional à borda quando o estado é "ativo".
- **Glow por estado:** `box-shadow: 0 0 0 1px <state>/30, 0 8px 32px <state>/15`. A coluna/partida ativa pulsa (reusar `@keyframes glow-pulse` que já existe).
- **Fundo de palco:** gradiente radial `--arena-bg-2 → --arena-bg-1` + vinheta + textura de ruído (PNG 1KB tiled, `mix-blend-mode: overlay`, opacity baixa) — mata banding em telas grandes/TV.
- **Glows ambientes** atrás do bracket: 2–3 blobs roxo/ciano desfocados, animação `translate` lenta (ambiente, baixo custo).

### 4.4 Tipografia
- **Display/arena:** fonte variável esportiva para títulos e nomes de fase (ex.: *Clash Display*, *Geist* não basta para o "uau" — avaliar **Space Grotesk** / **Unbounded** para headers). Manter **Geist** no corpo.
- **Números (placar/seed/pontos):** `font-bold tabular-nums` sempre (já é regra do projeto) — zero "pulo" de largura na TV.
- Microtítulos: `text-[11px] font-semibold uppercase tracking-wide text-muted-foreground` (como hoje).

### 4.5 Consistência (regra de ouro mantida)
- **Ranking/posições/divisões:** continuar usando `src/lib/divisions.ts` (`getPlayerStyle`, `getDivisionStyle`, `isTopThree`) — agora adaptado às cores neon do dark.
- **Reusar > inventar**: catálogo de componentes em `src/components/ui` repaginado para vidro, mas mesma API.

---

## 5. Anatomia do Bracket (o componente-herói)

### 5.1 Composição
```
<BracketCanvas>            // pan/zoom, fit-to-screen, minimap (brackets grandes)
  <BracketColumn round=Quarterfinal>
    <RoundHeader title deadline statusPill />
    <MatchCard status="played" time>
      <ParticipantRow seed flag name score variant=win />
      <ParticipantRow seed flag name score variant=lose />
    </MatchCard>
    ...
  </BracketColumn>
  <BracketConnectors />    // SVG por cima, liga match → next_match
</BracketCanvas>
```

### 5.2 Matemática de layout (sem lib)
- Cada rodada é uma **coluna** (CSS grid/flex). Em uma eliminatória, rodada `r` tem `N/2^(r-1)` partidas.
- **Posição vertical** de uma partida = média das posições das duas partidas que a alimentam (recursão a partir da rodada 1, que é igualmente espaçada). Isso produz exatamente o alinhamento "centralizado" da referência.
- **Conectores:** para cada match com `next_match_id`, desenhar um caminho SVG ortogonal (sai à direita do card, vai até o x do meio entre colunas, sobe/desce, entra no próximo). Path animável (draw-on) e com **pulso GSAP** no avanço.

### 5.3 Estados de partida (todos da referência)
`scheduled` (deadline âmbar) · `active` (glow ciano, pulsa) · `played` (placar, vencedor verde) · `no-show` / `walkover` (badge W/O) · `unscheduled` · `tbd` ("Waiting for upstream…", slots `-`).

### 5.4 Responsividade (mobile → desktop → TV)
- **Mobile:** o canvas vira **scroll horizontal com snap por rodada** + indicador de fase; ou modo "lista por rodada" (accordion) para chaves grandes. Mantém o mobile-first do projeto.
- **Desktop:** bracket inteiro com pan/zoom, minimap quando passa da viewport.
- **TV:** **fit automático** (reusar a lógica de `scale` que já existe em `/tv`) — a chave inteira cabe na tela, type grande, sem chrome.

---

## 6. Funcionalidades de Torneio (todas as fontes do Tourney)

> Inventário completo e fiel do Tourney está na **Parte II §A** (com veredito Replicar/Adaptar/Descartar por item). Abaixo, a visão de produto.

### 6.1 Formatos (motor único, render único)
| Formato | Fase | Descrição |
|---|---|---|
| **Eliminatória simples** (+3º lugar) | MVP | árvore, vencedor avança |
| **Rei da mesa** | MVP | desafiante x rei, reinos consecutivos |
| **Round-robin (todos x todos)** | F2 Escola | tabela de classificação |
| **Grupos + mata-mata** | **F2 Escola (prioritário)** | grupos → top 2 → bracket |
| **Scorecard** (pontos corridos + leaderboard) | F2 | placar acumulado, qualquer joguinho |
| **Americano** (duplas com parceiro rotativo) | F3 | eventos de duplas da escola |
| **Suíço (Swiss)** | F4 | pareamento por pontuação |
| **Dupla eliminação** | F4 | winners + losers bracket |
| **Liga c/ promoção/rebaixamento** | F4 | conecta com as **divisões** existentes |

### 6.2 Participantes & inscrição (essencial)
- **Conta registrada** (vinculada ao perfil) **ou convidado avulso** (só nome). Constraint `user_id IS NOT NULL OR guest_name IS NOT NULL`.
- Busca de usuários (reusar `SearchInput`/cmdk) + campo livre p/ convidados + **bandeira/cor/avatar** opcional.
- **Dois modos de inscrição** (como Tourney): **convite** direto ou **inscrição aberta** com **código de verificação**; **lista de inscritos** com status; limite de vagas.
- **Listas reutilizáveis** de alunos + **merge** de duplicados; **templates** de torneio; **importação por IA** (foto/manuscrito/CSV) na F3.

### 6.3 Fluxo admin
1. Criar torneio (nome, formato, **melhor de N**, vínculo opcional com temporada).
2. Adicionar participantes (registrados + convidados).
3. **Montar chave**: automático (aleatório ou por seed/ELO) com possibilidade de ajuste por **drag-and-drop** (@dnd-kit).
4. Lançar resultados clicando na partida → placar → **RPC avança** o vencedor.
5. Encerrar → coroação do campeão (confete, conquista opcional, notícia no feed).

### 6.4 Fluxo jogador
- Lista de torneios (`/torneios`), bracket ao vivo (`/torneios/[id]/chave`) com **realtime**, standings de grupos, "é a sua vez" via **push**.

### 6.5 Integrações (reuso do que já existe)
`/tv` (projeção), padrões de campeão (celebração/conquista/notícia, como no fim de temporada), `AppShell`, `ConfirmModal` (regra: **toda ação importante tem modal de confirmação**), push.

### 6.6 Integrações futuras (opcionais, fora do MVP)
Conquista `tournament_champion`; pontos de temporada por vencer rachão (configurável); histórico de rachões no perfil.

---

## 7. Catálogo de animações (impacto máximo, leve)

> Todas em `transform`/`opacity` (GPU). `prefers-reduced-motion` desliga o supérfluo. Toggle global "reduzir movimento" nas configurações.

| # | Animação | Onde | Como (leve) |
|---|---|---|---|
| 1 | **Reveal em cascata** do bracket | ao abrir a chave | Motion `staggerChildren` por coluna, `y+opacity`, ~250ms |
| 2 | **Avanço do vencedor** | ao lançar placar | placar preenche → **pulso GSAP viaja pela linha conectora** → nome "voa" para a próxima partida (Motion `layoutId`/AnimatePresence) |
| 3 | **Glow pulse** | partida/rodada ativa | CSS `@keyframes glow-pulse` (já existe), zero JS |
| 4 | **Roll/flip do placar** | mudança de score | número tabular anima de baixo p/ cima |
| 5 | **Coroação do campeão** | fim do torneio | troféu zoom + spotlight + **canvas-confetti** (descartado após) |
| 6 | **Draw-on dos conectores** | primeiro render | SVG `stroke-dashoffset` animado |
| 7 | **Ambient glows** | fundo do palco/TV | blobs desfocados com `translate` lento (parallax sutil) |
| 8 | **Troca de posição no ranking** | realtime/TV | Motion layout (reaproveita o demo de troca já existente em `/tv`) |
| 9 | **Transições de rota** | navegação | View Transitions API (Next 16), custo ~zero |
| 10 | **Now-playing ticker** | TV | auto-rotaciona foco para a partida ativa, GSAP timeline |

---

## 8. Modo TV (cidadão de primeira classe)

`/tv?mode=ranking|torneio|now-playing`:
- **Ranking** (já existe) — manter, repaginar para arena.
- **Torneio** — bracket projetado, fit automático, glows ambientes, destaque na partida ativa, atualização realtime sem reload.
- **Now-playing** — foco rotativo na(s) partida(s) em andamento + próximos confrontos.
- **Sem chrome**, type grande, `tabular-nums`, controle de **escala** (reusar `scale` step já implementado), opção de som (já existe toggle).

---

## 9. Performance ("não pode pesar") — orçamento e regras

**Metas:** 60fps nas animações · **INP < 200ms** · **LCP < 2.5s** · JS de ilha interativa enxuto.

Regras:
1. **Só GPU:** `transform`/`opacity`. Nada de animar `width/height/top/left`. `will-change` cirúrgico.
2. **RSC first:** mandar o mínimo de JS; ilhas de cliente isoladas.
3. **`LazyMotion`** (Motion) + import só das features usadas → bundle menor.
4. **Virtualizar** brackets gigantes e **lazy-mount** colunas fora da viewport.
5. **CSS > JS** para microinterações (usar `tw-animate-css`).
6. **Confete em canvas** descartável; nunca no DOM.
7. **Realtime debounce/coalesce** de eventos para não re-renderizar em rajada.
8. **Imagens/flags em sprite**; sem layout shift (placeholders com `tabular-nums`).
9. **Texture/noise** como 1 PNG pequeno tiled, não SVG pesado.
10. Medir com **Vercel Speed Insights** (já instalado) + Lighthouse na TV (tela grande é o pior caso de banding/repaint).

---

## 10. Modelo de dados (estende o rascunho existente)

Base em `docs/RACHAO_TORNEIOS.md` (`tournaments`, `tournament_participants`, `tournament_matches`). Refinamentos para cobrir **grupos** e **bracket**:

- `tournaments`: `format` enum (`single_elimination|double_elimination|round_robin|groups_knockout|swiss|scorecard|americano|king_of_table|league`), `best_of`, `status` (`draft|registration|active|finished`), `seeding_method` (`standard|pots|sequential|manual|elo`), `registration_mode` (`invite|open`), `verification_code?`, `max_participants?`, `champion_user_id`/`champion_name`, `season_id?`, `template_id?`, `branding?` (jsonb logo/cores), timestamps.
- `tournament_participants`: `seed`, `group_id` (A/B/C), `pot?` (potes), `user_id?` XOR `guest_name`, `flag?`, `avatar?`, `color?`, `signup_status` (`invited|signed_up|confirmed`), `partner_participant_id?` (Americano/duplas).
- `tournament_matches`: `round` (1=final), `bracket` (`winners|losers|group|placement`), `slot` (posição vertical p/ layout), `group_id?`, `participant_a/b_id`, `score_a/b`, `sets?` (jsonb set-a-set p/ timeline), `winner_participant_id`, **`next_match_id`** (+ `next_match_slot`), `status`, `deadline_at?`, `scheduled_at?`, `table_no?`, `started_at?` (timer), timestamps.
- **Listas/templates:** `participant_lists` + `participant_list_items` (listas reutilizáveis de alunos, com merge); `tournament_templates` (config salva p/ criação rápida).
- **View** `tournament_group_standings` (V/D, sets, saldo, pontos) e `tournament_scorecard` (leaderboard de pontos corridos).
- **RPC transacionais:** `generate_bracket(tournament_id, seeding_method)`, `report_match_result(match_id, score_a, score_b)` (avança vencedor atômico + propaga sub-árvore), `close_group_stage(tournament_id)` (semeia mata-mata), `pair_next_swiss_round(tournament_id)`.
- **Realtime:** publicar `tournament_matches`, `tournament_participants` e standings no canal `tournament:<id>`.
- **Guardrails:** tabelas separadas; **sem triggers de ELO/temporada**; **migrations só em arquivo**, usuário aplica.

---

## 11. Roadmap por fases

**Fase 0 — Fundação Arena (design system + base)**
- Tokens "Arena" no Tailwind v4, repaginar `src/components/ui` para vidro, fontes display, fundo/glows, camada de motion (`LazyMotion`, GSAP, confetti), View Transitions. Migrar Home/Ranking/Partidas/Perfil para a nova linguagem **sem tocar** na lógica de ELO/partidas (portar + re-testar).

**Fase 1 — Torneios MVP**
- Migrations (arquivo) + RPCs. Admin: criar torneio (+3º lugar), participantes (registrados+convidados, avatar/bandeira), montar chave (auto + seed ELO + dnd). Público: `/torneios`, `/torneios/[id]/chave` com **bracket custom** + realtime + **espectador read-only**. Lançar placar (1 toque) → avanço animado. Eliminatória simples + **rei da mesa**. PWA offline shell (Serwist).

**Fase 2 — Escola (prioritário)**
- **Grupos + mata-mata** (standings, `close_group_stage`), round-robin, **scorecard**. **Inscrição** (convite + aberta c/ código, lista de inscritos, vagas), **listas reutilizáveis + merge**, **templates**, **seeding por potes**. **Compartilhar link + QR**. TV mode torneio + now-playing.

**Fase 3 — Animações de impacto + recursos ricos**
- Coroação do campeão, ticker da TV, parallax, draw-on conectores, transições de rota. **Americano** (duplas), **timer + match events + timeline** de partida, **importação por IA** (foto/CSV), **export PNG do bracket**, edição colaborativa multi-admin, presets de imagem. Auditoria de performance (Speed Insights/Lighthouse) e acessibilidade.

**Fase 4 — Avançado**
- Dupla eliminação, **Suíço**, **liga c/ promoção/rebaixamento** (ligado às divisões), agendamento por mesa/horário + `.ics` + check-in, branding/workspace da organização, semeação por ELO refinada, conquista `tournament_champion`, pontos de temporada por rachão, histórico no perfil.

---

## 12. Acessibilidade, i18n e qualidade

- **Contraste** em dark (texto `--foreground` sobre vidro; verificar WCAG AA nos badges de estado).
- **`prefers-reduced-motion`** + toggle global.
- **Foco/teclado** nos primitivos Radix; bracket navegável.
- **Português correto** (acentuação) em toda string — regra do projeto.
- **Três estados** sempre (loading com skeletons / vazio / erro) — guia de consistência.
- **Testes:** manter Vitest (unit/integration, **cobrir ELO**) + Playwright (e2e dos fluxos de torneio e da TV).

---

## 13. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Rebuild quebrar ELO/partidas | Portar a matemática **sem alterar**, re-rodar a suíte de testes antes de seguir |
| "Impacto máximo" pesar em devices fracos/TV | Orçamento de performance §9, `prefers-reduced-motion`, medir cedo |
| Bracket custom atrasar | Fallback `@g-loot/react-tournament-brackets` para eliminatória |
| Migrations em prod por engano | **Regra absoluta:** só arquivo, usuário aplica |
| Glassmorphism ilegível em sol/TV | Variante "alto contraste" dos cards de vidro |

---

# PARTE II — Aprofundamento (Tourney como referência máxima)

## A. Inventário COMPLETO do Tourney (fonte: tourneymaker.app + App Store v3.7.3)

> Levantamento exaustivo lido direto da fonte oficial. Objetivo: **replicar praticamente tudo** dentro do contexto do Smash Pong (tênis de mesa, escola/clube, web/PWA, Supabase), com tudo o mais moderno possível. Cada item recebe um veredito: **Replicar** (igual), **Adaptar** (ao nosso contexto), **Descartar** (não faz sentido aqui) — e a fase.

### A.1 Formatos de competição
| Formato | Tourney | Veredito | Fase | Como no Smash Pong |
|---|---|---|---|---|
| Eliminatória simples | ✅ | Replicar | MVP | árvore + 3º lugar |
| Eliminatória dupla | ✅ | Replicar | F4 | winners + losers bracket |
| Fase de grupos | ✅ | Replicar | **F2 (prioritário)** | rachão real da escola |
| Round-robin (todos×todos) | ✅ | Replicar | F2 | tabela |
| Suíço (Swiss) | ✅ | Replicar | F4 | pareamento por pontuação |
| Scorecard (estatística em tabela p/ qualquer jogo) | ✅ | Adaptar | F2 | placar/pontos corridos + leaderboard ao vivo |
| **Americano** (duplas com parceiro rotativo, pontuação individual) | ✅ | Adaptar | F3 | ótimo p/ eventos de **duplas** da escola |
| Championship + disputa de 3º lugar | ✅ | Replicar | MVP | já previsto no bracket |
| Rei da mesa | (nosso) | Manter | MVP | desafiante × rei |
| Promoção/Rebaixamento (modo liga) | ✅ | Adaptar | F4 | conecta com nossas **divisões** (`divisions.ts`) |

### A.2 Semeadura (seeding)
- **Bracket padrão** (1×N): melhor × pior. **Replicar.**
- **Sistema de potes** (estilo Champions): sorteio por potes de força. **Replicar** (F2).
- **Sequencial / ordem livre.** **Replicar.**
- **Ajuste manual drag & drop** (@dnd-kit). **Replicar** (MVP).
- **Por ELO** (diferencial nosso): seed automático pelo ranking geral. **Adicionar.**

### A.3 Participantes (gestão rica — onde o Tourney é forte)
| Recurso Tourney | Veredito | Fase | Como |
|---|---|---|---|
| Conta registrada **ou** convidado avulso | Replicar | MVP | já no modelo (`user_id` XOR `guest_name`) |
| Avatares + nomes + cores customizáveis | Adaptar | F1 | reusar avatar/iniciais do app; cor por participante |
| **100+ presets** de imagem p/ participante/fundo | Adaptar | F3 | galeria enxuta de presets (não 100) |
| **Criador de camisa** (shirt) | Descartar | — | fora do escopo escola |
| **Importação por IA** (foto/manuscrito/CSV/texto → lista) | Adaptar | F3 | **diferencial moderno**: OCR/visão p/ importar lista de alunos manuscrita ou CSV |
| Salvar/carregar listas + **merge** de participantes | Replicar | F2 | listas reutilizáveis de alunos; merge de duplicados |
| Templates de torneio (criação rápida) | Replicar | F2 | salvar config como template |
| Bandeira/país por participante | Adaptar | F1 | opcional (`flag-icons`) — combina com a referência |

### A.4 Inscrição / registro (registration)
- **Dois modos:** (1) **convite** de jogadores específicos; (2) **inscrição aberta** antes do evento, com **código de verificação**. → **Replicar/Adaptar** (F2): inscrição aberta no app + convidados; aproveita nossa auth.
- **Lista de inscritos compartilhada** mostrando status de quem já entrou. → **Replicar** (F2).
- Limite de vagas. → **Adaptar** (F2).

### A.5 Acompanhamento de partida & estatística
| Recurso | Veredito | Fase | Como |
|---|---|---|---|
| Atualizar vencedor/placar com **1 toque** | Replicar | MVP | lançar set/placar rápido |
| **Timer ao vivo** da partida | Adaptar | F3 | cronômetro opcional na TV/admin |
| **Match events** + **timeline interativa** com placar progressivo | Adaptar | F3 | timeline set-a-set / ponto-a-ponto do TT |
| Scoreboards por esporte (dardos 3 modos, baseball, handball, gols/assistências) | Descartar | — | somos **tênis de mesa**; manter scoreboard de **sets** (melhor de N) |
| Marcação automática do vencedor ao lançar placar | Replicar | MVP | RPC define winner + propaga |
| Cálculo automático de pontos/standings | Replicar | F2 | view de standings + realtime |

### A.6 Compartilhamento & espectador
| Recurso | Veredito | Fase | Como |
|---|---|---|---|
| Compartilhar por **link** e **QR code** | Replicar | F2 | link público + QR p/ entrar/assistir |
| Modo **espectador read-only** (sem signup) | Replicar | F1 | `/torneios/[id]/chave` público |
| Edição **colaborativa em tempo real** (vários admins) | Adaptar | F3 | múltiplos admins via realtime (já temos roles) |
| Compartilhar **imagem** do bracket (com fundo) | Adaptar | F3 | exportar PNG do bracket |
| **Embed** em sites | Descartar | — | app interno; baixa prioridade |
| Acesso **web** em qualquer device | Já temos | — | é web/PWA por natureza |

### A.7 Organização / administração
| Recurso | Veredito | Fase | Como |
|---|---|---|---|
| Workspace de organização | Adaptar | F4 | nossa "escola/clube" já é o tenant implícito |
| **Branding** (logo + cores) | Adaptar | F4 | tema configurável (já há `configuracoes`) |
| Múltiplos admins | Já temos | — | roles de admin existentes |
| Gestão de inscrições e detalhes do torneio | Replicar | F1–F2 | telas admin |

### A.8 Agendamento, deadlines, calendário
- **Deadlines por rodada** (a referência: "Deadline 18/06 18:00"). **Replicar** (MVP) → `deadline_at`, badge âmbar.
- **Datas/horários/locais** por partida; **agendar por mesa**. **Adaptar** (F4) → `scheduled_at`, `table_no`.
- **Sync de calendário** (convites .ics no app de calendário). **Adaptar** (F4) → export `.ics` + nosso **push** ("é a sua vez", "deadline chegando").
- **Check-in** antes de começar. **Adaptar** (F4).

### A.9 Dados, offline, backup
- **Offline** + **backup/restore automático** + **sync entre devices**. **Adaptar** (F1): PWA offline (já temos fila de sync de partidas via `match-sync-queue`); Supabase é o backup/cloud; Serwist p/ offline shell.

### A.10 Multi-esporte
- Tourney cobre dezenas de esportes. **Descartar como multi-esporte** — somos tênis de mesa. **Mas** o motor (formatos, brackets, standings, scorecard genérico) fica **agnóstico**, então rachões de outros joguinhos da escola caberiam sem reescrever.

### A.11 Estados de partida (exatamente os da referência visual)
`Played 17/06 19:15` · `No-show` · `Unscheduled` · `W/O` (walkover) · `WIN` · slots `-` / `TBD — Waiting for upstream…` · pill de rodada `ACTIVE`. **Replicar 1:1.**

### A.12 O que NÃO replicamos (e por quê)
Criador de camisa · scoreboards de esportes específicos (dardos/baseball/handball) · embed em sites · multi-esporte como produto · planos/preços (Tourney é SaaS pago; nosso app é interno). Tudo isso fica fora — sem prejuízo do "uau".

---

## B. Spec pixel-level da referência (north star)

> Para o `MatchCard` e os conectores nascerem idênticos em proporção ao Tourney. Valores amostrados/estimados da imagem (px de design @1×) — viram tokens, não hardcode.

### B.1 Cores amostradas (aproximadas)
- Palco: `#0e1420`→`#0b0f17` (azul-grafite muito escuro). *Nota: nosso palco será grafite-arroxeado para manter a marca.*
- Card glass: fill `~rgba(255,255,255,0.03)`, borda `~rgba(255,255,255,0.08)`.
- Verde placar/vitória: `~#2ecc71`/`#27ae60`. Âmbar deadline: `~#e0a32e`. Ciano active: `~#22d3ee`/`#2bb8d6`. Vermelho no-show: `~#e35d6a`. Neutro TBD: `~#8b93a7`.

### B.2 Geometria
- Largura do card de partida: **~270px**; raio **~10px**; padding interno **~10–12px**.
- Linha do participante: altura **~38px**; seed em quadradinho **~18px**; bandeira **~16–20px**; caixa de placar **~28×28px** à direita.
- Header "MATCH n" + badge de status: faixa superior **~26px**, `text-[11px] uppercase tracking-wide`.
- Gap vertical entre as 2 partidas de um par: **~24px**; gap entre pares: **~56px** (cresce por rodada).
- **Coluna → coluna:** gap horizontal **~110–130px** (espaço dos conectores).

### B.3 Conector (a “mágica” visual)
- Ortogonal: sai do meio da borda direita do card A e do card B → segmento horizontal curto → encontro vertical no **x médio** entre colunas → segmento horizontal entra no card de destino (no meio vertical do par).
- Stroke **~2px**, cor `rgba(255,255,255,0.18)`; quando a aresta leva a uma partida **ativa**, stroke ganha tint ciano + brilho.
- Implementação: um único `<svg>` absoluto cobrindo o canvas; paths calculados das posições reais (ResizeObserver/refs), não hardcoded → responsivo e animável (`stroke-dashoffset` para draw-on; `MotionPathPlugin` p/ o pulso).

---

## C. Especificação de movimento (durações, easing, springs)

> "Impacto máximo, sem pesar." Padrões concretos para não virar enfeite aleatório. Tudo `transform`/`opacity`. `prefers-reduced-motion` → fica só o essencial (estado final imediato).

| Animação | Lib | Spec |
|---|---|---|
| Reveal cascata do bracket | Motion | `staggerChildren: 0.04`, item `y: 12→0`, `opacity 0→1`, `duration .28`, ease `[0.22,1,0.36,1]` (easeOutExpo-ish) |
| Avanço do vencedor → próxima partida | React 19.2 ViewTransition (shared `viewTransitionName=participant-<id>`) + Motion fallback | nome "viaja" do slot atual para o slot da próxima; **GSAP** dispara pulso na linha (`MotionPath`, `duration .6`, ease `power2.inOut`) |
| Glow pulse (ativo) | CSS | `glow-pulse 1.8s ease-in-out infinite` (já existe) |
| Roll/flip do placar | Motion | spring `{ stiffness: 500, damping: 30 }`, eixo Y, mask overflow |
| Coroação do campeão | GSAP + canvas-confetti | timeline: dim do palco .3 → troféu `scale .6→1` spring → confetti burst 1.2s → settle |
| Draw-on conectores | CSS/Motion | `stroke-dashoffset` `length→0`, `duration .5`, stagger por profundidade |
| Ambient glows (fundo/TV) | CSS | `translate`/`scale` lentíssimo `~12s` linear infinite, `filter: blur(60px)` |
| Troca de posição (ranking/TV) | Motion `layout` | `layout` + spring `{ stiffness: 400, damping: 40 }` |
| Transição de rota | React 19.2 ViewTransition | CSS keyframes co-localizados; cross-fade + slide 8px |
| Now-playing ticker (TV) | GSAP | timeline em loop, foco rotativo na partida ativa |

**Easing padrão do app:** `--ease-arena: cubic-bezier(0.22, 1, 0.36, 1)` (entradas), `--ease-arena-inout: cubic-bezier(0.65,0,0.35,1)` (movimentos).

---

## D. Máquinas de estado

### D.1 Partida (`tournament_matches.status`)
```
pending ──(ambos participantes definidos)──> scheduled
scheduled ──(início)──> in_progress ──(placar lançado)──> finished
scheduled ──(ausência)──> finished(walkover/no-show)
finished ──(admin corrige)──> finished'  // re-render + re-propaga next_match
```
- Ao `finished`, RPC `report_match_result` grava vencedor e **propaga** para `next_match_id`/`next_match_slot` atomicamente. Corrigir um resultado **invalida e recalcula** a sub-árvore à frente (com confirmação — `ConfirmModal`).

### D.2 Torneio (`tournaments.status`)
```
draft ──(chave gerada + participantes ok)──> active ──(final decidida)──> finished
finished ──(reabrir admin)──> active   // espelha o padrão de temporadas (reabrir)
```

---

## E. Contrato de tempo real (Supabase Realtime)

- Canal por torneio: `tournament:<id>`.
- Publica mudanças de `tournament_matches` (INSERT/UPDATE) e `tournament_participants`.
- Cliente (`use-realtime-bracket.ts`): recebe evento → **coalesce** (debounce ~150ms p/ rajada de propagação) → atualiza cache TanStack → bracket reanima só os nós alterados (`layout`/shared-element).
- TV assina o mesmo canal (read-only) + **Presence** opcional (quantos assistindo).
- Fallback: se WS cair, `refetchOnReconnect` + polling leve (padrão já usado no app).

---

## F. Lista de dependências definitiva (pronta para instalar no "ok")

> No seu aval, instalo tudo de uma vez, sem perguntar lib por lib. Já fixo as escolhas:

**Adicionar:**
```bash
npm i motion@latest gsap@latest canvas-confetti @dnd-kit/core @dnd-kit/sortable \
      react-hook-form zod @hookform/resolvers flag-icons recharts serwist @serwist/next
npm i -D @types/canvas-confetti
```
- `motion` — animação declarativa/layout (ex‑Framer Motion).
- `gsap` — timelines/MotionPath (pulso do conector, coroação, ticker TV).
- `canvas-confetti` (+ types) — celebração.
- `@dnd-kit/*` — seeding/montagem de chave drag-and-drop, acessível.
- `react-hook-form` + `zod` + `@hookform/resolvers` — formulários admin validados (schema compartilhado client/server).
- `flag-icons` — bandeiras dos participantes.
- `recharts` — gráficos de métricas/admin.
- `serwist` + `@serwist/next` — service worker PWA moderno (offline/push).

**Config:** habilitar `viewTransition: true` no `next.config.ts` (View Transitions nativas, sem lib).

**NÃO adicionar** (decisão): nenhuma lib de bracket (render custom); React Spring (Motion cobre); Workbox cru (Serwist é o sucessor). View Transitions = nativo (sem lib).

---

## G. Especificidades de TV (sala/escola)

- **Safe area / overscan:** padding de ~5% nas bordas (TVs antigas cortam) + opção de ajuste fino (reusar o `scale` já existente).
- **Anti burn-in:** deslocamento sutil periódico do layout (1–2px a cada minuto) e brilho moderado em elementos estáticos — importante em telas que ficam horas no mesmo bracket.
- **Legibilidade a distância:** type mínimo grande, `tabular-nums`, contraste reforçado (variante "alto contraste" do glass).
- **Sem interação:** zero chrome, auto-cycle entre ranking/torneio/now-playing, recuperação automática de conexão.
- **Modo claro de emergência:** se a sala tiver muito reflexo, um toggle para fundo menos escuro (acessibilidade).

---

# PARTE III — Diferenciais ("não pensei nisso") — além do Tourney

> O Tourney é genérico e multi-esporte. Nós temos algo que ele **nunca** terá: **ELO, divisões, temporadas, feed social, H2H e um fluxo de confirmação/contestação de partida já testado**. Cruzar torneios com esses ativos cria recursos que a concorrência não tem. Cada um marcado com esforço (S/M/L) e fase.

### III.1 Inteligência de ELO no bracket (o grande diferencial)
- **Barra de probabilidade ao vivo** por partida, estilo "eval bar" do xadrez, calculada do ELO dos dois jogadores (`P(A) = 1/(1+10^((Rb-Ra)/400))`). Atualiza em realtime. **[M · F2]**
- **Detecção de "UPSET" (zebra):** quando um seed/ELO baixo vence um alto, a partida **pulsa dourado**, ganha badge `ZEBRA 🔥` e o **feed social posta automaticamente** ("Maria (#12) eliminou o favorito João (#1)!"). **[S · F2]**
- **Semeadura justa por ELO** com snake/serpentina nos grupos (grupos equilibrados) e opção **"evitar confronto cedo"** entre mesma divisão/mesmo professor. **[M · F2]**
- **Índice de surpresa do torneio:** métrica agregada de quantas zebras rolaram — vira manchete na TV. **[S · F3]**

### III.2 Predições / Bracket Challenge (engajamento viral)
- Antes do mata-mata, **espectadores preenchem o palpite** de quem chega à final (como March Madness). Pontua acertos, **leaderboard de palpiteiros**, badge `Vidente`. Usa o realtime e o sistema de conquistas existente. **[L · F3]**
- "**Quem você acha que ganha?**" rápido por partida (enquete), resultado aparece na TV. **[S · F3]**

### III.3 Score@Table — lançar placar pelo celular, com confiança (reuso do nosso ouro)
- Cada mesa tem um **QR**; o jogador escaneia, abre a partida e lança o set **do próprio celular** — passando pelo **mesmo fluxo de confirmação/contestação já testado** do app. Resolve a maior dor de torneio presencial (admin vira gargalo). Offline-first com a `match-sync-queue` existente. **[M · F2]**
- **Ready-check / "é a sua vez":** push chama os dois jogadores + número da mesa; TV mostra "CHAMANDO: Mesa 3 — João × Maria". **[M · F3]**

### III.4 Modo Narrativa & Recap (Claude por baixo) — "Wrapped" do torneio
- Ao encerrar, geramos um **recap cinematográfico**: o bracket se preenchendo em fast-forward, destaques das zebras, a `road to final` do campeão, e uma **narração curta em PT-BR gerada por LLM** ("Final dramática: Maria virou de 0×2..."). Exportável como vídeo/imagem para compartilhar. **[L · F3]**
- **Comentário automático** por partida no feed (1 frase com humor), opcional. **[M · F3]**
- **OG images dinâmicas** (Next `ImageResponse`): cada torneio/partida compartilhado gera um **card lindo** (não um screenshot torto). A concorrência compartilha print feio; nós geramos arte. **[M · F2]**

### III.5 "Road to Final" & contexto de rivalidade
- Selecionar um jogador **ilumina o caminho dele** na chave (highlight do path até a final). **[S · F2]**
- Quando dois se enfrentam, **overlay de H2H histórico** (já temos o H2H no ranking): "3º encontro — 1×1 no retrospecto". **[S · F3]**
- **Cartela do confronto** na TV antes de partidas-chave (final/semi): foto, divisão, ELO, sequência atual, retrospecto. **[M · F3]**

### III.6 Momentos de hype na TV (transmissão, não slideshow)
- **Detecção de momento decisivo** (match point, final, virada) → TV dá **spotlight automático** na mesa, com som opcional (já há toggle de som). **[M · F3]**
- **Chuva de reações** ao vivo: espectadores mandam emoji do celular (reuso das reações do feed) e eles **caem na TV**. **[M · F3]**
- **Ticker inferior** estilo esportivo: próximos confrontos, últimos resultados, zebra do dia. **[S · F3]**
- **Anti burn-in + ambient** já especificados (§G).

### III.7 Eventos multi-chave (o dia real da escola)
- Um **"Evento"** agrupa **vários torneios/categorias** no mesmo dia (Iniciante/Intermediário/Avançado, ou por divisão), com **uma TV que cicla** entre as chaves e um **placar geral do evento**. O Tourney trata um torneio por vez; nós orquestramos o **dia inteiro**. **[L · F4]**
- **Otimização de mesas:** sugere a próxima partida a chamar minimizando espera (inspirado no TTHub). **[L · F4]**

### III.8 Integração com o ecossistema do app (o que nos torna "plataforma")
- **Conquistas de torneio:** `tournament_champion`, `zebra_master`, `invicto`, `vidente` (palpites). **[S · F3]**
- **Pontos de temporada por desempenho em rachão** (configurável no admin). **[M · F4]**
- **Histórico de torneios no perfil** + troféus na vitrine do jogador. **[M · F3]**
- **Liga ↔ Divisões:** torneio em formato liga pode **promover/rebaixar** divisão de verdade (com confirmação do admin). **[L · F4]**

### III.9 Acessibilidade & inclusão como diferencial
- **Modo daltônico** (estados por ícone+padrão, não só cor), **alto contraste**, **reduzir movimento**, narração por leitor de tela do avanço da chave. A maioria dos apps de torneio ignora isso. **[M · F3]**

> **Resumo do "uau":** ELO ao vivo + zebras automáticas + palpites + score pelo QR no fluxo confiável + recap narrado + TV de transmissão de verdade + orquestração do dia inteiro. Nenhum concorrente junta tudo isso porque nenhum tem a base (ELO/divisões/temporadas/feed/confirmação) que **já existe** aqui.

---

## Fontes (pesquisa 2026)
- [Comparing the best React animation libraries for 2026 — LogRocket](https://blog.logrocket.com/best-react-animation-libraries/)
- [GSAP vs Framer Motion vs React Spring (2026) — Good Fella Lab](https://lab.good-fella.com/blog/gsap-vs-framer-motion-vs-react-spring)
- [@g-loot/react-tournament-brackets](https://github.com/g-loot/react-tournament-brackets) · [react-brackets (npm)](https://www.npmjs.com/package/react-brackets)
- [Next.js 16 (blog oficial)](https://nextjs.org/blog/next-16) · [Server & Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [View Transitions no Next.js 16](https://nextjs.org/docs/app/guides/view-transitions) · [`<ViewTransition>` (React 19.2)](https://react.dev/reference/react/ViewTransition) · [React 19.2 View Transitions — digitalapplied](https://www.digitalapplied.com/blog/react-19-2-view-transitions-animate-navigation-nextjs-16)
- [Tourney — Tournament Maker App](https://www.tourneymaker.app/) · [Tourney (App Store)](https://apps.apple.com/us/app/tourney-tournament-maker-app/id6450659011) · [Score7](https://www.score7.io/) · [TTHub](https://tthubs.com/) · [PLAYINGA — table tennis](https://playinga.com/en/table-tennis-tournament-software/)
- Referência interna: `docs/RACHAO_TORNEIOS.md`, `docs/DESIGN_CONSISTENCIA.md`, `docs/PLANO_TEMPORADAS.md`, `docs/BANCO_DE_DADOS.md`, `CONTEXTO_NEGOCIO.md`.
