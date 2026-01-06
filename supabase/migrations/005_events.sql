create table if not exists public.events (
  id bigserial primary key,
  event_name text not null,
  occurred_at timestamptz not null default now(),
  user_id uuid null,
  share_id uuid null,
  client_id text null,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists events_event_name_occurred_at_idx
  on public.events (event_name, occurred_at);

create index if not exists events_user_id_occurred_at_idx
  on public.events (user_id, occurred_at);

create index if not exists events_share_id_occurred_at_idx
  on public.events (share_id, occurred_at);

create index if not exists events_client_id_occurred_at_idx
  on public.events (client_id, occurred_at);

create unique index if not exists events_uniq_event_name_request_id
  on public.events (event_name, (meta->>'request_id'));
