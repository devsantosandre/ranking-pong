-- ═══════════════════════════════════════════════════════════════════════════
-- VALIDAÇÃO do Bloco A (rodar em HML APÓS aplicar 20260701000000_...byes.sql)
-- ═══════════════════════════════════════════════════════════════════════════
-- NÃO é migration. Cole no SQL Editor do Supabase (HML). Não altera dados.
-- Compara o helper SQL `tournament_seed_qualifiers_into_bracket` com o ground
-- truth gerado pela lógica TS testada (seedQualifiersIntoBracket em Vitest).
-- Formato de cada linha: "pos:grupo:rank" (grupo 0 = BYE). Sucesso = RAISE NOTICE;
-- qualquer divergência = RAISE EXCEPTION apontando o g e o valor obtido.
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare
  v_got text;
  v_exp text;
begin
  -- ── g = 4 (8 classificados, sem byes) ──
  select string_agg(pos || ':' || grp_num || ':' || rnk, ',' order by pos)
    into v_got from tournament_seed_qualifiers_into_bracket(4);
  v_exp := '0:1:0,1:3:1,2:4:0,3:2:1,4:2:0,5:4:1,6:3:0,7:1:1';
  if v_got is distinct from v_exp then
    raise exception 'g=4 divergiu: obtido=% esperado=%', v_got, v_exp;
  end if;

  -- ── g = 6 (12 classificados → bracket 16, 4 byes nos seeds 1..4) ──
  select string_agg(pos || ':' || grp_num || ':' || rnk, ',' order by pos)
    into v_got from tournament_seed_qualifiers_into_bracket(6);
  v_exp := '0:1:0,1:0:0,2:2:1,3:3:1,4:4:0,5:0:0,6:5:0,7:6:1,8:2:0,9:0:0,10:1:1,11:4:1,12:3:0,13:0:0,14:6:0,15:5:1';
  if v_got is distinct from v_exp then
    raise exception 'g=6 divergiu: obtido=% esperado=%', v_got, v_exp;
  end if;

  -- ── g = 8 (16 classificados, sem byes) ──
  select string_agg(pos || ':' || grp_num || ':' || rnk, ',' order by pos)
    into v_got from tournament_seed_qualifiers_into_bracket(8);
  v_exp := '0:1:0,1:7:1,2:8:0,3:2:1,4:4:0,5:6:1,6:5:0,7:3:1,8:2:0,9:8:1,10:7:0,11:1:1,12:3:0,13:5:1,14:6:0,15:4:1';
  if v_got is distinct from v_exp then
    raise exception 'g=8 divergiu: obtido=% esperado=%', v_got, v_exp;
  end if;

  -- ── Primitivo compartilhado (sanidade) ──
  if tournament_standard_order(16) is distinct from
     array[1,16,8,9,4,13,5,12,2,15,7,10,3,14,6,11] then
    raise exception 'tournament_standard_order(16) divergiu do buildStandardOrder TS';
  end if;

  -- ── Propriedades ITTF 3.7 (chaves genéricas para vários g) ──
  -- 1º e 2º do mesmo grupo em metades opostas; vencedor do grupo 1 no topo (pos 0).
  declare g_val int; v_b int; v_bad int; v_top int;
  begin
    foreach g_val in array array[3,4,5,6,7,8] loop
      select count(*) into v_b from tournament_seed_qualifiers_into_bracket(g_val);
      -- vencedor do grupo 1 (rank 0) na posição 0 (topo)
      select pos into v_top from tournament_seed_qualifiers_into_bracket(g_val)
        where grp_num = 1 and rnk = 0;
      if v_top <> 0 then
        raise exception 'g=%: vencedor do grupo 1 não está no topo (pos=%)', g_val, v_top;
      end if;
      -- nenhum grupo com vencedor e 2º na mesma metade
      select count(*) into v_bad from (
        select grp_num,
               max(case when rnk = 0 then (pos >= v_b/2)::int end) as w_half,
               max(case when rnk = 1 then (pos >= v_b/2)::int end) as r_half
        from tournament_seed_qualifiers_into_bracket(g_val)
        where grp_num > 0
        group by grp_num
      ) t where w_half = r_half;
      if v_bad > 0 then
        raise exception 'g=%: % grupo(s) com 1º e 2º na MESMA metade (viola ITTF 3.7)', g_val, v_bad;
      end if;
    end loop;
  end;

  raise notice 'OK — Bloco A validado: helper ITTF 3.7 + byes bate com o ground truth TS.';
end;
$$;
