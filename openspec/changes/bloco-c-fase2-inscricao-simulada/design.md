## Context

O app já tem **eventos** (`tournament_events`) que agrupam **divisões** (cada divisão é um `Tournament` com `eventId`). O repo (`TournamentRepo`, impl. `supabaseRepo` + `mockRepo`) já expõe `listEvents/getEvent/createEvent/updateEvent/addDivision`. Participantes têm `pot int` (livre) e `seed`. A página pública `(arena)/eventos/[id]` e o hub admin `admin/eventos/[id]` já existem. Falta: (1) semear por `pot`, (2) conteúdo informativo do evento, (3) inscrição nativa que substitua o Google Forms.

A inscrição real é **de evento**: uma pessoa escolhe até 2 divisões e paga uma vez → modelar uma inscrição (`event_signups`) que, ao confirmar, gera **N participações** (1 por divisão). Contato/pagamento moram na inscrição, não em cada participante.

## Goals / Non-Goals

**Goals (Fase 2 — C4→C1→C2):**
- `potsSeeding` puro e testado; ligado ao método `pots`.
- `event.info jsonb` + `start_time`/`level_description` por divisão; página pública renderiza; admin edita.
- `event_signups` + form nativo multi-divisão (máx 2, concordância obrigatória); actions de criar/confirmar/rejeitar; confirmar gera participantes com `pot = cbtm_rating` e casa `user_id` por e-mail.
- Modos `manual` (admin confirma) e `free` (confirma direto). Fluxo ponta-a-ponta simulável com o cliente.

**Non-Goals:**
- Mercado Pago / cobrança PIX / webhook / segurança de webhook — **Fase 3**. Modo `gateway` fica oculto/inativo.
- Supabase Storage / upload de comprovantes — nunca (decisão de custo).
- Split/marketplace, KYC.

## Decisions

- **`event_signups` já nasce com os campos de gateway** (`payment_mode`, `payment_provider`, `payment_id`, `payment_status`) mesmo sem usá-los na Fase 2 — evita migration nova na Fase 3. Nesta fase: `payment_mode ∈ {manual, free}`; `free` → `payment_status = confirmed` na hora; `manual` → `pending` até o admin confirmar.
- **Confirmar a inscrição gera participantes** (idempotente): para cada divisão, upsert de `tournament_participant` com `guest_name = full_name`, `pot = cbtm_rating`, `signup_status = confirmed`, vinculado ao `Tournament` da divisão. Rejeitar não gera nada. Reconfirmar não duplica.
- **Casar `user_id` por e-mail** quando existir conta — vincula ranking/ELO; senão, convidado (sem login). Login é opcional.
- **`event.info` é um blob jsonb** (white-label friendly) com campos opcionais + descrição markdown; validado por Zod na action, renderizado com um render de markdown seguro. `payment.mode` guardado aqui; credenciais MP **não** entram nesta fase.
- **Seed por `pot`**: `potsSeeding` ordena por `pot` desc (null = -1, vai ao fim) e reaproveita `standardSeeding`. Ligado em `generateBracket("pots")` e no `saveSeeding` quando `seedingMethod === "pots"`.
- **Test-first** na lógica pura/repo com o `mockRepo`: `potsSeeding`, criação de signup (validações), confirmação gera N participantes com `pot`, idempotência, dedupe por e-mail, `free` confirma direto.
- **UI** segue `arena-design-pattern` (ArenaShell/GlassCard/tokens/ConfirmModal); form público e painel admin.

## Risks / Trade-offs

- **[Migrations não aplicadas]** 3 migrations novas criadas mas não aplicadas (regra do projeto). O `mockRepo` cobre a lógica; validação real em HML depois, como nos blocos anteriores.
- **[Blob `info` sem schema rígido]** flexível para white-label, mas exige validação Zod na borda para não gravar lixo. Mitigação: schema Zod parcial + defaults.
- **[Markdown na página pública]** risco de XSS se renderizar HTML cru. Mitigação: usar render de markdown que escapa HTML (sem `dangerouslySetInnerHTML` com input não sanitizado).
- **[Gateway oculto, não removido]** manter os campos/paths inertes pode confundir. Mitigação: `mode gateway` explicitamente bloqueado nas actions da Fase 2 (erro "disponível na Fase 3") e escondido na UI.
- **[Geração de participantes a partir de e-mail]** e-mails repetidos / grafias diferentes. Mitigação: dedupe por `lower(trim(email))`; sem e-mail, trata como convidado distinto.
