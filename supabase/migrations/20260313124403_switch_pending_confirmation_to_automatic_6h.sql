BEGIN;

INSERT INTO public.settings (key, value, description)
VALUES (
  'pending_confirmation_deadline_hours',
  '6',
  'Prazo em horas para confirmar ou contestar uma pendência antes da validação automática'
)
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();

COMMENT ON TABLE public.match_confirmation_state IS
  'Estado corrente do prazo de confirmação automática das partidas pendentes.';

DO $$
DECLARE
  v_deadline_hours integer := 6;
BEGIN
  SELECT
    CASE
      WHEN s.value ~ '^[0-9]+$' THEN LEAST(GREATEST(s.value::integer, 1), 168)
      ELSE 6
    END
  INTO v_deadline_hours
  FROM public.settings s
  WHERE s.key = 'pending_confirmation_deadline_hours'
  LIMIT 1;

  UPDATE public.match_confirmation_state AS mcs
  SET
    initial_deadline_at = base.pending_started_at + make_interval(hours => v_deadline_hours),
    current_deadline_at = base.pending_started_at + make_interval(hours => v_deadline_hours),
    escalated_at = NULL,
    restriction_active = false,
    extension_count = 0,
    extension_granted_at = NULL,
    extension_granted_by = NULL,
    updated_at = now()
  FROM (
    SELECT
      m.id AS match_id,
      COALESCE(latest_pending_event.occurred_at, m.created_at) AS pending_started_at
    FROM public.matches m
    LEFT JOIN LATERAL (
      SELECT n.created_at AS occurred_at
      FROM public.notifications n
      WHERE n.tipo = 'confirmacao'
        AND n.payload ->> 'match_id' = m.id::text
        AND n.payload ->> 'event' IN ('pending_created', 'pending_transferred')
      ORDER BY n.created_at DESC
      LIMIT 1
    ) AS latest_pending_event ON true
    WHERE m.status IN ('pendente', 'edited')
  ) AS base
  WHERE mcs.match_id = base.match_id
    AND mcs.resolved_at IS NULL;
END
$$;

COMMIT;
