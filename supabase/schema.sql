-- Таблица прогресса Гео-викторины. Выполнить один раз: Supabase → SQL Editor → New query → Run.
-- Одна строка на аккаунт; читать и менять её может только сам владелец (RLS).
create table if not exists public.progress (
  user_id    uuid primary key default auth.uid() references auth.users on delete cascade,
  settings   jsonb,
  stats      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.progress enable row level security;

drop policy if exists "own progress" on public.progress;
create policy "own progress" on public.progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
