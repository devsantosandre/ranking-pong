-- Adicionar valor 'moderator' ao enum player_role
ALTER TYPE player_role ADD VALUE IF NOT EXISTS 'moderator';
