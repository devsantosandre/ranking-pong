-- ============================================================================
-- Bloco C (Fase 2, C1) — Informações do evento + horário/nível por divisão.
--
-- `tournament_events.info` (jsonb): blob flexível white-label com descrição
-- (markdown), prazo, contato, preços, modo de pagamento, premiação, regras.
-- Por divisão (`tournaments`): start_time (ex.: "10h20") e level_description.
--
-- Aditivo/opcional → compatível com eventos e torneios existentes.
--
-- ⚠️ NÃO APLICAR automaticamente — o organizador aplica manualmente em HML/PROD.
-- ============================================================================

alter table tournament_events add column if not exists info jsonb;

alter table tournaments add column if not exists start_time        text;
alter table tournaments add column if not exists level_description text;

notify pgrst, 'reload schema';
