# 02 — Arquitetura

## 1. Pilares
- **Next.js 16** — App Router, Turbopack, **RSC**, **PPR (Partial Prerendering)**, streaming com Suspense. `params`/`searchParams` são Promises.
- **React 19.2** — Server Components por padrão; **View Transitions nativas** (`<ViewTransition>`, shared-element).
- **Supabase** — Postgres + Auth + **Realtime** + RPC. **Mock-first/local** no desenvolvimento (doc 12).
- **TanStack Query v5** — cache cliente, invalidado por eventos realtime.

## 2. Regra de ouro de renderização
- **RSC por padrão**: cascas, listas estáticas, headers, overview → servidor (zero JS).
- **Client islands** só onde há interatividade/realtime: `BracketCanvas`, `ScoreSheet`, `SeedingBoard`, TV, formulários.
- **Streaming + Suspense**: casca do torneio aparece na hora; bracket pesado streama.
- **PPR**: partes estáticas pré-renderizadas, dinâmicas streamadas.

## 3. Fluxo de dados (mutação)
```
UI (client) ──> Server Action ──> validação zod ──> RPC Postgres (transacional)
                                   │
                                   └─> revalidateTag('tournament:'+id)
Realtime (Postgres → canal) ──> useRealtimeBracket ──> setQueryData ──> re-render animado
```
- **Server Actions** para todas as mutações (criar torneio, lançar placar, avançar chave).
- **RPC transacional** no Postgres para o que precisa ser atômico (gerar bracket, propagar vencedor, fechar grupo) — evita estados inconsistentes na chave.
- **Leitura** via RSC (server) + TanStack Query (client islands), com cache compartilhado por `queryKeys`.

## 4. Camada de dados plugável (mock ↔ real)
> Detalhe completo no doc 12. Resumo: toda leitura/escrita passa por um **repositório** (`TournamentRepo`) com duas implementações — `MockRepo` (em memória/JSON) e `SupabaseRepo` (banco local/HML). Troca por env. Garante desenvolvimento sem tocar HML/PROD.

```
lib/tournaments/repo/
  index.ts            # seleciona impl por env (NEXT_PUBLIC_DATA_SOURCE)
  tournament-repo.ts  # interface
  mock-repo.ts        # dados mockados + seeds determinísticos
  supabase-repo.ts    # contra Supabase local/HML
```

## 5. Estrutura de rotas (App Router)
```
src/app/
  (arena)/
    layout.tsx                 # casca dark/glass + AppShell + <ViewTransition>
    page.tsx                   # Home v2
    ranking/  partidas/  noticias/  perfil/[id]/  temporadas/  regras/
    torneios/
      page.tsx                 # lista (ativos/inscrição/encerrados)
      [id]/
        page.tsx               # overview
        chave/page.tsx         # BracketCanvas + realtime (client island)
        grupos/page.tsx        # standings
        palpites/page.tsx      # bracket challenge (F3)
      inscricao/[code]/page.tsx
  admin/
    torneios/page.tsx
    torneios/[id]/page.tsx     # participantes + seeding + lançar placar
    ...(metricas, jogadores, partidas, temporadas, configuracoes, logs)
  tv/page.tsx                  # mode=ranking|torneio|now-playing
  api/og/torneio/[id]/route.tsx
  actions/tournaments.ts
```

## 6. Árvore de arquivos (módulo)
```
src/
  components/
    arena/      glass-card · status-pill · ambient-glows · halo
    bracket/    bracket-canvas · bracket-column · round-header · match-card ·
                participant-row · bracket-connectors · win-probability-bar · upset-badge
    tournaments/ tournament-card · tournament-list · participant-picker ·
                seeding-board · score-sheet · standings-table · tv-bracket
  lib/
    tournaments/ types · bracket-layout · seeding · win-probability · repo/*
    queries/     use-tournaments · use-tournament · use-tournament-bracket · use-tournament-standings
    realtime/    use-realtime-bracket
  utils/         qr
supabase/migrations/ NNNN_tournaments.sql · NNNN_tournament_rpcs.sql ·
                NNNN_tournament_views.sql · NNNN_tournament_realtime.sql
```

## 7. Server Actions (`app/actions/tournaments.ts`)
```ts
createTournament(input) · updateTournament(id, patch)
addParticipants(id, items[]) · removeParticipant(pid)
saveSeeding(id, order[]) · generateBracket(id, method)
reportResult(matchId, a, b, sets) · revertResult(matchId)
finishTournament(id, championId)
openRegistration(id) · closeRegistration(id)
```
Cada uma: `assertAdmin()`, validação `zod`, `revalidateTag`, log em `admin_logs`.

## 8. Reuso do app atual (não reinventar)
`AppShell` · `ConfirmModal` · padrão de campeão das temporadas (feed/conquista/notícia) · `match-sync-queue` (offline) · `/tv` (escala/som) · `divisions.ts` · `SearchInput`/cmdk · React Query/`queryKeys`.

## 9. Decisões arquiteturais (ADR resumido)
- **Bracket custom** (não lib) — controle total do visual/animação.
- **RPC > lógica no client** para integridade da chave.
- **Repo plugável** — mock-first, sem tocar bancos existentes.
- **View Transitions nativas** — reduz dependência de lib para transições.
- **Realtime como fonte de verdade** da UI ao vivo, com coalesce.
