BEGIN;

UPDATE achievements
SET icon = '🏓'
WHERE icon = '🎾';

COMMIT;
