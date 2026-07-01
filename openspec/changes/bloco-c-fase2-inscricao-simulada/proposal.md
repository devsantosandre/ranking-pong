## Why

Hoje as inscrições dos eventos acontecem por **Google Forms** externo, com cabeçalho rico de informações e pagamento manual. O Bloco C substitui isso por uma **experiência nativa de inscrição de evento** (o atleta escolhe até 2 divisões e paga uma vez). Esta é a **Fase 2**: a inscrição inteira **simulada** (modos `manual`/`free`, sem terceiros), para validar o fluxo com o cliente antes de ligar o pagamento automático. O Mercado Pago (modo `gateway`) fica para a **Fase 3**, aditivo — nada aqui precisa ser refeito depois.

## What Changes

Ordem travada **C4 → C1 → C2**:

- **C4 — Seed por rating CBTM:** `potsSeeding(participants)` em `seeding.ts` (ordena por `pot` desc; sem rating vai ao fim), ligado em `generateBracket("pots")` e no `saveSeeding` quando `seedingMethod === "pots"`. `pot = cbtm_rating`.
- **C1 — Página de informações do evento:** coluna `tournament_events.info jsonb` (descrição em markdown, prazo, contato, preços, modo de pagamento, premiação, regras) e por divisão `tournaments.start_time` + `tournaments.level_description`. A página pública `(arena)/eventos/[id]` exibe esse conteúdo + CTA "Inscrever-se". Admin edita via `updateEventInfo`.
- **C2 — Formulário nativo + modelo de inscrição:** nova tabela `event_signups` (inscrição-de-evento → N participações). Página `(arena)/eventos/[id]/inscrever` com os campos do Forms (nome, e-mail, telefone, clube, rating CBTM, até 2 divisões, concordância, observação), validação Zod. Actions `createEventSignup` (modo `free` confirma direto; `manual` fica `pending`), `confirmEventSignup`/`rejectEventSignup` (admin). Confirmar gera 1 `tournament_participant` por divisão (`guest_name`, `pot = cbtm_rating`, casa `user_id` por e-mail). Painel admin de inscrições. **Sem upload de arquivos.**

**Explicitamente fora desta fase (Fase 3):** integração Mercado Pago, cobrança PIX, webhook, segurança de webhook (C.4.1/C.4.2). O modo `gateway` fica **desabilitado/oculto** aqui; o schema de `event_signups` já traz os campos de gateway (`payment_provider/payment_id/payment_status`) para não precisar de migration nova na Fase 3.

## Capabilities

### New Capabilities
- `tournament-seeding-by-rating`: semeadura por pontuação/rating (`pot`), usada pela inscrição e pelo método `pots` de geração de chave.
- `event-info-page`: informações públicas do evento (blob `event.info` + horário/nível por divisão) e sua edição no admin.
- `event-signup`: inscrição nativa de evento (form multi-divisão, entidade `event_signups`, confirmação `manual`/`free` que gera participantes), sem pagamento por gateway nesta fase.

### Modified Capabilities
<!-- Nenhuma spec existente tem requisito alterado. -->

## Impact

- **Migrations (novas, NÃO aplicar em prod):** `event_signups` (com campos de gateway já previstos); `tournament_events.info jsonb`; `tournaments.start_time text` + `level_description text`.
- `src/lib/tournaments/seeding.ts` — `potsSeeding`.
- `src/lib/tournaments/types.ts` + repo (interface, `supabase-repo`, `mock-repo`) — `EventSignup`, `event.info`, campos de divisão, métodos de signup.
- `src/app/actions/tournaments.ts` — `createEventSignup`, `confirmEventSignup`, `rejectEventSignup`, `updateEventInfo`.
- `src/app/(arena)/eventos/[id]/page.tsx` — página pública de informações + CTA.
- `src/app/(arena)/eventos/[id]/inscrever/page.tsx` — form nativo (novo).
- `src/app/admin/eventos/[id]/...` — editor de `info` + painel de inscrições.
- Fonte travada: `docs/PLANO_TORNEIOS_GRUPOS_E_INSCRICAO.md` (Bloco C, C.1–C.10) — Fase 2 = C.9.
