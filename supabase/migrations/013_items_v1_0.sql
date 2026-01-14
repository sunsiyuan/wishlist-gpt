-- v1.0: Add canonical_url, enrich_attempts, enrich_last_attempt_at to items table
-- canonical_url: cleaned URL for open/share/enrich (fill-only, derived from url_original)
-- enrich_attempts: track number of enrichment attempts (max 3)
-- enrich_last_attempt_at: timestamp of last enrichment attempt

alter table public.items
  add column if not exists canonical_url text,
  add column if not exists enrich_attempts int not null default 0,
  add column if not exists enrich_last_attempt_at timestamptz;

-- Note: canonical_url will be populated gradually via POST /items and cron jobs
-- No need to backfill existing items in migration (let cron handle it)
