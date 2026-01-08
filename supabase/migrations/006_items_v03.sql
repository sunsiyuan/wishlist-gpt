alter table public.items
  add column if not exists personal_note text,
  add column if not exists deleted_at timestamptz,
  add column if not exists display_cover_image_url text,
  add column if not exists display_product_title text,
  add column if not exists display_merchant_logo_url text,
  add column if not exists display_merchant_domain text,
  add column if not exists display_price_amount_minor int,
  add column if not exists display_currency text,
  add column if not exists display_price_text text,
  add column if not exists display_price_updated_at timestamptz;

create index if not exists items_user_deleted_created_idx
  on public.items (user_id, deleted_at, created_at desc);
