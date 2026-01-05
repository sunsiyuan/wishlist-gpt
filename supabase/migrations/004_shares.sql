create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists shares_user_id_idx on public.shares (user_id);
create index if not exists shares_revoked_at_idx on public.shares (revoked_at);
create unique index if not exists shares_user_id_active_unique_idx
  on public.shares (user_id)
  where revoked_at is null;
