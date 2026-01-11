create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  country_code text not null,
  preferred_language text not null,
  preferred_currency text not null,
  accepted_at timestamptz not null,
  policy_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select
  using (auth.uid() = user_id);

create policy "profiles_insert_own" on public.profiles
  for insert
  with check (auth.uid() = user_id);

create policy "profiles_update_own" on public.profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "profiles_delete_own" on public.profiles
  for delete
  using (auth.uid() = user_id);
