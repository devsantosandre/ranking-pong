# Suíte de Testes — Ranking Pong

Testa o ambiente **HML self-hosted** (`https://supabase-api.alsstech.com.br` + `https://hml.rankingpong.com.br`) antes da migração para produção.

## Estrutura

```
tests/
├── setup.ts                     # Carrega .env.test antes de cada suite Vitest
├── helpers/
│   └── supabase.ts              # Utilitários: adminClient, anonClient, createTestUser…
├── unit/
│   ├── elo.test.ts              # Algoritmo ELO (expectedScore, calculateElo…)
│   └── divisions.test.ts        # Sistema de divisões e ranking visual
├── integration/
│   ├── 01-connectivity.test.ts  # DNS/TLS, Kong gateway, PostgREST, latência
│   ├── 02-auth.test.ts          # Cadastro, login, logout, persistência de sessão
│   ├── 03-realtime.test.ts      # WebSocket handshake, postgres_changes via Realtime
│   ├── 04-matches-crud.test.ts  # RPC register_match, idempotência, validação, ratings
│   ├── 04b-match-full-flows.test.ts  # Todos os fluxos: confirmação, contestação, inexistente, cancelamento
│   ├── 05-rls-policies.test.ts  # Row Level Security: leitura, escrita, isolamento
│   ├── 06-ranking.test.ts       # Ordenação, conservação de pontos ELO, snapshots
│   ├── 07-achievements.test.ts  # Catálogo seedado, leitura, inserção de conquistas
│   ├── 08-push-notifications.test.ts  # Chaves VAPID, upsert/disable de subscriptions, RLS
│   ├── 09-daily-limits.test.ts  # Incremento de daily_limits, daily_limit_reached
│   ├── 10-admin.test.ts         # Role admin, settings, admin_logs
│   └── 11-performance.test.ts   # Queries principais < 1s (HML self-hosted)
├── e2e/
│   ├── helpers/auth.ts          # createE2EUser, deleteE2EUser, loginViaUI
│   ├── smoke.spec.ts            # Health, login form, redirect anon, PWA manifest
│   ├── auth.spec.ts             # Login ok/fail, sessão, logout
│   ├── matches.spec.ts          # /partidas, /registrar-jogo
│   ├── profile.spec.ts          # /perfil — nome e rating inicial
│   └── ranking.spec.ts          # /ranking — listagem e erros de console
└── reports/
    ├── vitest-results.json
    └── playwright-html/         # gerado após npm run test:e2e
```

## Pré-requisitos

```bash
# Instalar dependências (já feito)
npm install

# Instalar browser do Playwright (já feito)
npx playwright install chromium
```

## Arquivo de configuração

Os testes leem credenciais do **`.env.test`** (não commitado — ver `.gitignore`). Estrutura:

```env
NEXT_PUBLIC_SUPABASE_URL=https://supabase-api.alsstech.com.br
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<vapid_public>
VAPID_PRIVATE_KEY=<vapid_private>
VAPID_SUBJECT=mailto:dev@example.com
APP_BASE_URL=https://hml.rankingpong.com.br
TEST_USER_PASSWORD=Qa!Rank1ng#2026
```

## Executar os testes

```bash
# Testes unitários apenas (sem rede)
npm run test:unit

# Testes de integração (requer acesso ao Supabase HML)
npm run test:integration

# Testes E2E no browser (requer HML online)
npm run test:e2e

# Cobertura de código (unitários)
npm run test:coverage

# Tudo de uma vez
npm run test:all

# Relatório HTML do Playwright (abre no browser)
npx playwright show-report tests/reports/playwright-html
```

## Usuários de teste persistentes (seed)

Para testes manuais na interface HML, crie usuários fixos com senha conhecida:

```bash
# Criar / atualizar usuários seed
npm run test:seed

# Remover usuários seed
npm run test:seed:cleanup
```

Usuários criados (senha: `Pong#QA2026!`):
| E-mail | Role |
|---|---|
| `qa.admin@rankingpong.test` | admin |
| `qa.moderator@rankingpong.test` | moderator |
| `qa.player1@rankingpong.test` | player |
| `qa.player2@rankingpong.test` | player |
| `qa.player3@rankingpong.test` | player |
| `qa.player4@rankingpong.test` | player |
| `qa.rival1@rankingpong.test` | player |
| `qa.rival2@rankingpong.test` | player |

## Resultados da validação HML (2026-05-19)

### Vitest — unitários + integração

| # | Categoria | Testes | Status |
|---|---|---|---|
| 1 | Conectividade Supabase | 5 | ✅ Passou |
| 2 | Autenticação | 5 | ✅ Passou |
| 3 | Realtime / WebSocket | 2 | ✅ Passou |
| 4 | CRUD Partidas (RPC) | 7 | ✅ Passou |
| 4b | Fluxo completo de partidas | 23 | ✅ Passou |
| 5 | RLS Policies | 7 | ✅ Passou |
| 6 | Ranking / ELO | 3 | ✅ Passou |
| 7 | Conquistas | 3 | ✅ Passou |
| 8 | Push Notifications / VAPID | 4 | ✅ Passou |
| 9 | Daily Limits | 2 | ✅ Passou |
| 10 | Admin / admin_logs | 4 | ✅ Passou |
| 11 | Performance (< 1s HML) | 4 | ✅ Passou |
| — | Unitários ELO | 6 | ✅ Passou |
| — | Unitários Divisões | 6 | ✅ Passou |
| **TOTAL** | | **81** | **✅ 81/81** |

### Playwright — E2E

| Spec | Testes | Status |
|---|---|---|
| smoke.spec.ts | 4 | ✅ Passou |
| auth.spec.ts | 4 | ✅ Passou |
| matches.spec.ts | 3 | ✅ Passou |
| profile.spec.ts | 2 | ✅ Passou |
| ranking.spec.ts | 2 | ✅ Passou |
| **TOTAL** | **15** | **✅ 15/15** |

## Achados e recomendações

### ⚠ Achado 1 — UPDATE via JWT anon no PostgREST self-hosted (não bloqueador)
- **Descrição:** UPDATE direto na tabela `users` via supabase-js com JWT do anon key retorna HTTP 200 mas afeta 0 linhas. SELECT com `auth.uid()` funciona normalmente.
- **Impacto:** As server actions do Next.js (SSR com cookies) usam um caminho diferente e não são afetadas. Atualizações de perfil funcionam na app.
- **Investigar:** JWT secret no PostgREST self-hosted pode precisar de sincronização. Testar com `RAISE NOTICE 'uid=%', auth.uid()` em trigger de UPDATE.

### ⚠ Achado 2 — Erros 404/406 no console da página /ranking (não bloqueador)
- **Descrição:** No carregamento de `/ranking`, o console do browser registra 1 erro 404 e 2 erros 406 ("Not Acceptable").
- **Possíveis causas:** JS chunk faltando em HML, Accept header incompatível em alguma chamada ao Supabase REST, ou a política de CORS.
- **Investigar:** Verificar Network tab no browser e identificar qual recurso retorna 404/406.

### ✅ Performance observada (HML self-hosted)
| Query | Latência média |
|---|---|
| Ranking top 20 | ~720ms |
| Matches validadas (p.20) | ~712ms |
| News feed (p.15) | ~310ms |
| Notificações do usuário | ~230ms |

> Nota: latências são maiores que o ambiente cloud Supabase (meta: 500ms). Em produção espera-se metade desses valores.
