BEGIN;

SELECT pg_notification_queue_usage();
NOTIFY pgrst, 'reload schema';

COMMIT;
