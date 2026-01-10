create table if not exists public.item_enrich_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null,
  item_id uuid not null,
  source_url text not null,
  final_applied boolean not null default false,
  final_updates jsonb not null default '{}'::jsonb,
  attempts jsonb not null default '[]'::jsonb
);

create index if not exists item_enrich_runs_item_id_created_at_idx
  on public.item_enrich_runs (item_id, created_at desc);

create index if not exists item_enrich_runs_user_id_created_at_idx
  on public.item_enrich_runs (user_id, created_at desc);

create index if not exists item_enrich_runs_source_url_created_at_idx
  on public.item_enrich_runs (source_url, created_at desc);

alter table public.item_enrich_runs enable row level security;

