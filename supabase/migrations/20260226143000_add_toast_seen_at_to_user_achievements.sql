-- Marca se a conquista ja foi exibida ao usuario na modal/toast de unlock
ALTER TABLE public.user_achievements
ADD COLUMN IF NOT EXISTS toast_seen_at TIMESTAMPTZ;

-- Evita replay de conquistas historicas ja desbloqueadas antes desta feature
UPDATE public.user_achievements
SET toast_seen_at = COALESCE(toast_seen_at, unlocked_at)
WHERE toast_seen_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_achievements_pending_toasts
ON public.user_achievements (user_id, toast_seen_at, unlocked_at);
