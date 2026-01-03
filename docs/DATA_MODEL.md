# Data Model (Minimal) / 最少数据表（MVP）

> Spec reference: `docs/MVP_SPEC.md` → “数据模型（最少表）”.

---

## 1) Tables / 表

### 1.1 `items` (Step 1 minimal, implemented)

**Core fields**
- `id` (uuid pk)
- `user_id` (uuid, FK to auth.users.id)
- `url_original` (text)
- `created_at`, `updated_at`

**Indexes**
- unique `(user_id, url_original)`

**Planned next fields (not yet implemented)**
- `url_normalized`, `dedupe_key`, `title`, `image_url`, `rank`, `deleted_at`

### 1.2 `shares`

- `token` (text pk)
- `user_id` (uuid)
- `created_at`
- optional: `expires_at` (if you want expiring links later)

### 1.3 `oauth_codes`

- `code` (text pk)
- `user_id` (uuid)
- `client_id` (text)
- `redirect_uri` (text)
- `expires_at` (timestamptz)
- `used_at` (timestamptz nullable)

### 1.4 `oauth_tokens` (optional but recommended)

- `refresh_token_hash` (text pk)
- `user_id` (uuid)
- `client_id` (text)
- `expires_at`
- `revoked_at` (nullable)
- `created_at`

---

## 2) RLS Policies / 行级权限策略（MVP）

**items**
- SELECT/INSERT/UPDATE/DELETE allowed only when `auth.uid() = user_id`

**shares**
- INSERT allowed only when `auth.uid() = user_id`
- SELECT for share page should be server-side via admin key, or use a dedicated policy for token-based read.

> MVP recommendation: render share page via server route using admin client; do not expose share read via client key.

---

## 3) Migration Plan / 迁移计划

- `supabase/migrations/001_init.sql` creates OAuth tables (`oauth_codes`, `oauth_tokens`) and indexes
- `supabase/migrations/002_items.sql` creates `items` table (minimal fields)
- `supabase/migrations/003_rls.sql` enables RLS and policies (including `items`)
