-- BJJ depth: belt rank + promotion history + richer session fields.
alter table public.profiles
  add column if not exists bjj_belt text not null default 'white',
  add column if not exists bjj_stripes int not null default 0;

create table if not exists public.bjj_promotions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  belt text not null,
  stripes int not null default 0,
  promoted_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);
alter table public.bjj_promotions enable row level security;

drop policy if exists bjj_promotions_select_own on public.bjj_promotions;
create policy bjj_promotions_select_own on public.bjj_promotions
  for select using ((select auth.uid()) = user_id);
drop policy if exists bjj_promotions_insert_own on public.bjj_promotions;
create policy bjj_promotions_insert_own on public.bjj_promotions
  for insert with check ((select auth.uid()) = user_id);
drop policy if exists bjj_promotions_delete_own on public.bjj_promotions;
create policy bjj_promotions_delete_own on public.bjj_promotions
  for delete using ((select auth.uid()) = user_id);
drop policy if exists bjj_promotions_demo_read on public.bjj_promotions;
create policy bjj_promotions_demo_read on public.bjj_promotions
  for select using (user_id = '581543c1-a23a-4f95-a7ed-c98fb285ece7'::uuid);

alter table public.bjj_sessions
  add column if not exists rounds int,
  add column if not exists subs_for int,
  add column if not exists subs_against int,
  add column if not exists techniques text[],
  add column if not exists partners text[];

-- Keep the demo athlete a purple belt (with a promotion timeline) after the
-- weekly reseed, which re-inserts the profile at the default belt.
create or replace function public.reseed_demo_full()
returns void language plpgsql security definer set search_path to 'public' as $$
declare d uuid := '581543c1-a23a-4f95-a7ed-c98fb285ece7';
begin
  perform public.reseed_demo();
  update cardio_sessions set source='fitbit', external_id='demo-fb-1',
    notes='Imported from Fitbit · avg HR 138 · 6m vigorous / 19m moderate'
    where user_id=d and activity='Running' and notes='Easy zone-2 around the park.';
  update cardio_sessions set source='fitbit', external_id='demo-fb-2',
    notes='Imported from Fitbit · avg HR 146 · 18m vigorous / 20m moderate'
    where user_id=d and activity='Cycling' and notes='Intervals on the trainer.';
  update cardio_sessions set source='fitbit', external_id='demo-fb-3',
    notes='Imported from Fitbit · avg HR 159 · 17m vigorous / 4m moderate'
    where user_id=d and activity='Rowing' and notes='4x500m, hard.';
  update profiles set bjj_belt='purple', bjj_stripes=2 where id=d;
  delete from bjj_promotions where user_id=d;
  insert into bjj_promotions(user_id, belt, stripes, promoted_at) values
    (d,'blue',0,   now()-interval '900 days'),
    (d,'purple',0, now()-interval '300 days'),
    (d,'purple',2, now()-interval '60 days');
end $$;
