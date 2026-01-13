-- Add social profile fields (nickname and avatar_name) to existing profiles table
-- v0.9: Social boost feature

-- Step 1: Add columns as nullable first
alter table public.profiles
  add column if not exists nickname text,
  add column if not exists avatar_name text;

-- Step 2: Update existing users with default values
-- nickname defaults to 'Me'
-- avatar_name: use 'default' as placeholder (should be set during onboarding for new users)
update public.profiles
set 
  nickname = coalesce(nickname, 'Me'),
  avatar_name = coalesce(avatar_name, 'default')
where nickname is null or avatar_name is null;

-- Step 3: Add NOT NULL constraints after data is populated
alter table public.profiles
  alter column nickname set not null,
  alter column nickname set default 'Me',
  alter column avatar_name set not null;

-- Add comment for documentation
comment on column public.profiles.nickname is 'User display name for social features (non-PII)';
comment on column public.profiles.avatar_name is 'Tapback avatar identifier (e.g., "default", "cat", etc.)';
