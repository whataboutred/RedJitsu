-- Workout programs tables.
-- These already exist in the original production database (they were created
-- via the dashboard); this migration documents them so fresh installs get
-- them too. Everything is idempotent — safe to run against the live project.

create table if not exists public.programs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  is_active boolean not null default false,
  created_at timestamptz default now()
);
alter table public.programs enable row level security;

drop policy if exists "programs_select_own" on public.programs;
create policy "programs_select_own" on public.programs for select using (auth.uid() = user_id);
drop policy if exists "programs_insert_own" on public.programs;
create policy "programs_insert_own" on public.programs for insert with check (auth.uid() = user_id);
drop policy if exists "programs_update_own" on public.programs;
create policy "programs_update_own" on public.programs for update using (auth.uid() = user_id);
drop policy if exists "programs_delete_own" on public.programs;
create policy "programs_delete_own" on public.programs for delete using (auth.uid() = user_id);

create table if not exists public.program_days (
  id uuid primary key default uuid_generate_v4(),
  program_id uuid not null references public.programs(id) on delete cascade,
  name text not null,
  dows int[] default '{}',
  order_index int default 0
);
alter table public.program_days enable row level security;

drop policy if exists "program_days_select_own" on public.program_days;
create policy "program_days_select_own" on public.program_days for select
  using (exists(select 1 from public.programs p where p.id = program_id and p.user_id = auth.uid()));
drop policy if exists "program_days_insert_own" on public.program_days;
create policy "program_days_insert_own" on public.program_days for insert
  with check (exists(select 1 from public.programs p where p.id = program_id and p.user_id = auth.uid()));
drop policy if exists "program_days_update_own" on public.program_days;
create policy "program_days_update_own" on public.program_days for update
  using (exists(select 1 from public.programs p where p.id = program_id and p.user_id = auth.uid()));
drop policy if exists "program_days_delete_own" on public.program_days;
create policy "program_days_delete_own" on public.program_days for delete
  using (exists(select 1 from public.programs p where p.id = program_id and p.user_id = auth.uid()));

create table if not exists public.template_exercises (
  id uuid primary key default uuid_generate_v4(),
  program_day_id uuid not null references public.program_days(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  display_name text not null,
  default_sets int default 3,
  default_reps int default 0,
  set_type text default 'working',
  order_index int default 0
);
alter table public.template_exercises enable row level security;

drop policy if exists "template_exercises_select_own" on public.template_exercises;
create policy "template_exercises_select_own" on public.template_exercises for select
  using (exists(
    select 1 from public.program_days d
    join public.programs p on p.id = d.program_id
    where d.id = program_day_id and p.user_id = auth.uid()
  ));
drop policy if exists "template_exercises_insert_own" on public.template_exercises;
create policy "template_exercises_insert_own" on public.template_exercises for insert
  with check (exists(
    select 1 from public.program_days d
    join public.programs p on p.id = d.program_id
    where d.id = program_day_id and p.user_id = auth.uid()
  ));
drop policy if exists "template_exercises_update_own" on public.template_exercises;
create policy "template_exercises_update_own" on public.template_exercises for update
  using (exists(
    select 1 from public.program_days d
    join public.programs p on p.id = d.program_id
    where d.id = program_day_id and p.user_id = auth.uid()
  ));
drop policy if exists "template_exercises_delete_own" on public.template_exercises;
create policy "template_exercises_delete_own" on public.template_exercises for delete
  using (exists(
    select 1 from public.program_days d
    join public.programs p on p.id = d.program_id
    where d.id = program_day_id and p.user_id = auth.uid()
  ));

create index if not exists idx_programs_user on public.programs(user_id);
create index if not exists idx_program_days_program on public.program_days(program_id);
create index if not exists idx_template_exercises_day on public.template_exercises(program_day_id);
