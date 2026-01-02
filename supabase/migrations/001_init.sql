create table if not exists public.oauth_codes (
  code text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  redirect_uri text not null,
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists oauth_codes_expires_at_idx on public.oauth_codes (expires_at);
create index if not exists oauth_codes_user_id_idx on public.oauth_codes (user_id);

create table if not exists public.oauth_tokens (
  refresh_token_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists oauth_tokens_user_id_idx on public.oauth_tokens (user_id);
create index if not exists oauth_tokens_expires_at_idx on public.oauth_tokens (expires_at);
