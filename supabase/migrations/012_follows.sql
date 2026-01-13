-- Create follows table for v0.9 social boost feature
-- Follows represent users following other users' wishlists

create table if not exists public.follows (
  follower_user_id uuid not null references auth.users(id) on delete cascade,
  list_ref text not null,
  created_at timestamptz not null default now(),
  primary key (follower_user_id, list_ref)
);

-- Indexes for performance
-- Composite unique index (already covered by primary key, but explicit for clarity)
create unique index if not exists follows_follower_list_ref_unique_idx
  on public.follows (follower_user_id, list_ref);

-- Index for querying all follows by a user (for switcher dropdown)
create index if not exists follows_follower_user_id_idx
  on public.follows (follower_user_id);

-- Index for checking follow relationship by list_ref
create index if not exists follows_list_ref_idx
  on public.follows (list_ref);

-- Enable RLS
alter table public.follows enable row level security;

-- RLS Policies
-- Users can view their own follows
create policy "follows_select_own" on public.follows
  for select
  using (auth.uid() = follower_user_id);

-- Users can create their own follows
create policy "follows_insert_own" on public.follows
  for insert
  with check (auth.uid() = follower_user_id);

-- Users can delete their own follows
create policy "follows_delete_own" on public.follows
  for delete
  using (auth.uid() = follower_user_id);

-- Comments for documentation
comment on table public.follows is 'Follow relationships: users following other users wishlists';
comment on column public.follows.follower_user_id is 'User who is following';
comment on column public.follows.list_ref is 'List reference in format "u:<owner_user_id>" (v0.9 only supports user-based lists)';
