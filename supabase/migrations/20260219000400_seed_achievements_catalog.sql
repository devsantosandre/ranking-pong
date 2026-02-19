BEGIN;

INSERT INTO public.achievements (
  key,
  name,
  description,
  category,
  rarity,
  icon,
  points,
  condition_type,
  condition_value,
  is_active
)
VALUES
  -- 1) Primeiros Passos (Bronze)
  ('primeiro_saque', 'Primeiro Saque', 'Jogou sua primeira partida', 'primeiros_passos', 'bronze', '🎾', 10, 'jogos', 1, true),
  ('primeira_vitoria', 'Primeira Vitória', 'Venceu sua primeira partida', 'primeiros_passos', 'bronze', '🏅', 15, 'vitorias', 1, true),
  ('aquecendo', 'Aquecendo', 'Jogador em desenvolvimento', 'primeiros_passos', 'bronze', '🔥', 25, 'jogos', 25, true),
  ('jogador_regular', 'Jogador Regular', 'Presença constante no ranking', 'primeiros_passos', 'bronze', '📍', 40, 'jogos', 100, true),

  -- 2) Vitórias (Prata)
  ('vencedor', 'Vencedor', 'Primeiras conquistas significativas', 'vitorias', 'prata', '🏆', 50, 'vitorias', 25, true),
  ('experiente', 'Experiente', 'Jogador consistente', 'vitorias', 'prata', '🥈', 75, 'vitorias', 50, true),
  ('vitorias_veterano', 'Veterano', 'Muitas batalhas vencidas', 'vitorias', 'prata', '⚔️', 120, 'vitorias', 100, true),
  ('lenda', 'Lenda', 'Status lendário', 'vitorias', 'prata', '👑', 200, 'vitorias', 200, true),

  -- 3) Sequências (Ouro)
  ('em_chamas', 'Em Chamas', 'Sequência impressionante', 'sequencias', 'ouro', '🔥', 80, 'streak', 5, true),
  ('imparavel', 'Imparável', 'Difícil de parar', 'sequencias', 'ouro', '🚀', 120, 'streak', 7, true),
  ('dominante', 'Dominante', 'Domínio absoluto', 'sequencias', 'ouro', '🦁', 180, 'streak', 12, true),
  ('invencivel', 'Invencível', 'Praticamente imbatível', 'sequencias', 'ouro', '💎', 300, 'streak', 20, true),

  -- 4) Rating/Ranking (Platina)
  ('subindo', 'Subindo', 'Evoluindo no ranking', 'rating', 'platina', '📈', 70, 'rating', 1100, true),
  ('elite', 'Elite', 'Jogador de elite', 'rating', 'platina', '⭐', 120, 'rating', 1300, true),
  ('mestre', 'Mestre', 'Maestria no esporte', 'rating', 'platina', '🎓', 200, 'rating', 1500, true),
  ('top_10', 'Top 10', 'Entre os 10 melhores', 'rating', 'platina', '🔟', 150, 'posicao', 10, true),
  ('podio', 'Pódio', 'No pódio', 'rating', 'platina', '🥉', 220, 'posicao', 3, true),
  ('campeao', 'Campeão', 'O melhor do ranking', 'rating', 'platina', '🥇', 350, 'posicao', 1, true),

  -- 5) Especiais (Diamante)
  ('perfeito', 'Perfeito', 'Vitória sem dar set', 'especiais', 'diamante', '💯', 180, 'perfect', 1, true),
  ('maratonista_dia', 'Maratonista', 'Dia intenso de treino', 'especiais', 'diamante', '🏃', 180, 'jogos_dia', 8, true),
  ('consistente', 'Consistente', 'Alta taxa de vitória', 'especiais', 'diamante', '📊', 220, 'winrate', 65, true),
  ('azarao', 'Azarão', 'Vitória improvável', 'especiais', 'diamante', '🎯', 250, 'underdog', 250, true),

  -- 6) Sociais (Especial)
  ('rivalidade', 'Rivalidade', 'Grande rival', 'sociais', 'especial', '🤜🤛', 120, 'h2h', 10, true),
  ('popular', 'Popular', 'Conhecido na escola', 'sociais', 'especial', '🫂', 160, 'oponentes_unicos', 15, true),
  ('viajante', 'Viajante', 'Jogou contra todos', 'sociais', 'especial', '🌍', 220, 'oponentes_unicos', 30, true),

  -- 7) Veterania (Especial)
  ('novato', 'Novato', 'Bem-vindo!', 'veterania', 'especial', '👋', 20, 'dias_escola', 0, true),
  ('um_mes', '1 Mês', 'Primeiro mês completo', 'veterania', 'especial', '🗓️', 70, 'dias_escola', 30, true),
  ('semestre', 'Semestre', 'Meio ano de dedicação', 'veterania', 'especial', '📚', 130, 'dias_escola', 180, true),
  ('aniversario', 'Aniversário', 'Um ano de história', 'veterania', 'especial', '🎂', 220, 'dias_escola', 365, true),
  ('veterano_escola', 'Veterano', 'Veterano da escola', 'veterania', 'especial', '🏛️', 320, 'dias_escola', 730, true),
  ('lenda_viva', 'Lenda Viva', 'Parte da história', 'veterania', 'especial', '🌟', 450, 'dias_escola', 1095, true),

  -- 8) Atividade (Especial)
  ('ativo', 'Ativo', 'Participação regular', 'atividade', 'especial', '✅', 110, 'semanas_consecutivas', 4, true),
  ('dedicado', 'Dedicado', 'Dedicação ao esporte', 'atividade', 'especial', '🧠', 160, 'semanas_consecutivas', 8, true),
  ('comprometido', 'Comprometido', 'Comprometimento total', 'atividade', 'especial', '🔒', 220, 'semanas_consecutivas', 12, true),
  ('assiduo', 'Assíduo', 'Presença garantida', 'atividade', 'especial', '📆', 240, 'meses_ativos', 6, true),
  ('maratonista_anual', 'Maratonista Anual', 'Um ano inteiro ativo', 'atividade', 'especial', '🏁', 360, 'meses_ativos', 12, true),
  ('frequencia_perfeita', 'Frequência Perfeita', 'Nunca falta', 'atividade', 'especial', '💪', 260, 'semanas_consecutivas', 12, true),

  -- 9) Marcos (Especial)
  ('primeira_semana', 'Primeira Semana', 'Início promissor', 'marcos', 'especial', '🚪', 50, 'primeira_semana', 1, true),
  ('inicio_forte', 'Início Forte', 'Começou com tudo', 'marcos', 'especial', '⚡', 140, 'jogos_primeiro_mes', 20, true),
  ('retorno_triunfal', 'Retorno Triunfal', 'Voltou após ausência', 'marcos', 'especial', '🔁', 180, 'retorno', 30, true)
ON CONFLICT (key)
DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  rarity = EXCLUDED.rarity,
  icon = EXCLUDED.icon,
  points = EXCLUDED.points,
  condition_type = EXCLUDED.condition_type,
  condition_value = EXCLUDED.condition_value,
  is_active = EXCLUDED.is_active;

COMMIT;
