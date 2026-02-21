-- Configuracoes para liberar conquistas de rating somente quando a base estiver madura
INSERT INTO settings (key, value, description)
VALUES
  (
    'achievements_rating_min_players',
    '6',
    'Minimo de jogadores com partidas validadas para liberar conquistas de rating'
  ),
  (
    'achievements_rating_min_validated_matches',
    '20',
    'Minimo de partidas validadas globais para liberar conquistas de rating'
  )
ON CONFLICT (key) DO NOTHING;
