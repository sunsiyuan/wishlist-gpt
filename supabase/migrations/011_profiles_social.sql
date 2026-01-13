-- Add social profile fields (nickname and avatar_name) to existing profiles table
-- v0.9: Social boost feature

alter table public.profiles
  add column if not exists nickname text not null default 'Me',
  add column if not exists avatar_name text not null;

-- Update existing users with default values
-- nickname defaults to 'Me' (already set above)
-- avatar_name: randomly select from Tapback avatar pool (we'll use a placeholder for now)
-- In practice, this should be set during onboarding, but we need a default for existing users
update public.profiles
set avatar_name = 'default'
where avatar_name is null or avatar_name = '';

-- Add comment for documentation
comment on column public.profiles.nickname is 'User display name for social features (non-PII)';
comment on column public.profiles.avatar_name is 'Tapback avatar identifier (e.g., "default", "cat", etc.)';
