BEGIN;

WITH legacy_map(legacy_key, canonical_key) AS (
  VALUES
    ('first_match', 'primeiro_saque'),
    ('first_win', 'primeira_vitoria'),
    ('warming_up', 'aquecendo'),
    ('regular_player', 'jogador_regular'),
    ('winner_10', 'vencedor'),
    ('experienced', 'experiente'),
    ('veteran_wins', 'vitorias_veterano'),
    ('legend', 'lenda'),
    ('streak_3', 'em_chamas'),
    ('streak_5', 'imparavel'),
    ('streak_10', 'dominante'),
    ('streak_15', 'invencivel'),
    ('rating_1100', 'subindo'),
    ('rating_1300', 'elite'),
    ('rating_1500', 'mestre'),
    ('top_3', 'podio'),
    ('champion', 'campeao'),
    ('perfect_match', 'perfeito'),
    ('marathon_day', 'maratonista_dia'),
    ('consistent', 'consistente'),
    ('underdog', 'azarao'),
    ('rivalry', 'rivalidade'),
    ('traveler', 'viajante'),
    ('newcomer', 'novato'),
    ('one_month', 'um_mes'),
    ('semester', 'semestre'),
    ('anniversary', 'aniversario'),
    ('veteran_time', 'veterano_escola'),
    ('living_legend', 'lenda_viva'),
    ('active', 'ativo'),
    ('dedicated', 'dedicado'),
    ('committed', 'comprometido'),
    ('perfect_attendance', 'frequencia_perfeita'),
    ('assiduous', 'assiduo'),
    ('annual_marathon', 'maratonista_anual'),
    ('first_week', 'primeira_semana'),
    ('strong_start', 'inicio_forte'),
    ('comeback', 'retorno_triunfal')
),
legacy_to_canonical AS (
  SELECT
    legacy.id AS legacy_id,
    canonical.id AS canonical_id
  FROM legacy_map map
  JOIN achievements legacy ON legacy.key = map.legacy_key
  JOIN achievements canonical ON canonical.key = map.canonical_key
)
INSERT INTO user_achievements (id, user_id, achievement_id, unlocked_at, match_id)
SELECT
  gen_random_uuid(),
  ua.user_id,
  mapping.canonical_id,
  ua.unlocked_at,
  ua.match_id
FROM user_achievements ua
JOIN legacy_to_canonical mapping ON mapping.legacy_id = ua.achievement_id
LEFT JOIN user_achievements existing
  ON existing.user_id = ua.user_id
 AND existing.achievement_id = mapping.canonical_id
WHERE existing.id IS NULL
ON CONFLICT (user_id, achievement_id) DO NOTHING;

WITH legacy_map(legacy_key) AS (
  VALUES
    ('first_match'),
    ('first_win'),
    ('warming_up'),
    ('regular_player'),
    ('winner_10'),
    ('experienced'),
    ('veteran_wins'),
    ('legend'),
    ('streak_3'),
    ('streak_5'),
    ('streak_10'),
    ('streak_15'),
    ('rating_1100'),
    ('rating_1300'),
    ('rating_1500'),
    ('top_3'),
    ('champion'),
    ('perfect_match'),
    ('marathon_day'),
    ('consistent'),
    ('underdog'),
    ('rivalry'),
    ('traveler'),
    ('newcomer'),
    ('one_month'),
    ('semester'),
    ('anniversary'),
    ('veteran_time'),
    ('living_legend'),
    ('active'),
    ('dedicated'),
    ('committed'),
    ('perfect_attendance'),
    ('assiduous'),
    ('annual_marathon'),
    ('first_week'),
    ('strong_start'),
    ('comeback')
)
UPDATE achievements achievement
SET is_active = false
WHERE achievement.key IN (SELECT legacy_key FROM legacy_map)
  AND achievement.is_active = true;

COMMIT;
