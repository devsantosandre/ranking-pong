# 04 — Modernização da Stack

## 1. Base (mantida — já é estado da arte)
| Item | Versão alvo | Papel |
|---|---|---|
| Next.js | 16.x | App Router, Turbopack, RSC, PPR, streaming |
| React | 19.2 | RSC, **View Transitions nativas** |
| Tailwind CSS | v4 | tokens Arena (`@theme` CSS-first) |
| Supabase JS / SSR | 2.x / 0.8 | banco, auth, realtime, RPC |
| TanStack Query | v5 (+persist) | cache cliente |
| Radix UI | 1.x | primitivos acessíveis |
| lucide-react | atual | ícones |
| Vitest / Playwright | atual | testes |
| web-push | atual | notificações |

## 2. Camada nova de **movimento**
| Lib | Por quê | Uso |
|---|---|---|
| **motion** (ex-Framer) | de-facto standard 2026 (~3.6M dl/sem), `AnimatePresence`, **layout animations** | UI declarativa, cascata, troca de posição, nome "voando" |
| **gsap** (+ScrollTrigger, MotionPath) | timelines/controle fino, ~23KB core | **pulso na linha conectora**, coroação, ticker TV |
| **canvas-confetti** | celebração em canvas, descartável | campeão |
| **tw-animate-css** (já presente) | keyframes CSS baratos | microinterações (preferir CSS a JS) |
| **View Transitions nativas** (React 19.2/Next 16) | **sem lib** | transições de rota + shared-element |

> Estratégia: **Motion com `LazyMotion`** (bundle menor, só features usadas), **só em ilhas interativas**. CSS > JS quando possível. GSAP pontual. View Transitions para rota/shared-element reduzem a superfície do Motion.

## 3. Camada nova de **funcionalidade**
| Lib | Papel |
|---|---|
| **@dnd-kit/core + /sortable** | seeding/montagem de chave drag-and-drop, acessível |
| **react-hook-form + zod + @hookform/resolvers** | formulários admin, schema compartilhado client/server |
| **flag-icons** | bandeiras dos participantes |
| **recharts** | gráficos de métricas/admin |
| **serwist + @serwist/next** | service worker PWA moderno (offline/push) |
| **(F3) qrcode** | gerar QR (Score@Table, compartilhar) |

## 4. View Transitions nativas (destaque)
- React 19.2 traz `<ViewTransition>`, `addTransitionType`, `startViewTransition`. Next 16: habilitar `viewTransition:true` no `next.config.ts`.
- **Shared-element**: nomear o elemento (ex.: `view-transition-name: participant-<id>`) faz o navegador animar entre posições antiga/nova — perfeito para o **nome avançando para a próxima partida** e para `card do torneio → header da página`.
- Cobertura ~78% (Chromium + Safari 18); Firefox atrás de flag → **degradação graciosa** (sem transição, conteúdo correto).

## 5. Bracket: **render custom** (decisão)
Avaliadas libs prontas (`@g-loot/react-tournament-brackets`, `react-brackets`). **Conclusão: custom**, usando-as só como referência de layout. Motivo: o visual arena (glass, glows, badges ricos, animação do avanço, grupos+mata-mata) é a alma do produto e libs engessam. **Fallback de risco:** `@g-loot` cobre eliminatória se o custom atrasar.

## 6. O que **NÃO** adicionamos (e por quê)
- Lib de bracket (render custom).
- React Spring (Motion cobre).
- Workbox cru (Serwist é o sucessor).
- Lib de transição de página (View Transitions é nativo).

## 7. Lista de instalação (pronta para o "ok" — instalar de uma vez)
```bash
npm i motion@latest gsap@latest canvas-confetti \
      @dnd-kit/core @dnd-kit/sortable \
      react-hook-form zod @hookform/resolvers \
      flag-icons recharts serwist @serwist/next qrcode
npm i -D @types/canvas-confetti @types/qrcode
```
**Config:** `viewTransition:true` no `next.config.ts`.

## 8. Padrões modernos adotados
- **RSC-first** + **PPR** + **streaming**.
- **Server Actions** + `revalidateTag`.
- **`React.cache`** para deduplicar fetches no servidor.
- **Static > dynamic** quando possível.
- **Zod** como contrato único client/server.
- **Mock-first / repo plugável** (doc 12) — desenvolvimento sem tocar bancos existentes.
