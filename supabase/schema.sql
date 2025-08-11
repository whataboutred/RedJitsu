create extension if not exists "uuid-ossp";
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  unit text not null default 'lb',
  weekly_goal int default 4,
  target_weeks int,
  goal_start date,
  bjj_weekly_goal int default 2,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "profiles_read_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_upsert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

create table if not exists public.exercises (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category text check (category in ('barbell','dumbbell','machine','cable','other')) default 'other',
  is_global boolean not null default false,
  owner uuid references auth.users(id),
  created_at timestamptz default now()
);
alter table public.exercises enable row level security;
create policy "exercises_select_all" on public.exercises for select using (true);
create policy "exercises_insert_own" on public.exercises for insert with check (auth.uid() = owner or owner is null);
create policy "exercises_update_own" on public.exercises for update using (auth.uid() = owner);
create policy "exercises_delete_own" on public.exercises for delete using (auth.uid() = owner);

create table if not exists public.workouts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  performed_at timestamptz not null default now(),
  title text,
  note text,
  created_at timestamptz default now()
);
alter table public.workouts enable row level security;
create policy "workouts_select_own" on public.workouts for select using (auth.uid() = user_id);
create policy "workouts_insert_own" on public.workouts for insert with check (auth.uid() = user_id);
create policy "workouts_update_own" on public.workouts for update using (auth.uid() = user_id);
create policy "workouts_delete_own" on public.workouts for delete using (auth.uid() = user_id);

create table if not exists public.workout_exercises (
  id uuid primary key default uuid_generate_v4(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  display_name text not null,
  order_index int default 0
);
alter table public.workout_exercises enable row level security;
create policy "wex_select_own" on public.workout_exercises for select using (exists(select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()));
create policy "wex_insert_own" on public.workout_exercises for insert with check (exists(select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()));
create policy "wex_update_own" on public.workout_exercises for update using (exists(select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()));
create policy "wex_delete_own" on public.workout_exercises for delete using (exists(select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()));

create table if not exists public.sets (
  id uuid primary key default uuid_generate_v4(),
  workout_exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  set_index int not null default 1,
  weight numeric not null default 0,
  reps int not null default 0,
  set_type text not null check (set_type in ('warmup','working')) default 'working',
  created_at timestamptz default now()
);
alter table public.sets enable row level security;
create policy "sets_select_own" on public.sets for select using (exists(select 1 from public.workout_exercises we join public.workouts w on w.id = we.workout_id where we.id = workout_exercise_id and w.user_id = auth.uid()));
create policy "sets_insert_own" on public.sets for insert with check (exists(select 1 from public.workout_exercises we join public.workouts w on w.id = we.workout_id where we.id = workout_exercise_id and w.user_id = auth.uid()));
create policy "sets_update_own" on public.sets for update using (exists(select 1 from public.workout_exercises we join public.workouts w on w.id = we.workout_id where we.id = workout_exercise_id and w.user_id = auth.uid()));
create policy "sets_delete_own" on public.sets for delete using (exists(select 1 from public.workout_exercises we join public.workouts w on w.id = we.workout_id where we.id = workout_exercise_id and w.user_id = auth.uid()));

create index if not exists idx_workouts_user_date on public.workouts(user_id, performed_at desc);
create index if not exists idx_wex_workout on public.workout_exercises(workout_id);
create index if not exists idx_sets_wex on public.sets(workout_exercise_id);

insert into public.exercises (name, category, is_global, owner) values
  ('Barbell Back Squat','barbell',true,null),
  ('Barbell Front Squat','barbell',true,null),
  ('Barbell Bench Press','barbell',true,null),
  ('Barbell Incline Bench Press','barbell',true,null),
  ('Barbell Overhead Press','barbell',true,null),
  ('Barbell Deadlift','barbell',true,null),
  ('Barbell Row','barbell',true,null),
  ('Dumbbell Bench Press','dumbbell',true,null),
  ('Dumbbell Incline Press','dumbbell',true,null),
  ('Dumbbell Shoulder Press','dumbbell',true,null),
  ('Dumbbell Row','dumbbell',true,null),
  ('Dumbbell Romanian Deadlift','dumbbell',true,null),
  ('Lat Pulldown (Cable)','cable',true,null),
  ('Seated Cable Row','cable',true,null),
  ('Triceps Pushdown (Cable)','cable',true,null),
  ('Cable Fly','cable',true,null),
  ('Face Pull (Cable)','cable',true,null),
  ('Chest Press Machine (Flat)','machine',true,null),
  ('Chest Press Machine (Incline)','machine',true,null),
  ('Leg Press Machine','machine',true,null),
  ('Leg Extension Machine','machine',true,null),
  ('Leg Curl Machine','machine',true,null),
  ('Lat Pulldown Machine','machine',true,null),
  ('Row Machine (Plate-Loaded)','machine',true,null)
on conflict do nothing;

create or replace function public.get_history_flat()
returns table (id uuid, performed_at timestamptz, name text, weight numeric, reps int)
language sql security definer set search_path = public as $$
  select s.id, w.performed_at, coalesce(we.display_name, e.name) as name, s.weight, s.reps
  from sets s
  join workout_exercises we on we.id = s.workout_exercise_id
  join workouts w on w.id = we.workout_id
  left join exercises e on e.id = we.exercise_id
  where w.user_id = auth.uid()
$$;
revoke all on function public.get_history_flat() from public;
grant execute on function public.get_history_flat() to authenticated;

create or replace function public.get_volume_by_dow()
returns table (dow text, volume numeric)
language sql security definer set search_path = public as $$
  with base as (
    select w.user_id, extract(dow from w.performed_at)::int as dow, (s.weight*s.reps) as volume
    from workouts w
    join workout_exercises we on we.workout_id = w.id
    join sets s on s.workout_exercise_id = we.id
    where w.user_id = auth.uid()
  )
  select (array['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])[dow+1] as dow, sum(volume) as volume
  from base group by dow order by dow
$$;
revoke all on function public.get_volume_by_dow() from public;
grant execute on function public.get_volume_by_dow() to authenticated;

-- Cardio sessions table
create table if not exists public.cardio_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity text not null,
  duration_minutes int,
  distance numeric,
  distance_unit text check (distance_unit in ('miles','km')) default 'miles',
  intensity text check (intensity in ('low','moderate','high')) default 'moderate',
  calories int,
  notes text,
  performed_at timestamptz not null default now(),
  created_at timestamptz default now()
);
alter table public.cardio_sessions enable row level security;
create policy "cardio_sessions_select_own" on public.cardio_sessions for select using (auth.uid() = user_id);
create policy "cardio_sessions_insert_own" on public.cardio_sessions for insert with check (auth.uid() = user_id);
create policy "cardio_sessions_update_own" on public.cardio_sessions for update using (auth.uid() = user_id);
create policy "cardio_sessions_delete_own" on public.cardio_sessions for delete using (auth.uid() = user_id);
