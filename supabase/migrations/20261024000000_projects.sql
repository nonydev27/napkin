create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  code text not null check (char_length(code) <= 1000000),
  width integer not null check (width between 240 and 2400),
  height integer not null check (height between 320 and 2400),
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists projects_user_created_at_idx
  on public.projects (user_id, created_at desc);

alter table public.projects enable row level security;

create policy "Users can read their projects and public shares"
  on public.projects for select
  to anon, authenticated
  using (is_public or (select auth.uid()) = user_id);

create policy "Users can create their own projects"
  on public.projects for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own projects"
  on public.projects for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own projects"
  on public.projects for delete
  to authenticated
  using ((select auth.uid()) = user_id);
