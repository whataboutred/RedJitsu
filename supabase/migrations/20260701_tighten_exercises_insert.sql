-- Close the shared-write surface on the exercise catalog: the original policy
-- allowed any authenticated user to insert rows with owner null, which made
-- them global and visible to every user (catalog pollution). User-created
-- exercises must now be owned by their creator and non-global. Seed/global
-- exercises are inserted by the service role, which bypasses RLS.

drop policy if exists "exercises_insert_own" on public.exercises;
create policy "exercises_insert_own" on public.exercises
  for insert with check (auth.uid() = owner and is_global = false);
