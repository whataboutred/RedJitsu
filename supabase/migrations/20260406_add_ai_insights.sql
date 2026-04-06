-- AI Insights cache table
-- Stores cached LLM responses to avoid redundant API calls
create table if not exists public.ai_insights (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  insight_type text not null default 'full',
  content text not null,
  created_at timestamptz not null default now(),
  unique(user_id, insight_type)
);

alter table public.ai_insights enable row level security;

create policy "ai_insights_select_own" on public.ai_insights
  for select using (auth.uid() = user_id);

create policy "ai_insights_insert_own" on public.ai_insights
  for insert with check (auth.uid() = user_id);

create policy "ai_insights_update_own" on public.ai_insights
  for update using (auth.uid() = user_id);

create policy "ai_insights_delete_own" on public.ai_insights
  for delete using (auth.uid() = user_id);
