# 11 — Execução & Roadmap

> **Status (2026-06-18):** plano original abaixo, com marcações do que já saiu. O mapa detalhado e atualizado vive em [`12-estado-atual-e-proximos-passos.md`](12-estado-atual-e-proximos-passos.md). Resumo: **F0 ✅ · F1 ✅ · F2 🚧 (núcleo feito) · F3/F4 ⬜**.

## 1. Roadmap por fases
**F0 — Fundação Arena (DS + base) — ✅**
Tokens Arena, repaginar `src/components/ui` para vidro, fontes display, fundo/glows, camada de motion (`LazyMotion`/GSAP/confetti), `viewTransition:true`. Migrar 1 tela piloto (Home) para validar a linguagem. **Sem tocar** ELO/partidas (portar + re-testar). Camada de **repo/mock** (doc 12).

**F1 — Torneios MVP — ✅**
Migrations (arquivo) + RPCs `generate_bracket`/`report_match_result`. Admin: criar torneio (+3º lugar), participantes (registrados+convidados, avatar/bandeira), seeding (auto + ELO + dnd). Público: `/torneios`, `/torneios/[id]/chave` (bracket custom + realtime + espectador read-only). Lançar placar (1 toque) → avanço animado. Eliminatória simples + **rei da mesa**. PWA offline shell (Serwist).

**F2 — Escola (prioritário) — 🚧 núcleo feito**
✅ Grupos + mata-mata (standings, `close_group_stage`), Score@Table (QR na mesa), TV modo torneio. ⬜ round-robin puro, scorecard, inscrição aberta por código ponta a ponta, listas/templates, ELO ao vivo/zebra. Inscrição (convite + aberta c/ código, lista de inscritos, vagas), listas reutilizáveis + merge, templates, seeding por potes. Compartilhar link + QR. **Score@Table** (QR na mesa). ELO ao vivo + zebra. OG images. TV modo torneio + now-playing.

**F3 — Impacto + recursos ricos**
Coroação, ticker TV, parallax, draw-on conectores, transições de rota. Americano, timer + match events + timeline, importação por IA (foto/CSV), export PNG, multi-admin, presets. Palpites/Bracket Challenge, recap narrado (Claude), road-to-final, hype/reações na TV, conquistas de torneio. Auditoria de performance e acessibilidade.

**F4 — Avançado**
Dupla eliminação, Suíço, liga c/ promoção/rebaixamento (↔ divisões), agendamento por mesa/horário + `.ics` + check-in, branding/workspace, eventos multi-chave, otimização de mesas, pontos de temporada por rachão, histórico no perfil.

## 2. Ordem dos primeiros PRs (começar já)
| PR | Entrega | Banco | Status |
|---|---|---|---|
| **PR0** | Fundação Arena: tokens, `glass-card`, `status-pill`, `ambient-glows`, fontes, `viewTransition`, motion. Home piloto. | mock | ✅ |
| **PR1** | Migrations + tipos + mappers + repo (mock+supabase local) + RPC `generate_bracket`/`report_match_result` | local | ✅ (mock; supabase-repo escrito, 🚧 não validado contra banco) |
| **PR2** | Bracket de leitura: `BracketCanvas`/`MatchCard`/conectores + `useTournamentBracket` + realtime (sem admin) | local/mock | ✅ |
| **PR3** | Admin MVP: criar torneio, participantes, seeding (dnd), gerar chave, `ScoreSheet`, avanço animado. Eliminatória + 3º lugar | local | ✅ |
| **PR4** | Rei da mesa + TV modo torneio | local | ✅ |
| **PR5+** | F2: grupos✅/round-robin⬜/scorecard⬜, inscrição🚧, QR✅, Score@Table✅, ELO ao vivo/zebra⬜ | local | 🚧 |
| **PR6** | **Divisões** (estudo pronto, Opção B — ver `ESTUDO_DIVISOES.md`) | mock→local | ⬜ próximo |

## 3. Definition of Done (por PR)
- [ ] Reusa `AppShell`, tokens Arena, `divisions.ts`; três estados (loading/vazio/erro).
- [ ] `tabular-nums` nos números; PT-BR com acentuação; estado por cor **+ ícone**.
- [ ] Ações importantes com `ConfirmModal`; admin logado em `admin_logs`.
- [ ] `prefers-reduced-motion` respeitado; animações só `transform`/`opacity`.
- [ ] Realtime com coalesce; sem layout shift.
- [ ] `npm run lint` + `npm run build` + testes verdes (**inclui suíte de ELO intacta**).
- [ ] Migrations **apenas em arquivo**; rodadas só no **banco local** (nunca HML/PROD); instruções no PR.
- [ ] Lighthouse/Speed Insights dentro do orçamento (`05-performance.md`).
- [ ] Funciona contra **mock** e contra **Supabase local** (repo plugável).

## 4. Estratégia de testes
- **Unit (Vitest):** `bracket-layout` (posições, BYE, conectores), `seeding` (standard/pots/elo/fairness), `win-probability`, desempate de grupos.
- **Integration:** RPCs (`generate_bracket`, `report_match_result` propaga, `revert` limpa sub-árvore, `close_group_stage` semeia) contra **Supabase local**.
- **E2E (Playwright):** criar torneio → participantes → gerar chave → lançar resultados → avanço aparece → encerrar → campeão; inscrição por código; espectador read-only; TV modo torneio.
- **Regressão obrigatória:** suíte de **ELO/partidas** intacta após o port.
- **Visual/perf:** checagem de 60fps no avanço da chave; snapshot do bracket.

## 5. Riscos & mitigação
| Risco | Mitigação |
|---|---|
| Rebuild quebrar ELO/partidas | portar sem alterar matemática + re-rodar testes antes de seguir |
| "Impacto máximo" pesar | orçamento `05`, `prefers-reduced-motion`, medir cedo |
| Bracket custom atrasar | fallback `@g-loot/react-tournament-brackets` p/ eliminatória |
| Poluir bancos existentes | **mock-first + banco local** (doc 12); migrations só em arquivo |
| Glass ilegível em sol/TV | variante alto contraste |

## 6. Critério de "pronto para produção" (por fase)
F1 utilizável num rachão real de eliminatória; F2 cobre o rachão de **grupos da escola** (caso prioritário) ponta a ponta; F3 entrega o "uau"; F4 vira plataforma de eventos.
