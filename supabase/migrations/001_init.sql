-- WishlistGPT — consolidated initial schema (Apps SDK / MCP).
-- Squashed from the pre-MCP incremental migrations; server-side enrichment and the
-- annotation console were removed, so the item_enrich_runs table and items.enrich_*
-- columns are intentionally gone. Product display fields are supplied by the agent.

-- ---------------------------------------------------------------------------
-- OAuth 2.1 (MCP / Apps SDK)
-- ---------------------------------------------------------------------------

-- Authorization codes (with PKCE + resource/scope binding).
create table if not exists public.oauth_codes (
  code text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  redirect_uri text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  code_challenge text,
  code_challenge_method text,
  resource text,
  scope text
);

create index if not exists oauth_codes_expires_at_idx on public.oauth_codes (expires_at);
create index if not exists oauth_codes_user_id_idx on public.oauth_codes (user_id);

-- Refresh tokens (hashed).
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

-- Dynamically-registered clients (RFC 7591) — ChatGPT self-registers here.
create table if not exists public.oauth_clients (
  client_id text primary key,
  client_name text,
  redirect_uris jsonb not null default '[]'::jsonb,
  grant_types jsonb not null default '["authorization_code","refresh_token"]'::jsonb,
  token_endpoint_auth_method text not null default 'none',
  scope text,
  created_at timestamptz not null default now()
);

create index if not exists oauth_clients_created_at_idx on public.oauth_clients (created_at);

-- ---------------------------------------------------------------------------
-- Items
-- ---------------------------------------------------------------------------

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url_original text not null,
  canonical_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  personal_note text,
  deleted_at timestamptz,
  -- Display fields supplied by the calling agent (title/image/price/merchant).
  display_cover_image_url text,
  display_product_title text,
  display_merchant_logo_url text,
  display_merchant_domain text,
  display_price_amount_minor int,
  display_currency text,
  display_price_text text,
  display_price_updated_at timestamptz,
  unique (user_id, url_original)
);

create index if not exists items_user_id_idx on public.items (user_id);
create index if not exists items_created_at_idx on public.items (created_at desc);
create index if not exists items_user_deleted_created_idx
  on public.items (user_id, deleted_at, created_at desc);

alter table public.items enable row level security;

create policy "items_select_own" on public.items
  for select using (auth.uid() = user_id);
create policy "items_insert_own" on public.items
  for insert with check (auth.uid() = user_id);
create policy "items_update_own" on public.items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "items_delete_own" on public.items
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Shares
-- ---------------------------------------------------------------------------

create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists shares_user_id_idx on public.shares (user_id);
create index if not exists shares_revoked_at_idx on public.shares (revoked_at);
create unique index if not exists shares_user_id_active_unique_idx
  on public.shares (user_id) where revoked_at is null;

-- ---------------------------------------------------------------------------
-- Events (analytics)
-- ---------------------------------------------------------------------------

create table if not exists public.events (
  id bigserial primary key,
  event_name text not null,
  occurred_at timestamptz not null default now(),
  user_id uuid null,
  share_id uuid null,
  client_id text null,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists events_event_name_occurred_at_idx on public.events (event_name, occurred_at);
create index if not exists events_user_id_occurred_at_idx on public.events (user_id, occurred_at);
create index if not exists events_share_id_occurred_at_idx on public.events (share_id, occurred_at);
create index if not exists events_client_id_occurred_at_idx on public.events (client_id, occurred_at);
create unique index if not exists events_uniq_event_name_request_id
  on public.events (event_name, (meta->>'request_id'));

-- ---------------------------------------------------------------------------
-- Feedback
-- ---------------------------------------------------------------------------

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb
);

create index if not exists feedback_user_created_at_idx on public.feedback (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  country_code text not null,
  preferred_language text not null,
  preferred_currency text not null,
  accepted_at timestamptz not null,
  policy_version text not null,
  nickname text not null default 'Nickname',
  avatar_name text not null, -- legacy preset id (now a secondary fallback)
  avatar_url text, -- uploaded photo (Supabase Storage); takes precedence over preset/monogram
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.profiles.nickname is 'User display name for social features (non-PII)';
comment on column public.profiles.avatar_name is 'Tapback avatar identifier (e.g., "default", "cat", etc.)';

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Follows (social)
-- ---------------------------------------------------------------------------

create table if not exists public.follows (
  follower_user_id uuid not null references auth.users(id) on delete cascade,
  list_ref text not null,
  created_at timestamptz not null default now(),
  primary key (follower_user_id, list_ref)
);

create index if not exists follows_follower_user_id_idx on public.follows (follower_user_id);
create index if not exists follows_list_ref_idx on public.follows (list_ref);

alter table public.follows enable row level security;

create policy "follows_select_own" on public.follows
  for select using (auth.uid() = follower_user_id);
create policy "follows_insert_own" on public.follows
  for insert with check (auth.uid() = follower_user_id);
create policy "follows_delete_own" on public.follows
  for delete using (auth.uid() = follower_user_id);

comment on table public.follows is 'Follow relationships: users following other users wishlists';
comment on column public.follows.list_ref is 'List reference in format "u:<owner_user_id>"';

-- ---------------------------------------------------------------------------
-- Storage: rehosted product cover images (public bucket).
-- Images are fetched once from the agent-provided URL and stored here so links
-- don't expire. Uploads use the service role (bypasses RLS); public read is
-- served via /storage/v1/object/public/item-images/*.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values
  ('item-images', 'item-images', true),
  ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Roles & grants (Supabase).
-- Server-side code uses the service_role key (bypasses RLS) — it needs table grants.
-- The browser uses anon/authenticated, gated by the RLS policies above, and only on the
-- user-owned tables it touches. oauth_*, events and feedback stay server-only (no anon/
-- authenticated grants) since they have no RLS.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

grant select, insert, update, delete on public.items to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, delete on public.follows to authenticated;
