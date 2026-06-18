-- ============================================================================
-- Divisões em torneios (Opção B do docs/ESTUDO_DIVISOES.md)
--
-- Um EVENTO ("dia"/competição guarda-chuva) agrupa várias DIVISÕES.
-- Cada divisão É um torneio independente (linha em `tournaments`) que aponta
-- para o evento. A engine (generate_bracket, report_result, standings, RPCs,
-- realtime) NÃO muda — continua operando por tournament_id.
--
-- Aditivo e backward-compatible: torneio avulso = event_id NULL (comportamento
-- de hoje, intacto).
--
-- ⚠️ NÃO APLICAR automaticamente — o organizador aplica manualmente em HML/PROD.
-- ============================================================================

create table tournament_events (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                 -- "Rachão de Sábado", "Open de Verão"
  event_date  date,                          -- o "dia" do evento
  venue       text,                          -- local (opcional)
  branding    jsonb,                         -- logo/cores compartilhados pelas divisões
  season_id   uuid references seasons(id) on delete set null, -- opcional (divisões não afetam ELO)
  created_by  uuid not null references users(id),
  created_at  timestamptz not null default now()
);

-- Colunas novas em `tournaments` — todas opcionais → compatível com torneios atuais.
alter table tournaments add column event_id       uuid references tournament_events(id) on delete set null;
alter table tournaments add column division_label text;
alter table tournaments add column division_order int not null default 0;

create index on tournaments (event_id, division_order);

-- ── RLS — mesmo padrão das tabelas de torneio ──
alter table tournament_events enable row level security;

-- Evento é visível se tiver ao menos uma divisão pública (active/finished/registration).
create policy "leitura pública de eventos com divisão visível"
  on tournament_events for select
  using (exists (
    select 1 from tournaments t
    where t.event_id = tournament_events.id
    and t.status in ('active','finished','registration')
  ));

create policy "admins gerenciam eventos"
  on tournament_events for all
  using (exists (
    select 1 from users where id = auth.uid() and role = 'admin'
  ));
