BEGIN;

UPDATE achievements
SET icon = '🤝'
WHERE key IN ('rivalidade', 'rivalry');

COMMIT;
