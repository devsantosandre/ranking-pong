-- ============================================================================
-- Bloco C (Fase 2) — Inscrição nativa de EVENTO (`event_signups`).
--
-- Uma inscrição = uma pessoa por evento, que escolhe até 2 divisões e paga uma
-- vez. Ao CONFIRMAR (modo `manual`/`free` nesta fase; `gateway`/Mercado Pago na
-- Fase 3), gera 1 `tournament_participants` por divisão (guest_name = full_name,
-- pot = cbtm_rating). Contato/pagamento moram aqui, não em cada participante.
--
-- Os campos de gateway (payment_provider/payment_id) já entram agora para não
-- exigir migration nova na Fase 3.
--
-- ⚠️ NÃO APLICAR automaticamente — o organizador aplica manualmente em HML/PROD.
-- ============================================================================

create table if not exists event_signups (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references tournament_events(id) on delete cascade,
  full_name        text not null,
  email            text,
  phone            text,
  club             text,
  cbtm_affiliated  boolean not null default false,
  cbtm_rating      int,                              -- base do seed (pot)
  divisions        text[] not null,                  -- IDs dos torneios-divisão (máx 2)
  amount_cents     int,                              -- preço × nº de divisões
  payment_mode     text not null default 'manual',   -- gateway | manual | free
  payment_provider text,                             -- 'mercadopago' (Fase 3)
  payment_id       text,                             -- id da cobrança no gateway (Fase 3)
  payment_status   text not null default 'pending',  -- pending | confirmed | rejected | expired
  agreed_rules     boolean not null default false,
  notes            text,
  created_at       timestamptz not null default now(),
  constraint event_signups_divisions_len check (cardinality(divisions) between 1 and 2)
);

create index if not exists event_signups_event on event_signups(event_id);
create index if not exists event_signups_status on event_signups(event_id, payment_status);

-- ── RLS — dados de contato/pagamento são sensíveis; só admin lê/gerencia.
-- (O app opera via service role, que ignora RLS; as políticas protegem acesso
-- direto por usuários não-admin.)
alter table event_signups enable row level security;

create policy "admins gerenciam inscrições"
  on event_signups for all
  using (exists (select 1 from users where id = auth.uid() and role = 'admin'));

notify pgrst, 'reload schema';
