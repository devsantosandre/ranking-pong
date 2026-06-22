-- Disputa de 3º lugar (configurável por torneio).
--
-- true  (padrão ITTF/tênis de mesa): os perdedores das semifinais se enfrentam
--        pelo bronze numa partida extra com bracket = 'placement' (3º × 4º).
-- false: não há disputa; os dois semifinalistas ficam empatados em 3º.
--
-- O valor 'placement' já existe no enum bracket_side (ver 20260617000000_tournaments.sql),
-- então a partida de 3º lugar pode ser inserida em tournament_matches sem nova constraint.

alter table tournaments
  add column if not exists third_place_match boolean not null default true;

comment on column tournaments.third_place_match is
  'Eliminatória: gerar disputa de 3º lugar (partida bracket=placement). Default true (padrão ITTF).';

-- ── FOLLOW-UP (não incluído aqui) ────────────────────────────────────────────
-- Para suporte completo no backend Supabase, a função generate_bracket precisa:
--   1) criar a partida 'placement' (round 1, slot 1) quando third_place_match = true
--      e houver semifinais (n >= 4);
--   2) ao concluir as duas semifinais, preencher os participantes da 'placement'
--      com os PERDEDORES das semis (e recompor em caso de correção).
-- A engine mock (src/lib/tournaments/placement.ts) já implementa essa lógica e é a
-- referência para portar ao PL/pgSQL. Enquanto isso não é feito, o flag é persistido
-- e respeitado pela camada mock (fonte de dados ativa).
