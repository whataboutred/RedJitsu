-- Free-text training context (goals, injuries, preferences) that the user
-- writes for the AI coach. Fed into the insights prompt as untrusted data.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS coach_context TEXT;

COMMENT ON COLUMN public.profiles.coach_context IS
  'User-written goals/injuries/context for AI Coach Insights';
