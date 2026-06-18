-- ============================================================
-- Torneios — Realtime Publication + Views
-- NÃO APLICAR DIRETAMENTE — somente via banco local/HML
-- ============================================================

-- Publicar mudanças de tournament_matches para realtime
alter publication supabase_realtime add table tournament_matches;
alter publication supabase_realtime add table tournaments;

-- View de standings de grupo (usada pelo supabase-repo)
create or replace view tournament_standings as
select
  m.tournament_id,
  p.id            as participant_id,
  m.group_id,
  count(*) filter (where m.winner_participant_id = p.id)  as wins,
  count(*) filter (where m.winner_participant_id is not null
                     and m.winner_participant_id <> p.id) as losses,
  coalesce(sum(case when m.participant_a_id = p.id then m.score_a else m.score_b end), 0) as sets_won,
  coalesce(sum(case when m.participant_a_id = p.id then m.score_b else m.score_a end), 0) as sets_lost,
  (count(*) filter (where m.winner_participant_id = p.id)) * 3 as points
from tournament_matches m
join tournament_participants p on (p.id = m.participant_a_id or p.id = m.participant_b_id)
where m.bracket = 'group' and m.status = 'finished'
group by m.tournament_id, p.id, m.group_id;

-- Índice auxiliar para a view
create index on tournament_matches(bracket) where bracket = 'group';
