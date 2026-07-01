-- ─────────────────────────────────────────────────────────────────────────────
-- Bloco B (desempate oficial ITTF/CBTM) — auto-avanço de grupos vira NO-OP.
--
-- A partir deste bloco, a decisão de QUEM avança dos grupos para o mata-mata é
-- calculada no aplicativo (TypeScript), via `computeGroupStandings`, que aplica
-- o desempate progressivo oficial (pontos → razão de sets → razão de pontos de
-- game, só entre os empatados). Isso garante que a classificação EXIBIDA e os
-- CLASSIFICADOS que efetivamente avançam usem exatamente o mesmo critério.
--
-- A função SQL `tournament_auto_advance_group` usava um critério simplificado
-- (`points desc, saldo desc, sets_won desc`) e poderia promover um jogador
-- diferente do exibido em caso de empate. Para eliminar essa divergência sem
-- reescrever o desempate recursivo em PL/pgSQL, tornamos a função um NO-OP: ela
-- continua sendo chamada por `report_match_result` (não altera a assinatura nem
-- quebra chamadas existentes), mas não faz mais nada. O avanço passa a ser feito
-- por `supabase-repo.advanceGroupQualifiers` logo após lançar o resultado / no
-- `closeGroupStage`.
--
-- ⚠️ NÃO aplicar em produção automaticamente. Validar em HML e aplicar à mão.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function tournament_auto_advance_group(p_tournament uuid, p_group_id text)
returns void
language plpgsql
as $$
begin
  -- No-op: o avanço dos classificados dos grupos é decidido no app (TS/ITTF).
  -- Ver Bloco B — supabase-repo.advanceGroupQualifiers / computeGroupStandings.
  return;
end;
$$;

-- Recarrega o cache de schema do PostgREST
notify pgrst, 'reload schema';
