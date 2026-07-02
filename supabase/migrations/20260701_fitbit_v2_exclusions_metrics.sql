-- Fitbit connector v2.
-- 1) Import model flips from allowlist to exclusion: everything imports except
--    the excluded activities (plus built-in rules: strength never imports as
--    cardio, walks must earn it with moderate-zone time).
-- 2) workout_metrics: watch metadata (avg HR, calories, active minutes) from
--    Fitbit strength sessions, correlated by time to logged workouts.

alter table public.fitbit_connections
  add column if not exists excluded_activities text[] not null default '{}';

create table if not exists public.workout_metrics (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  source text not null default 'fitbit',
  external_id text not null,
  avg_hr int,
  calories int,
  active_minutes int,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Idempotent imports: one row per Fitbit session per user
create unique index if not exists workout_metrics_user_external_uidx
  on public.workout_metrics(user_id, external_id);
create index if not exists idx_workout_metrics_workout on public.workout_metrics(workout_id);

alter table public.workout_metrics enable row level security;
create policy "workout_metrics_select_own" on public.workout_metrics
  for select using (auth.uid() = user_id);
create policy "workout_metrics_insert_own" on public.workout_metrics
  for insert with check (auth.uid() = user_id);
create policy "workout_metrics_update_own" on public.workout_metrics
  for update using (auth.uid() = user_id);
create policy "workout_metrics_delete_own" on public.workout_metrics
  for delete using (auth.uid() = user_id);

-- Public demo can read the demo account's metrics (same pattern as the other
-- demo read policies; SELECT-only).
create policy "workout_metrics_demo_read" on public.workout_metrics
  for select using (user_id = '581543c1-a23a-4f95-a7ed-c98fb285ece7'::uuid);
