# 🏓 Smash Pong **Arena** — Plano de Reconstrução

> Pasta-mãe do plano. O app será **reconstruído do zero** com identidade **dark/glassmorphism "arena"** inspirada no **Tourney** (referência máxima), **animações de impacto máximo (sem pesar)**, **modo TV de transmissão** e um **módulo de Torneios completo** que replica o Tourney e vai além.
>
> Estado atual (2026-06-18): **F0 (Fundação Arena) e F1 (Torneios MVP) feitos, F2 (Escola) bem avançado** — tudo mock-first na branch `novo-app`. O mapa vivo de "o que existe vs. o que falta" e os próximos passos estão em **[`12-estado-atual-e-proximos-passos.md`](12-estado-atual-e-proximos-passos.md)** — comece por ele. Os docs 01–11 abaixo são o **estudo/plano original** (referência de design e arquitetura).

## Decisões travadas (2026-06-17)
1. **Escopo:** refazer o app inteiro do zero.
2. **Visual:** unificar tudo no novo dark/glass.
3. **Animações:** impacto máximo (com guarda-rails de performance e `prefers-reduced-motion`).

## Invariantes (não mudam nunca)
- **ELO** e **fluxo hardened de partidas** (`validate_pending_match_v2`, `cancel_match_v2`) são **portados sem alterar a matemática** e **re-testados**.
- **Migrations só em arquivo** — o usuário aplica em HML/PROD manualmente.
- **Desenvolvimento mock-first / banco LOCAL** — nada toca os bancos HML/PROD existentes. Tudo novo nasce contra **mocks** e um **Supabase local** isolado (ver doc 12).
- **Torneios em tabelas próprias**, **sem triggers** de ELO/temporada.
- **Toda ação importante** passa por `ConfirmModal`.
- **PT-BR** com acentuação correta; **reusar > inventar** (`docs/DESIGN_CONSISTENCIA.md`).

## Mapa dos documentos
| # | Documento | Conteúdo |
|---|---|---|
| 01 | [`01-visao-e-produto.md`](01-visao-e-produto.md) | Visão, objetivos, **inventário completo do Tourney** + mapeamento replicar/adaptar/descartar |
| 02 | [`02-arquitetura.md`](02-arquitetura.md) | Next 16/RSC/PPR, rotas, server actions, RPC, **árvore de arquivos**, camadas |
| 03 | [`03-design-system.md`](03-design-system.md) | Tema Arena, **tokens**, glass, tipografia, **anatomia do bracket**, responsividade |
| 04 | [`04-modernizacao-stack.md`](04-modernizacao-stack.md) | Libs escolhidas + porquê, View Transitions, **lista de instalação** |
| 05 | [`05-performance.md`](05-performance.md) | Aceleração: orçamento, regras GPU, virtualização, medição |
| 06 | [`06-animacoes.md`](06-animacoes.md) | Catálogo + **specs de motion** (durações/easing/springs) |
| 07 | [`07-dados-e-backend.md`](07-dados-e-backend.md) | **DDL** completo, enums, tipos TS, **RPCs**, views, RLS, máquinas de estado |
| 08 | [`08-torneios-formatos-e-fluxos.md`](08-torneios-formatos-e-fluxos.md) | Formatos, **seeding**, **algoritmo do bracket**, fluxos admin, edge cases |
| 09 | [`09-diferenciais.md`](09-diferenciais.md) | Recursos **"não pensei nisso"** (ELO ao vivo, zebra, palpites, score@table, recap) |
| 10 | [`10-tv-e-realtime.md`](10-tv-e-realtime.md) | **Modo TV** de transmissão + contrato de **realtime** |
| 11 | [`11-execucao-e-roadmap.md`](11-execucao-e-roadmap.md) | **Fases, PRs, Definition of Done, testes**, ordem de execução |
| 12 | [`12-estado-atual-e-proximos-passos.md`](12-estado-atual-e-proximos-passos.md) | 🟢 **MAPA VIVO** — o que já existe vs. o que falta, backlog ordenado, próximo passo (divisões) |

## Roadmap em uma linha
**F0 ✅** Fundação Arena (DS) → **F1 ✅** Torneios MVP (eliminatória + rei da mesa) → **F2 🚧** Escola (grupos✅/round-robin/scorecard, inscrição, QR✅) → **próximo: Divisões** (estudo pronto) → **F3 ⬜** Animações de impacto + diferenciais (ELO ao vivo, zebra, palpites, recap) → **F4 ⬜** Avançado (dupla elim., Suíço, liga↔divisões, agenda, branding).
