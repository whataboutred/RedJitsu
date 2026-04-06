-- Personal Records tracking table
CREATE TABLE IF NOT EXISTS public.personal_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  weight numeric NOT NULL,
  reps int NOT NULL,
  estimated_1rm numeric NOT NULL,
  achieved_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pr_user_exercise ON public.personal_records(user_id, exercise_id);

ALTER TABLE public.personal_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pr_select_own" ON public.personal_records
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "pr_insert_own" ON public.personal_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pr_delete_own" ON public.personal_records
  FOR DELETE USING (auth.uid() = user_id);
