BEGIN;

ALTER TABLE public.admin_logs
  ALTER COLUMN admin_id DROP NOT NULL;

COMMENT ON COLUMN public.admin_logs.admin_id IS
  'Admin responsavel pela acao. Pode ser nulo em eventos automaticos do sistema.';

INSERT INTO public.settings (key, value, description)
VALUES (
  'pending_confirmation_deadline_hours',
  '6',
  'Prazo em horas para confirmar ou contestar uma pendencia antes do escalonamento ao admin'
)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.match_confirmation_state (
  match_id uuid PRIMARY KEY REFERENCES public.matches(id) ON DELETE CASCADE,
  responsible_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  initial_deadline_at timestamptz NOT NULL,
  current_deadline_at timestamptz NOT NULL,
  escalated_at timestamptz,
  restriction_active boolean NOT NULL DEFAULT false,
  extension_count integer NOT NULL DEFAULT 0 CHECK (extension_count >= 0),
  extension_granted_at timestamptz,
  extension_granted_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.match_confirmation_state IS
  'Estado corrente do SLA de confirmacao das partidas pendentes.';

CREATE INDEX IF NOT EXISTS idx_match_confirmation_state_responsible_active
  ON public.match_confirmation_state (responsible_user_id, restriction_active, resolved_at);

CREATE INDEX IF NOT EXISTS idx_match_confirmation_state_deadline_open
  ON public.match_confirmation_state (current_deadline_at, resolved_at, escalated_at);

ALTER TABLE public.match_confirmation_state ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'match_confirmation_state'
      AND policyname = 'Users can view own match confirmation state'
  ) THEN
    CREATE POLICY "Users can view own match confirmation state"
      ON public.match_confirmation_state
      FOR SELECT
      TO authenticated
      USING (
        responsible_user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.matches m
          WHERE m.id = match_confirmation_state.match_id
            AND (m.player_a_id = auth.uid() OR m.player_b_id = auth.uid())
        )
      );
  END IF;
END
$$;

DO $$
DECLARE
  v_deadline_hours integer := 6;
BEGIN
  SELECT
    CASE
      WHEN s.value ~ '^[0-9]+$' THEN s.value::integer
      ELSE 6
    END
  INTO v_deadline_hours
  FROM public.settings s
  WHERE s.key = 'pending_confirmation_deadline_hours'
  LIMIT 1;

  v_deadline_hours := LEAST(GREATEST(COALESCE(v_deadline_hours, 6), 1), 168);

  INSERT INTO public.match_confirmation_state (
    match_id,
    responsible_user_id,
    initial_deadline_at,
    current_deadline_at
  )
  SELECT
    m.id,
    CASE
      WHEN m.criado_por = m.player_a_id THEN m.player_b_id
      WHEN m.criado_por = m.player_b_id THEN m.player_a_id
      WHEN latest_pending_event.actor_id = m.player_a_id::text THEN m.player_b_id
      WHEN latest_pending_event.actor_id = m.player_b_id::text THEN m.player_a_id
      ELSE NULL
    END AS responsible_user_id,
    COALESCE(latest_pending_event.occurred_at, m.created_at)
      + make_interval(hours => v_deadline_hours) AS initial_deadline_at,
    COALESCE(latest_pending_event.occurred_at, m.created_at)
      + make_interval(hours => v_deadline_hours) AS current_deadline_at
  FROM public.matches m
  LEFT JOIN LATERAL (
    SELECT
      n.created_at AS occurred_at,
      n.payload ->> 'actor_id' AS actor_id
    FROM public.notifications n
    WHERE n.tipo = 'confirmacao'
      AND n.payload ->> 'match_id' = m.id::text
      AND n.payload ->> 'event' IN ('pending_created', 'pending_transferred')
    ORDER BY n.created_at DESC
    LIMIT 1
  ) AS latest_pending_event ON true
  WHERE m.status IN ('pendente', 'edited')
    AND (
      CASE
        WHEN m.criado_por = m.player_a_id THEN m.player_b_id
        WHEN m.criado_por = m.player_b_id THEN m.player_a_id
        WHEN latest_pending_event.actor_id = m.player_a_id::text THEN m.player_b_id
        WHEN latest_pending_event.actor_id = m.player_b_id::text THEN m.player_a_id
        ELSE NULL
      END
    ) IS NOT NULL
  ON CONFLICT (match_id) DO NOTHING;
END
$$;

COMMIT;
