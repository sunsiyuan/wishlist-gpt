alter table public.item_enrich_runs
  add column if not exists run_group_id uuid not null default gen_random_uuid(),
  add column if not exists strategy text not null default 'unknown';

create index if not exists item_enrich_runs_run_group_id_created_at_idx
  on public.item_enrich_runs (run_group_id, created_at asc);

create index if not exists item_enrich_runs_strategy_created_at_idx
  on public.item_enrich_runs (strategy, created_at desc);

create index if not exists item_enrich_runs_item_id_created_at_idx
  on public.item_enrich_runs (item_id, created_at desc);
