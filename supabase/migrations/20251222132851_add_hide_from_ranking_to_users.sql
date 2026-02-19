-- Add hide_from_ranking column to users table
-- This allows users (especially admins) to be hidden from the ranking while still being active
ALTER TABLE users
ADD COLUMN hide_from_ranking boolean NOT NULL DEFAULT false;

-- Add comment to document the purpose
COMMENT ON COLUMN users.hide_from_ranking IS 'When true, user will not appear in ranking queries. Useful for admins who want to observe without participating';

-- Add index for performance on ranking queries
CREATE INDEX idx_users_ranking_visibility ON users(is_active, hide_from_ranking, rating_atual DESC);
