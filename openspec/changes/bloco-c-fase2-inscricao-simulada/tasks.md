## 1. C4 — Seed por rating CBTM (menor e puro; começa aqui)

- [x] 1.1 Teste (`seeding.test.ts`): `potsSeeding` ordena por `pot` desc; sem `pot` vai ao fim; empate estável. (3 testes, 31 no total verdes.)
- [x] 1.2 `potsSeeding(participants)` em `src/lib/tournaments/seeding.ts` (reusa `standardSeeding`).
- [x] 1.3 Ligar o método `pots`: **mock** `generateBracket` ordena a eliminatória por `pot` desc quando `method === "pots"` (sem pot = mais fraco) — testado (`seeding-pots.test.ts`, 2 testes). **SQL:** a RPC `generate_bracket` hoje só tem branch `elo`/`sequential`; o branch `pots` (order by `coalesce(pot,-1) desc`) entra no pacote de migrations da task 2.6, acoplado a quando o `pot` é populado (C2). O `pot` vem de `cbtm_rating` na confirmação da inscrição.

## 2. Migrations (criar; NÃO aplicar em prod)

- [x] 2.1 `<ts>_event_signups.sql`: tabela `event_signups` (com campos de gateway já previstos: `payment_mode/provider/id/status`) + índices + RLS coerente com o resto.
- [x] 2.2 `<ts>_event_info_and_division_fields.sql`: `tournament_events.info jsonb`; `tournaments.start_time text`, `tournaments.level_description text`.
- [x] 2.3 Registrar em memória que as migrations foram criadas e precisam ser aplicadas em HML ([[regra-nunca-aplicar-prod]]).
- [ ] 2.6 Adicionar branch `pots` na RPC `generate_bracket` (order by `coalesce(pot,-1) desc, coalesce(seed,9999), created_at`) — reproduzir a função atual + o branch (migration idempotente, NÃO aplicar). Espelha o mock (task 1.3).

## 3. Tipos e repo

- [x] 3.1 `types.ts`: `EventSignup` (+ `fromRow`), `EventInfo` (blob), campos `startTime`/`levelDescription` em `Tournament`/`DivisionSummary`, `PaymentMode`.
- [x] 3.2 Interface `TournamentRepo`: `updateEventInfo`, `createEventSignup`, `listEventSignups`, `confirmEventSignup`, `rejectEventSignup`.
- [x] 3.3 `mock-repo`: implementar tudo em memória (test-first serve de referência do comportamento).
- [x] 3.4 `supabase-repo`: implementar contra `event_signups` + `tournament_events.info` + campos de divisão.

## 4. C1 — Informações do evento (página pública + edição admin)

- [x] 4.1 Action `updateEventInfo(eventId, info)` com validação Zod (só campos conhecidos; `payment.mode ∈ {manual, free}` nesta fase).
- [x] 4.2 Editor no hub admin do evento (`admin/eventos/[id]/...`) — skill `arena-design-pattern`.
- [x] 4.3 Campos por divisão `start_time`/`level_description` editáveis no admin.
- [x] 4.4 Página pública `(arena)/eventos/[id]`: descrição em markdown **seguro** (HTML escapado), grade de divisões (horário/nível), premiação, prazo, contato, pagamento e CTA "Inscrever-se".

## 5. C2 — Formulário nativo + inscrição

- [x] 5.1 Testes (`mockRepo`): criar signup válido; máx 2 divisões; concordância obrigatória; ≥1 divisão; `free` confirma direto; confirmar gera N participantes com `pot`; idempotência; vínculo por e-mail; `gateway` rejeitado na Fase 2.
- [x] 5.2 Actions: `createEventSignup` (Zod; `free`→confirmado, `manual`→pending, `gateway`→erro Fase 3), `confirmEventSignup`/`rejectEventSignup` (admin), geração idempotente de participantes.
- [x] 5.3 Página `(arena)/eventos/[id]/inscrever` (form multi-divisão, sem upload) — skill `arena-design-pattern`; tela de sucesso "aguardando confirmação".
- [x] 5.4 Painel admin de inscrições do evento (lista + confirmar/rejeitar com `ConfirmModal`).

## 6. Verificação

- [x] 6.1 `npx vitest run` — cenários 1.x e 5.x verdes.
- [x] 6.2 `npm run lint` + `npx tsc --noEmit` limpos nos arquivos tocados; grep §3.1 (tokens) limpo na UI.
- [x] 6.3 `npm run build` sem erros.
- [x] 6.4 `openspec validate bloco-c-fase2-inscricao-simulada` ok.
- [ ] 6.5 **HANDOFF (usuário):** aplicar as migrations em HML e smoke ponta-a-ponta (inscrição `free` e `manual` → admin confirma → participantes gerados com `pot`).
