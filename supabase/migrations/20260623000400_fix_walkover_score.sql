-- Corrige walkover: usava placar 1-0 mas report_match_result exige ceil(best_of/2) vitórias.
-- Agora busca best_of do torneio e passa o placar mínimo válido.
create or replace function walkover(p_match uuid, p_winner uuid)
returns tournament_matches language plpgsql security definer
as $$
declare
  v_match   tournament_matches%rowtype;
  v_best_of int;
  v_needed  int;
begin
  if not is_admin_caller() then raise exception 'Acesso negado'; end if;
  select * into v_match from tournament_matches where id = p_match;
  if not found then raise exception 'Partida não encontrada'; end if;
  if v_match.participant_a_id <> p_winner and v_match.participant_b_id <> p_winner then
    raise exception 'Vencedor não está nesta partida';
  end if;
  select best_of into v_best_of from tournaments where id = v_match.tournament_id;
  v_needed := ceil(v_best_of::numeric / 2)::int;
  return report_match_result(
    p_match,
    case when v_match.participant_a_id = p_winner then v_needed else 0 end,
    case when v_match.participant_b_id = p_winner then v_needed else 0 end
  );
end;
$$;
