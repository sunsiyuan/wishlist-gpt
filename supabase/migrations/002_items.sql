create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url_original text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, url_original)
);

create index if not exists items_user_id_idx on public.items (user_id);
create index if not exists items_created_at_idx on public.items (created_at desc);
