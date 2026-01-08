# MVP_SPEC

---

# v0.3_SPEC (Consumer minimal UI + Notes + Delete/Undo + Share Sheet)

## 0. 一句话结论 / One-line summary
CN：v0.3 在保持 v0.1 Actions 闭环不变的前提下，新增 `/app` 消费者 UI（轻量单列）、个人备注、软删除 + 撤销，以及分享页展示（只读）。  
EN: v0.3 keeps the v0.1 Actions loop intact and adds the `/app` consumer UI (single column), personal notes, soft delete + undo, and public share display (read-only).

---

## 1. v0.3 UI/UX 摘要 / UI/UX summary

CN：
- `/app` 为移动优先单列列表：顶栏 `WishlistGPT` + `Cheatsheet`，列表顶栏 `Newest/Oldest`（按 `created_at`）+ `Share`。
- 卡片显示：方形封面、标题 + 圆形商家 logo、价格（`?` 提示）、备注预览；点击卡片打开 Decision Sheet。
- Decision Sheet：封面、标题/商家、价格、备注编辑 + 保存；主按钮 `View on website`（使用 `source_url`）；次按钮 `Delete`。
- 删除不确认；删除成功后显示 4s Undo toast（只保证最近一次删除可撤销）。
- Cheatsheet 作为轻量弹层，空状态按钮复用；Return 浮动按钮仅图标。
- v0.3 仅浅色主题。

EN:
- `/app` is a mobile-first single column list: header `WishlistGPT` + `Cheatsheet`, list top bar `Newest/Oldest` (by `created_at`) + `Share`.
- Cards show square cover, title + round merchant logo, price with `?` tooltip, note preview; tapping opens the Decision Sheet.
- Decision Sheet includes cover, title/merchant, price, note editor + save; primary `View on website` (uses `source_url`); secondary `Delete`.
- Delete has no confirmation; on success show 4s Undo toast (only last delete is guaranteed).
- Cheatsheet is a lightweight sheet (empty state uses the same); floating Return button is icon-only.
- v0.3 is light-theme only.

---

## 2. 数据模型变更 / Data model changes

### items (新增字段 / new columns)

* `personal_note` (text)
* `deleted_at` (timestamptz)
* `display_cover_image_url` (text)
* `display_product_title` (text)
* `display_merchant_logo_url` (text)
* `display_merchant_domain` (text)
* `display_price_amount_minor` (int)
* `display_currency` (text)
* `display_price_text` (text)
* `display_price_updated_at` (timestamptz)

CN：列表读取必须过滤 `deleted_at IS NULL`；排序仅基于 `created_at`。  
EN: List reads must filter `deleted_at IS NULL`; ordering uses `created_at` only.

---

## 3. v0.3 新增接口 / New v0.3 endpoints

### 3.1 `PATCH /api/items/:id/note`
Request:
```json
{ "personal_note": "string|null" }
```
Response:
```json
{ "ok": true, "item": { "id": "uuid", "personal_note": "string|null", "updated_at": "timestamptz" } }
```

### 3.2 `POST /api/items/:id/delete`
Response:
```json
{ "ok": true }
```

### 3.3 `POST /api/items/:id/restore`
Response:
```json
{ "ok": true }
```

CN：以上接口仅支持 cookie session；保证幂等。  
EN: These endpoints are cookie-session only and idempotent.

---

## 4. Public Share v0.3 行为 / Public share behavior

CN：
- `/s/:share_id` 只读展示，过滤 `deleted_at IS NULL`。
- 响应严格 allowlist：`display_*`、`personal_note`、`source_url`，不包含 PII。
- 仍保持 revoke 后立即 404。

EN:
- `/s/:share_id` is read-only and filters `deleted_at IS NULL`.
- Response allowlist includes `display_*`, `personal_note`, `source_url` and excludes PII.
- Revoked shares 404 immediately.

---

# v0.1_SPEC (GPT MVP)

## 0. 一句话结论 / One-line summary
CN：MVP v0 只保证 **OAuth bridge + `/me` + `/items` + 可导入的 OpenAPI** 这条闭环，所有接口形态与字段**以当前代码实现为准**。  
EN: MVP v0 only guarantees the closed loop of **OAuth bridge + `/me` + `/items` + importable OpenAPI**, and all shapes/fields follow the current implementation.

---

## 1. MVP 定义（范围）/ MVP Definition (Scope)

### 1.1 目标 / Goals
CN：
- Actions 通过 OAuth Connect 完成授权码流程并拿到 access token
- Actions 使用 Bearer 调 `GET /me` 获取 `user_id + client_id`
- Actions 使用 Bearer 调 `POST /items` 保存 URL、调 `GET /items` 列表
- OpenAPI 合约由模板生成并可被 Actions 导入（驱动上述调用）

EN:
- Actions completes OAuth Connect (authorization-code flow) and obtains an access token
- Actions calls `GET /me` (Bearer) to get `user_id + client_id`
- Actions calls `POST /items` (Bearer) to save a URL and `GET /items` to list items
- OpenAPI contract is generated from a template and importable by Actions (enabling the calls above)

### 1.2 非目标 / Non-goals
CN：以下内容不属于 MVP v0（即使曾经有文档或目录，也不代表已实现）：
- 分享页 / share page
- URL 归一化 / URL normalization
- 更丰富的数据模型、额外 API、排序/删除等扩展能力

EN: The following are NOT part of MVP v0 (legacy docs/folders do not imply implementation):
- Share pages
- URL normalization
- Expanded data model, additional APIs, reorder/delete, etc.

---

## 2. 当前已实现状态（MVP v0）/ Current Implemented Status (MVP v0)

### 2.1 已实现 / Implemented
- OAuth bridge：
  - `GET /api/oauth/authorize`（别名 `GET /oauth/authorize`）生成授权码（redirect 到 allowlisted `redirect_uri`）
  - `POST /api/oauth/token`（别名 `POST /oauth/token`）支持 `authorization_code` 与 `refresh_token`
- 受保护 API（需要 OAuth Bearer）：
  - `GET /me`
  - `GET /items`
  - `POST /items`（同一 URL 幂等 create/touch）
- OpenAPI：
  - 从 `actions/openapi.template.yaml` 渲染为 `public/openapi.yaml`
- Logout 测试工具（不属于 Actions contract）：
  - `GET /logout`（清理 Supabase cookies 并跳转 `/login`）
  - `POST /api/logout`（清理 Supabase cookies，返回 `{ ok: true }`）

- OAuth bridge:
  - `GET /api/oauth/authorize` (alias `GET /oauth/authorize`) issues authorization codes (redirects to allowlisted `redirect_uri`)
  - `POST /api/oauth/token` (alias `POST /oauth/token`) supports `authorization_code` and `refresh_token`
- Protected APIs (OAuth Bearer required for Actions; web UI may also use cookie session starting v0.2):
  - `GET /me`
  - `GET /items`
  - `POST /items` (idempotent create/touch for the same URL)
- OpenAPI:
  - Render `actions/openapi.template.yaml` into `public/openapi.yaml`
- Logout testing utility (not part of Actions contract):
  - `GET /logout` (clears Supabase cookies and redirects to `/login`)
  - `POST /api/logout` (clears Supabase cookies, returns `{ ok: true }`)

### 2.2 未实现 / Not implemented
CN：任何不在“已实现”列表中的能力，都视为未实现。  
EN: Any capability not explicitly listed as “Implemented” is not implemented.

---

## 3. 现有 API 形状（按实现）/ Current API Shapes (As implemented)

> 说明：这里只描述“对外可见的 contract”。如代码内部还有更多字段/错误码，以实现为准。  
> Note: This describes the externally visible contract. Additional fields/errors are implementation-defined.

### 3.1 `GET /me`
- 响应 / Response:
```json
{ "user_id": "string", "client_id": "string" }
````

### 3.2 `GET /items`

* 响应 / Response:

```json
{
  "items": [
    { "id": "uuid", "url_original": "string", "created_at": "timestamptz", "updated_at": "timestamptz" }
  ]
}
```

### 3.3 `POST /items`

* 请求 / Request:

```json
{ "url": "string" }
```

* 响应 / Response:

```json
{
  "item": { "id": "uuid", "url_original": "string", "created_at": "timestamptz", "updated_at": "timestamptz" }
}
```

### 3.4 `POST /oauth/token`（authorization_code）

* 请求体 / Request body: `application/x-www-form-urlencoded`
* 响应 / Response: `access_token`, `token_type`, `expires_in`, `refresh_token`

### 3.5 `POST /oauth/token`（refresh_token）

* 请求体 / Request body: `application/x-www-form-urlencoded`
* 响应 / Response: `access_token`, `token_type`, `expires_in`（无 / no `refresh_token`）

---

## 4. 用户路径（已实现 vs 规划）/ User flows (Current vs Planned)

### 4.1 已实现 / Current

1. 用户通过 `/login` 使用 Supabase Google/邮箱登录 → `/auth/callback` 交换 session（设置 `sb-*` cookies）

2. Actions 调 `GET /api/oauth/authorize`（或别名 `/oauth/authorize`）进入授权码流程

3. Actions 调 `POST /oauth/token`（或 `/api/oauth/token`）换取 access token（可选 refresh token）

4. Actions 使用 Bearer 调 `GET /me`、`POST /items`、`GET /items`

5. User logs in via `/login` (Supabase Google/email) → `/auth/callback` exchange to set `sb-*` cookies

6. Actions calls `GET /api/oauth/authorize` (or alias `/oauth/authorize`)

7. Actions calls `POST /oauth/token` (or `/api/oauth/token`) to exchange for an access token (optional refresh token)

8. Actions uses Bearer to call `GET /me`, `POST /items`, `GET /items`

### 4.2 规划 / Planned

CN：规划中的流程不写入“当前闭环”，也不作为验收依据。
EN: Planned flows are not part of the current loop and are not acceptance criteria.

---

## 5. 验收标准（当前）/ Acceptance criteria (Current)

### 5.1 脚本验收 / Script-level acceptance

* `npm run smoke:oauth` 通过（OAuth flow + `/me`）

* `npm run smoke:items` 通过（`/items` POST + GET）

* `npm run smoke:oauth` passes (OAuth flow + `/me`)

* `npm run smoke:items` passes (`/items` POST + GET)

### 5.2 Actions 验收 / Actions-level acceptance

* Actions 能导入生成后的 OpenAPI（`public/openapi.yaml` 对外可访问）

* 完成 Connect 后，能依次调用：`getMe` → `createItem` → `listItems` 且成功返回

* Actions can import the generated OpenAPI (served from `public/openapi.yaml`)

* After Connect, Actions can call: `getMe` → `createItem` → `listItems` successfully

---

## 6. 数据模型摘要（当前字段）/ Data model summary (Current fields)

### items

* `id` (uuid)
* `user_id` (uuid)
* `url_original` (text)
* `created_at` (timestamptz)
* `updated_at` (timestamptz)

### oauth_codes

* `code` (text)
* `user_id` (uuid)
* `client_id` (text)
* `redirect_uri` (text)
* `expires_at` (timestamptz)
* `used_at` (timestamptz, nullable)

### oauth_tokens

* `refresh_token_hash` (text)
* `user_id` (uuid)
* `client_id` (text)
* `expires_at` (timestamptz)
* `revoked_at` (timestamptz, nullable)
* `created_at` (timestamptz)

---

# v0.2_SPEC (Growth MVP)

## 0) 一句话结论 / One-line summary
CN：v0.2（增长视角）在 v0（OAuth bridge + `/me` + `/items`）闭环之上，新增 **登录后列表页（/app）**、**公开分享页（/s/:share_id）**、**Google 登录（降摩擦；Apple/OG 暂缓）**，并补齐 **最小埋点（可度量且不阻塞渲染）**。
EN: v0.2 (growth) builds on v0 (OAuth bridge + `/me` + `/items`) and adds an authenticated list UI (`/app`), a public share page (`/s/:share_id`), Google login (Apple/OG deferred), and minimal tracking that must be non-blocking.

---

## 0.1 v0.2 (web-only) implemented
- `GET /s/:share_id` public share page renders a read-only list (sorted by `updated_at desc, id desc`).
- Revoked shares return 404 (same as not found).

- `GET /s/:share_id` 公开分享页可读列表（排序 `updated_at desc, id desc`）。
- revoke 后返回 404（与不存在一致）。

---

## 1) 范围 / Scope

### 1.1 Goals（要达成什么）
CN：
1. **登录后列表页**：用户登录后能稳定查看自己的 items（按最近更新排序）；在 `/app` 一键生成分享链接并复制（调用 `POST /api/shares`，复用 active share）。
2. **公开分享**：用户生成一个不透明分享链接 `/s/<share_id>`，任何人可打开只读列表；支持 revoke/rotate 让旧链接失效。
3. **社交登录（最小）**：打通 **Google** 登录（Supabase Provider），降低新用户回流门槛；Apple 暂缓（见 Parking Lot）。
4. **最小埋点**：至少能度量「自己查看列表」与「分享页被打开」两类关键行为；埋点必须 **best-effort + 不阻塞渲染**，并具备基本去重与隐私处理。

EN:
1. **Authenticated list UI**: after login, users can view their items reliably (sorted by recency) and generate & copy a share link in `/app` (calls `POST /api/shares`, reuses active share).
2. **Public share**: users can generate an opaque share URL `/s/<share_id>` for anyone to view a read-only list; supports revoke/rotate to invalidate old links.
3. **Social login (minimal)**: enable **Google** login via Supabase Provider; Apple is deferred (see Parking Lot).
4. **Minimal tracking**: measure two key behaviors (private list usage + share page opens). Tracking must be **best-effort and non-blocking**, with basic dedupe and privacy handling.

### 1.2 Non-goals（明确不做）
CN：
- 不扩充 item 字段（仍以现有存储与接口为准）。
- 不做 URL normalization / ACP / 商品信息抓取。
- 不做多列表、多文件夹、标签、搜索、编辑/删除 item。
- 不做复杂增长分析面板（仅落库 + 可用 SQL 聚合）。
EN:
- No item field expansion (follow current storage/API).
- No URL normalization / ACP / product scraping.
- No multi-lists, folders, tags, search, or item edit/delete.
- No analytics dashboard (store events; query via SQL).

### 1.3 Assumptions（前置假设）
- v0 的 OAuth bearer 访问 `/me` 与 `/items` 已稳定可用。
- 生产环境默认禁用 Supabase `Authorization: Bearer` 头部登录绕过（仅 cookie session），由 `OAUTH_ALLOW_AUTH_HEADER_LOGIN` 控制（见 `SECURITY.md`）。

---

## 2) 用户故事 / User stories

### 2.1 已登录用户（Owner）
- 作为 owner，我能在 `/app` 看到自己的收藏列表（最近更新在前）。
- 我能一键生成分享链接并复制。
- 我能撤销分享链接（revoke），确保旧链接不可再访问。

### 2.2 访客（Viewer）
- 作为访客，我能打开 `/s/<share_id>` 并看到只读列表。
- 我不会看到任何 owner 的敏感信息（user_id、邮箱等）。
- （可传播的 OG 预览属于 future，见 Parking Lot。）

### 2.3 新用户回流（New user）
- 作为从分享页来的新用户，我能用 Google 快速登录（未来可扩展“导入/收藏该列表”；Apple 暂缓）。

---

## 3) 产品形态 / Product shape (Routes & UI)

> 路由命名可按现有 Next.js 结构微调；下面是建议的最小集合。

### 3.1 `/login`
- Buttons (minimal):
  - Continue with Google
  - Continue with Email (if enabled)
- 登录成功后重定向到 `/app`
- Apple 登录属于 future（见 Parking Lot）

### 3.2 `/app`（Authenticated list page）
- Gate: requires Supabase session cookie
- List:
  - fields: `url_original`, `id`, `created_at`, `updated_at`
  - sort: `updated_at DESC, id DESC`
- Actions:
  - Share button: call `POST /api/shares` (reuse if exists) → copy `share_url` to clipboard
  - Revoke share link (optional to place under “Share settings”)
- Data:
  - load items via the same backend as GET /items (cookie session). Prefer instrumenting the shared listItems() server function.

### 3.3 `/s/<share_id>`（Public share page）
- Public, read-only
- Same list sort as `/app`
- No OG requirements in v0.2 (moved to Parking Lot)

---

## 4) 数据模型 / Data model

### 4.1 `shares`
Purpose: **exactly one active share per user** (active := `revoked_at is null`), supports revoke/rotate.

Minimal schema:
- `id` (uuid v4, unguessable)
- `user_id` (uuid, FK -> auth.users)
- `created_at` (timestamptz, default now())
- `revoked_at` (timestamptz, nullable)

Indexes / Constraints:
- `index shares(user_id)`
- **partial unique index**: `unique(user_id) where revoked_at is null`  // enforce one active share per user
- `index shares(revoked_at)`

Notes:
- `id` should be **unguessable** (uuid v4 is usually OK; token-based also OK).
- If you want stronger safety: store `share_token_hash` and only expose raw token once.

### 4.2 `events`（统一埋点表 / Unified tracking table）
Minimal schema:
- `id` (bigserial/uuid)
- `event_name` (text) **namespaced** (see below), e.g. `web.app.items_list_load`, `web.share.page_view`, `actions.list_items`
- `occurred_at` (timestamptz default now())
- `user_id` (uuid, nullable)  // the *viewer/caller* user if authenticated
- `share_id` (uuid/text, nullable)
- `client_id` (text, nullable) `wishlistgpt-dev` | `wishlistgpt-staging` | `wishlistgpt-prod`  // for Actions (OAuth client)
- `meta` (jsonb, not null, default `{}`)

Event naming convention (locked):
- `web.app.*`   // authenticated web UI (/app)
- `web.share.*` // public share page (/s/:share_id)
- `actions.*`   // reserved for future (GPTs Actions calls; Parking Lot)

Meta fields (locked):
- `meta.request_id` (text) // generated UUID once per incoming request (reuse for all event writes within that request), used for idempotency.
- `meta.x_vercel_id` (text) // raw request header `x-vercel-id` when available (Vercel); nullable; only for debugging/log correlation.

Indexes:
- `(event_name, occurred_at)`
- `(user_id, occurred_at)`
- `(share_id, occurred_at)`
- `(client_id, occurred_at)` (optional)
- Unique index for idempotency: `(event_name, meta->>'request_id')`

Retention:
- phase-1: keep all; phase-2: optional TTL / partitioning.


## 5) 接口与服务端行为 / Interfaces & server behavior

### 5.1 Items（已有）
- `GET /items` (alias `GET /api/items` if implemented)
  - Auth: OAuth Bearer for Actions; cookie session for web UI is also OK.
- `POST /items` (alias `POST /api/items` if implemented)

v0.2 Web UI should call the same underlying storage layer / endpoint.

### 5.2 Shares（新增）


- `POST /api/shares`
  - Auth: cookie session required (Supabase session cookie; not OAuth Bearer)
  - Behavior (locked):
    - If the user already has an **active** share (`revoked_at is null`), **return it** (reuse).
    - If no active share exists, **create a new share** and return it.
  - Response:
    - `{ share_id, share_url }`
    - `share_url` uses request origin: `<origin>/s/<share_id>`

- `POST /api/shares/rotate`  (or `POST /api/shares?rotate=1`)
  - Auth: cookie session required
  - Behavior:
    - Revoke current active share (if any), then create a new active share
    - If create hits partial-unique race, retry once after re-revoking
  - Response:
    - `{ share_id, share_url }`

- `POST /api/shares/:id/revoke`
  - Auth: cookie session required
  - Behavior:
    - Only owner can revoke; if not owner or share missing, return 404 (no leakage)
    - Idempotent: already-revoked shares still return success
    - After revoke, `GET /s/:id` must return 404
  - Response:
    - `{ ok: true }`

### 5.3 Tracking（埋点落点）
原则：
- **统一写入 `events` 表**；优先 **server-side**（稳定，不受 adblock/JS 影响）
- **不引入 `context` 字段**：来源/表面由 `event_name` 命名空间表达（`web.app.*` / `web.share.*` / `actions.*`）
- v0.2 **只保留最小 meta**：`meta.request_id` + `meta.x_vercel_id`

> Note: `web.share.page_view` 统计会包含 link preview/bot 的 GET 请求（v0.2 接受；后续如需可再引入 bot filter 或更精细去重）。

#### Required fields for every event write (v0.2)
All event writes MUST include:
- `meta.request_id`: UUID generated **once per incoming request**, and reused for all event writes within that request
- `meta.x_vercel_id`: request header `x-vercel-id` when available (nullable)

#### Required event writes (v0.2)

**Principle (locked): tracking must never block.**  
All tracking writes should be **best-effort** and must not delay user-facing page renders or API responses. Prefer a helper such as `trackBestEffort()` implemented with `after()` + hard timeout + error swallowing.

A) Web App (`/app`)
- when the list is successfully rendered / list data returned:
  - `event_name = "web.app.items_list_load"`
  - `user_id = <owner>`
  - `client_id = null`, `share_id = null`

B) Public Share (`/s/:share_id`)
- on page load, the client should fire-and-forget `POST /api/track/share-view` which writes:
  - `event_name = "web.share.page_view"`
  - `share_id = <share_id>`
  - `user_id = <viewer>` if viewer has a valid cookie session; otherwise null
- Do NOT write events for `HEAD` requests.

(Deferred) Actions tracking (`actions.*`) is moved to Parking Lot.

## 6) 去重与风控 / Dedupe & abuse controls

### 6.1 Dedupe rule (minimal)
目标：防止 refresh/retry/prefetch/Actions 轮询导致 event 爆炸；不追求完美刻画 engagement。

**Primary dedupe (idempotency via `meta.request_id`)**
- skip inserting duplicates with same (`event_name`, `meta.request_id`) only
No additional time-window dedupe in v0.2.


### 6.2 Rate limiting (skip in v0.2)
- Public share endpoint should have basic rate limit to reduce scraping / brute force.
- Consider adding a simple per-IP limit on `/s/:share_id`.

---

## 7) 隐私与安全 / Privacy & security

- Share links must not expose `user_id` or any auth token.
- `GET /s/:share_id` must:
  - return 404 if revoked or not found
  - never leak whether a user exists beyond “not found”
- Do not store PII in `meta`.
  - Only store `meta.request_id` and `meta.x_vercel_id`.
- Production default remains:
  - Supabase session relies on cookie (no header bypass unless explicitly enabled), see `SECURITY.md`.

---

## 8) 验收标准 / Acceptance criteria

### 8.1 Manual E2E（人肉验收）
1. 使用 **Google** 登录成功后进入 `/app`，能看到 items 列表（`updated_at desc, id desc`）。
2. 在 `/app` 点击 Share，调用成功后剪贴板得到 `/s/<share_id>`（即 `share_url`）。
3. 无痕窗口打开 `/s/<share_id>`，能看到相同排序的列表（只读）。
4. Owner revoke/rotate 后：无痕再开旧 `/s/<share_id>` 必须 404。
5. 页面源代码/接口响应中不应出现 `user_id`、邮箱等敏感信息（public share）。

> Apple 登录与 OG 预览属于 Parking Lot（future）。

### 8.2 Tracking 验收（SQL）
- Owner 在 `/app` 查看列表后应至少出现一条事件：
  - `events where event_name='web.app.items_list_load' and user_id=<me>`
- 访客打开分享页后应出现事件：
  - `events where event_name='web.share.page_view' and share_id=<share_id>`

> Note: `actions.*` tracking is deferred (Parking Lot).

Basic metrics examples:
- Daily active users (core: web app only in v0.2):
  - ```sql
    select date_trunc('day', occurred_at) as d,
           count(distinct user_id) as dau
      from events
     where user_id is not null
       and event_name like 'web.app.%'
     group by 1
     order by 1;
    ```
- Share reach (requests-based views in v0.2):
  - ```sql
    select share_id,
           count(*) as views
      from events
     where event_name = 'web.share.page_view'
       and share_id is not null
     group by 1
     order by views desc;
    ```
### 8.3 Retention (definition)
Core retention (recommended for v0.2):
- A user is **active** on a day if they have ANY event with:
  - `event_name like 'web.app.%'`
  - and `user_id is not null`

(Share page views can be analyzed separately via `web.share.*`. Actions retention via `actions.*` is future / Parking Lot.)

D1/D7 retention (example logic):
- D1: users active on day D AND active on day D+1
- D7: users active on day D AND active on day D+7

## 9) 任务拆解 / Work breakdown (P0/P1)

### P0（必须有）
- [ ] `/login` Google login (Supabase provider) + redirect to `/app` (Email login optional if already enabled)
- [ ] `/app` list page (auth gate + list render + recency sort)
- [ ] Share controls in `/app`: create/reuse share link (`POST /api/shares`) + revoke/rotate (as implemented)
- [ ] `shares` table + constraints (one active share per user) + create/reuse + revoke/rotate APIs
- [ ] `/s/:share_id` public share page (read-only; revoked → 404; no PII leak)
- [ ] `events` table + best-effort writes:
  - `web.app.items_list_load`
  - `web.share.page_view` via fire-and-forget `POST /api/track/share-view`
  - idempotency/dedupe via `(event_name, meta.request_id)`
- [ ] Docs sync:
  - Update `PROJECT_MAP.md` entrypoints
  - Update `CHEATSHEET.md` (env vars / local+prod setup notes)
  - Update `SECURITY.md` if the security boundary changes

### P1（可后置）
- [ ] Add CTA on share page (login / import)
- [ ] Basic rate limit on share page / tracking endpoint
- [ ] More events: `create_share`, `revoke_share`, `login_success`

---

## 10) Parking Lot（future / 暂缓项）
These are intentionally out of v0.2 scope (documented for future work).

- **Apple 登录**：Supabase Apple provider wiring（等待 D‑U‑N‑S / Apple Developer Program）。
- **OG 预览**：share page OG meta（title/description）与静态图 `public/og/share.png`（1200x630）。
- **Actions 埋点**：在 Actions endpoints 成功响应时写入 `actions.get_me / actions.list_items / actions.create_item`。
- **单条 item Copy URL**（/app 内的 per-item copy）。

---

# v0.3 核心功能 UIUX MVP SPEC（中英文双语）

## 0) 一句话结论 / One-line Summary
> WishlistGPT 是 **GPT-native** 产品，Web 仅作为 **展示与决策界面**。  
> WishlistGPT is a **GPT-native** product with a web interface used for **viewing and decision-making**.  
>
> 用户在 ChatGPT 中添加/理解商品；Web 用于浏览、快速决策、编辑个人备注、删除、分享。  
> Users add/understand items in ChatGPT; the web is for viewing, quick decisions, editing personal notes, deleting, and sharing.

---

### 0.1 非目标 / Non-goals (明确不做)
- Web 不提供 Add item（不支持从 URL 添加、不支持 Web chat / NLP）。  
  No “Add item” on web (no URL add, no web chat / NLP).
- Web 不允许编辑商品展示字段（标题/封面/商家/价格）。  
  No editing of product display fields (title/cover/merchant/price).
- v0.3 不做独立 Settings 页面（账号管理不在本期 UI 范围）。  
  No standalone Settings page in v0.3 (account management out of scope).
- v0.3 不做多 List（但 UI 语义需可扩展到未来多 List）。  
  No multi-list in v0.3 (but semantics should not block future multi-list).
- v0.3 Share 不做 Poster 海报（仅做链接分享 + revoke/regenerate）。  
  No poster generation in v0.3 share (link-only sharing + revoke/regenerate).
- v0.3 **仅支持 Light theme**（不做 Dark mode 样式适配）。  
  v0.3 is **light-theme only** (no explicit dark mode support).

---

## 1) 核心功能 / Core Features (v0.3)
1) `/app` 私有主页面：单列卡片浏览清单（移动端优先）。  
   `/app` private main page: single-column card list (mobile-first).
2) 两种排序来回切换：按添加时间 Newest ↔ Oldest。  
   Two-way sort toggle: Newest ↔ Oldest by added time.
3) 卡片展示：封面（正方形）、标题、商家 logo（圆形）、价格（本地化）、个人备注预览。  
   Card display: square cover, title, circular merchant logo, localized price, note preview.
4) 点击卡片进入 **Decision Sheet**（轻量详情）用于快速决策与跳转商品页。  
   Card click opens **Decision Sheet** for quick decision & external navigation.
5) 仅支持编辑 `personal_note`（在 sheet 内 inline 编辑 + Save）。  
   Only `personal_note` is editable (inline in sheet + Save).
6) 删除：无二次确认 + Undo + Soft delete。  
   Delete: no confirmation + Undo + soft delete.
7) Cheatsheet：Header 常驻入口，轻浮层展示使用说明；含 `Got it / Back to GPT`。  
   Cheatsheet: persistent header entry, lightweight overlay; includes `Got it / Back to GPT`.
8) 分享：列表顶部一键进入 Share sheet；支持 copy link、系统 share（可用则显示）、revoke + regenerate。  
   Share: one-click Share sheet from list top bar; copy link, system share if available, revoke + regenerate.
9) 右下角悬浮：Return（GPT icon），下滑隐藏/上滑显示。  
   Floating Return (GPT icon), hides on scroll down / shows on scroll up.

---

## 2) 页面与路由 / Routes & Pages

### 2.1 `/app` — 私有清单主页面 / Private Wishlist Main
**目标 / Goal**：浏览 → 点进 Decision Sheet → `View on website` 快速决策；同时支持快速编辑 note、快速删除、快速分享。  
View → Decision Sheet → `View on website` for decisions; also quick note edit, delete, and share.

### 2.2 `/s/:share_id` — 公共分享页（只读） / Public Share Page (Read-only)
- public 可访问；只读渲染列表。  
  Public accessible; read-only rendering.
- 根据 share_id 找 owner，再取 owner 的 items（同排序规则）。  
  Resolve owner by share_id, then fetch owner items (same sort rules).
- 必须过滤 `deleted_at IS NULL`（已删除不展示）。  
  Must filter `deleted_at IS NULL` (deleted items never show).
- revoked 必须 404。  
  Revoked must return 404.
- 不泄露 PII（不输出 user_id/email 等）。  
  No PII leakage (no user_id/email, etc.).
- **public 页允许展示 `personal_note`**。  
  Public page may display `personal_note`.
- public 页应提供 `View on website`（使用 `source_url`）。  
  Public page should offer `View on website` (using `source_url`).

---

## 3) 适配策略 / Responsive Strategy (Mobile-first + Desktop 自适配)
### 3.1 移动端优先 / Mobile-first
- 单列卡片 + bottom sheet 为主交互。  
  Single-column cards + bottom sheet as primary interaction.
- 触控热区充足（尤其 `⋯` 区域）。  
  Touch targets must be large enough (especially `⋯`).

### 3.2 桌面端自适配 / Desktop Adaptive (no desktop-exclusive UX)
- 仍保持单列，但容器更宽（提高信息密度、减少换行）。  
  Still single-column; wider container for better density.
- `View on website` 默认新 tab 打开。  
  Default open in new tab for `View on website`.
- 不做 hover/快捷键等桌面专属功能。  
  No hover shortcuts / desktop-only features.

---

## 4) `/app` 布局 / Layout Spec

### 4.1 Header（不吸顶）/ Header (non-sticky)
- 左 / Left：`WishlistGPT`  
- 右 / Right：`Cheatsheet`（文字按钮，视觉更轻，可用淡色）  
  `Cheatsheet` (text button; visually light, e.g., softer color)

> 说明 / Note：避免 sticky header，减少移动端浏览器地址栏占位冲突。  
> Avoid sticky header to reduce conflicts with mobile browser chrome.

### 4.2 列表顶部工具栏（在内容区内）/ List Top Bar (inside content)
- 左 / Left：排序切换（两态）  
  Sort toggle (2-state): `Newest` / `Oldest`
- 右 / Right：`Share`（一键可达；list-level action）  
  `Share` (one-click; list-level action)

### 4.3 列表 / List
- 单列 / Single column
- 卡片间距偏生活化（留白更舒服）  
  Consumer-friendly spacing (comfortable whitespace)

### 4.4 悬浮 Return 按钮 / Floating Return Button
- 右下角悬浮按钮：仅 GPT icon（无文案）。  
  Bottom-right floating button: GPT icon only (no label).
- 无障碍 / A11y：需要 `aria-label="Return to ChatGPT"`；桌面可选 tooltip。  
  Must include `aria-label="Return to ChatGPT"`; optional tooltip on desktop.
- 滚动行为 / Scroll behavior：
  - 向下滚动隐藏 / hide on scroll down
  - 向上滚动显示 / show on scroll up
  - 阈值 12–24px + throttle（业界标准）避免闪烁  
    threshold 12–24px + throttling to avoid flicker
- 列表容器必须有 bottom padding，避免按钮遮挡最后卡片：  
  List container must include bottom padding to avoid covering last card:
  - `padding-bottom >= buttonHeight + 16px + safe-area-inset-bottom`

---

## 5) Card 组件 / Item Card Component

### 5.1 卡片内容 / Card Contents
- **封面 / Cover**：正方形容器（1:1），`object-fit: cover`  
  Square container (1:1), `object-fit: cover`
- **标题 / Title**：最多 2 行截断  
  Up to 2 lines (clamped)
- **商家 logo / Merchant logo**：圆形容器（18–22px），放在标题旁边  
  Circular container (18–22px), placed next to the title
- **价格 / Price**：本地化展示（见 §10.1 规则），旁边一个 `?`  
  Localized formatting (see §10.1 rules) + small `?` tooltip
- **个人备注预览 / Note preview**：可选，1 行或 2 行预览  
  Optional, 1–2 lines preview
- **状态 / Status**：v0.3 不展示行内状态；未来可做封面 stamp（Reserved 等）。  
  No inline status in v0.3; future: cover stamp (Reserved, etc.)

### 5.2 图片加载 / Image Loading
- 有 skeleton + 占位图 fallback  
  Skeleton + placeholder fallback
- 封面容器固定高度（1:1）防止列表跳动  
  Fixed 1:1 container to avoid layout shift
- v0.3 允许 hotlink；图片失败不得阻塞首屏；不得无限重试。  
  v0.3 allows hotlink; image failures must not block above-the-fold; no infinite retries.

### 5.3 交互 / Interactions
- **整卡可点击**打开 Decision Sheet（除 `⋯` 区域外）。  
  Entire card is clickable to open Decision Sheet (except `⋯` area).
- `⋯` 独立热区（防 fat finger）：建议 40×40px 点击区域。  
  Dedicated `⋯` hit area to prevent fat finger; recommend 40×40px.

### 5.4 兜底展示规则（Card）
为避免列表出现重复的“坏状态文案”（如反复出现 Price unavailable），Card 必须遵循以下渲染规则：
To avoid repetitive “error-like” UI (e.g., repeated “Price unavailable”), the card must follow these rules:

#### 5.4.1. Cover（封面）
- 永远渲染 1:1 正方形容器，避免 layout shift。
  Always render a fixed 1:1 container to prevent layout shift.
- 若 `display_cover_image_url` 存在：渲染图片（`object-fit: cover`）。
  若图片加载失败：切换到 placeholder（不得无限重试）。
  If `display_cover_image_url` exists: render image (`object-fit: cover`).
  If image fails: switch to placeholder (no infinite retry).
- 若 `display_cover_image_url` 不存在：直接渲染 placeholder。
  If missing: render placeholder.

#### 5.4.2. Merchant logo（商家 logo）
- **默认不渲染 logo 容器**（避免无意义占位）。
  **Do not render the logo container by default** (avoid meaningless placeholders).
- 若 `display_merchant_logo_url` 存在：渲染圆形 logo（18–22px）并放在标题旁边。
  If `display_merchant_logo_url` exists: render a circular logo (18–22px) next to the title.
  - 若 logo 图片加载失败：使用 fallback（例如：domain 首字母或通用 icon）在圆形容器内展示。
  If logo fails to load: fallback to domain initial or a generic icon inside the circle.
- 若 `display_merchant_logo_url` 不存在：不显示 logo 容器。
  If missing: do not show the logo container.

#### 5.4.3. Domain 解析（用于标题兜底与 logo fallback）
- `domain` 优先级 (priority): 
  1. `display_merchant_domain`
  2. parse host from `source_url` (strip `www.`)
  3. otherwise null


#### 5.4.4. Title（标题）
- Use `display_product_title` when present.
- Else if `domain` exists: fallback to **`From {domain}`** (never use “Wishlist item”).
- Else: `Untitled item`.

#### 5.4.5. Price 行（价格）
- **仅当存在价格时才渲染价格行**；无价格时整行不出现，也不显示 `?` tooltip。
  **Render the entire price row only when price exists**; otherwise omit the row and omit the `?` tooltip.
- 价格存在条件（任一满足）：
  * `display_price_text` 非空，或
  * `display_price_amount_minor` 与 `display_currency` 同时存在
- 价格展示优先级：
  * 优选使用 `Intl.NumberFormat` 本地化格式化
  * 否则 `display_price_text`


#### 5.4.6. Personal note（备注）
- 若 `personal_note` 非空：显示 1–2 行预览。
  If present: show 1–2 line preview.
- 若为空：显示 placeholder：`Add a note…`（轻色/次要）。
  If empty: show placeholder `Add a note…` (secondary style).

---

## 6) `⋯` 菜单 / Overflow Menu (Popover)

### 6.1 形态 / Form
- 使用 **Popover**（轻量气泡菜单），贴近触发点。  
  Use **Popover** anchored to the trigger.

### 6.2 菜单项 / Items
- `Edit note`
- `Delete`（红色 / red）

### 6.3 Delete 行为 / Delete Behavior（无确认 + Undo + Soft delete）
**一致性要求 / Consistency requirement**：无论从卡片菜单或 Decision Sheet 触发 Delete，行为必须一致。  
Delete behavior must be identical whether triggered from card menu or Decision Sheet.

- 点击 Delete：无二次确认。  
  No confirmation.
- UI 反馈：可 **optimistic 立即移除卡片**；Toast 必须在 **删除成功后**出现。  
  UI feedback: may optimistically remove the card immediately; toast must appear **only after delete succeeds**.
- 删除失败：必须回滚 UI，并提示：`Couldn’t delete. Try again.`  
  On failure: must roll back UI and show: `Couldn’t delete. Try again.`
- 后端 soft delete：`deleted_at = now()`。  
  Backend soft delete: set `deleted_at = now()`.
- Toast（4s）：`Item deleted` + `Undo`  
  Toast (4s): `Item deleted` + `Undo`
- 点击 Undo：调用 restore endpoint，恢复原 item（id 与 created_at 保持不变）。  
  Undo calls restore endpoint; item restored with same id & created_at.
- 竞态/幂等（MVP）/ Race & idempotency (MVP):
  - delete/restore 必须幂等（重复请求不应报错）。  
    delete/restore must be idempotent.
  - Toast/Undo 仅保证对“最近一次删除”有效（MVP 约束）。  
    Undo is guaranteed only for the “most recent delete” (MVP constraint).

---

## 7) Decision Sheet（轻量详情）/ Decision Sheet (Bottom Sheet)

### 7.1 打开方式 / Trigger
- 点击卡片主体打开 bottom sheet。  
  Tap card body to open bottom sheet.

### 7.2 默认高度与轻重 / Default Height & Weight
- 默认打开约占屏 ~70%，可上拉到更高（接近全屏）。  
  Opens at ~70% height; can expand near full screen.

### 7.3 内容结构（顺序）/ Content Structure (order)
- 封面大图（正方形）/ Large square cover  
- 标题 + 圆形 logo（同一块）/ Title + circular logo  
- 价格 + `?` tooltip / Price + `?` tooltip  
- `personal_note` inline 编辑区 + `Save` / Inline note editor + `Save` 
  * Note 的 `Save` 必须是 **Note 编辑区内的 inline 操作**（例如在输入框右侧或输入框下方小按钮），而不是主动作区的大按钮。 
- 主按钮 / Primary CTA：`View on website`  
- 次按钮 / Secondary CTA：`Delete`（改为隐式文字链接，见 §7.6）

### 7.4 外跳策略 / External Navigation
- v0.3 `View on website` 永远使用 `source_url`。  
  In v0.3, `View on website` always uses `source_url`.
- 若 `source_url` 为空：按钮置灰并显示提示 `Link unavailable`（或隐藏，需统一策略）。  
  If `source_url` is empty: disable CTA and show `Link unavailable` (or hide; must be consistent).
- 桌面：默认新 tab 打开。  
  Desktop: opens in new tab by default.
- 移动端（含 GPT 内置浏览器）：同 tab 打开。  
  Mobile (incl. GPT in-app browser): same tab.

### 7.5 Delete from Sheet
- 若在 Decision Sheet 中触发 Delete：删除成功后 **自动关闭 sheet**。  
  If delete is triggered from Decision Sheet: **close the sheet** after successful deletion.
- Undo 成功后：仅恢复列表，不自动重新打开 sheet。  
  After Undo: restore list only; do not auto-reopen the sheet.

#### 7.6 按钮与动作布局（新增）
- `View on website`：主按钮（primary）。
  `View on website`: primary button.
- `Delete`：**隐式文字链接**（danger style），放在主按钮下方（或同区块底部），避免与主 CTA 争夺注意力。
  `Delete`: **implicit text link** (danger style) placed under the primary CTA (or at the bottom of the CTA block) to reduce attention competition.
- `Save`：仅在 note 进入编辑态时显示（inline），保存成功后退出编辑态并更新列表预览。
  `Save`: shown only when the note is in editing state (inline). On success, exit edit mode and update the list preview.

---

## 8) Cheatsheet（轻浮层）/ Cheatsheet (Light Overlay)

### 8.1 打开 / Trigger
- Header 右侧 `Cheatsheet` 点击打开。  
  Triggered by header `Cheatsheet`.

### 8.2 形态 / Form
- 轻量 modal / bottom sheet（一屏内容）。  
  Lightweight modal/bottom sheet (single-screen).

### 8.3 文案（英文优先；可附中文解释）/ Copy (English-first with optional CN)
**定位句 / Positioning line**
- EN: `Add items in ChatGPT. Manage & share them here.`
- ZH: `在 ChatGPT 里添加商品；在这里浏览、决策、备注与分享。`

**示例 / Examples**
1. `Add these links to my wishlist: ...`
2. `Add "Nike Air Force 1, white, size 42" to my wishlist`
3. `Show my wishlist — I’ll clean it up on the web`

**Actions**
- `Got it`
- `Back to GPT`（触发 Return 预期路径 / triggers Return expected path）

> Return 预期路径（描述期望，不绑定实现）/ Return expected path (experience-level):
> - 若从 ChatGPT app 内置浏览器打开：Return 应回到原 ChatGPT 会话。  
>   If opened inside ChatGPT in-app browser: Return should go back to the originating ChatGPT conversation.
> - 若从桌面浏览器新 tab 打开：Return 应尽力回到上一个页面或提示用户切回 ChatGPT tab。  
>   If opened in a new desktop tab: Return should attempt to go back or prompt user to switch back to the ChatGPT tab.

---

## 9) Share（分享）/ Share (Link-only MVP)

### 9.1 入口 / Entry
- `/app` 列表顶部工具栏右侧 `Share` 一键打开。  
  One-click from list top bar `Share`.

### 9.2 Share Sheet 内容 / Share Sheet Contents
- 标题 / Title：`Share list`
- 链接短展示 + Copy（复制完整链接）  
  Short link display + Copy (copies full URL)
- `Share…`（仅当系统分享 API 可用时显示）  
  `Share…` shown only if system share API is available
- `Revoke link`（危险操作）  
  `Revoke link` (danger)
- revoke 后展示：  
  After revoke:
  - `This link is disabled.`
  - `Generate new link`

### 9.3 语义与约束 / Semantics & Constraints
- Share sheet 打开时：若存在 active share → 展示；否则生成新的 active share 并展示。  
  On open: if an active share exists, show it; otherwise generate and show a new active share.
- 系统保证同一用户仅一个 active share（revoked 后才可生成新 active）。  
  System guarantees only one active share per user (must revoke before generating a new active).
- Revoke 后：`/s/:share_id` 必须立即 404。  
  After revoke: `/s/:share_id` must return 404 immediately.

### 9.4 降级策略 / Degradation
- 系统分享不可用 → 不展示 `Share…`，仅保留 Copy。  
  If system share is unavailable, hide `Share…`, keep Copy only.
- v0.3 不展示 Poster（不留空位）。  
  No poster in v0.3 (no placeholder UI).

---

## 10) 数据库字段设计 / Database Field Design (v0.3)

> 原则 / Principle：Web 展示使用 “display snapshot” 字段；仅 `personal_note` 可由 Web 编辑。  
> Web uses “display snapshot” fields; only `personal_note` is editable from web.

### 10.1 `items` 表建议字段 / Suggested `items` columns

**Owner / ownership**
- `id` (uuid/bigint)
- `user_id` (uuid)

**Source**
- `source_url` (text, nullable)

**User editable**
- `personal_note` (text, nullable)

**Timestamps**
- `created_at` (timestamptz) — **添加时间 / added time**
- `updated_at` (timestamptz) — 更新记录用途，不参与排序 / not used for sorting

**Sorting rule / 排序规则（防漂移）**
- 排序仅使用 `created_at`（added time）。  
  Sorting uses `created_at` only (added time).
- 编辑 `personal_note` 不得影响 item 排序位置。  
  Editing `personal_note` must not reorder items.

**Soft delete**
- `deleted_at` (timestamptz, nullable)

**Display snapshot (written by GPT/backend refresh)**
- `display_cover_image_url` (text, nullable)
- `display_product_title` (text, nullable)
- `display_merchant_logo_url` (text, nullable)
- `display_merchant_domain` (text, nullable) — fallback if no logo
- Fiat price fields:
  - `display_price_amount_minor` (int, nullable) — e.g. $12.34 => 1234
  - `display_currency` (text, nullable) — ISO 4217: USD/CNY/SGD...
- Optional flexible price text (future-proof; can cover special formatting/crypto):
  - `display_price_text` (text, nullable)
- Optional price timestamp (for tooltip detail if needed):
  - `display_price_updated_at` (timestamptz, nullable)

**Query rule / 查询规则**
- 所有列表读取必须过滤：`deleted_at IS NULL`  
  All reads must filter: `deleted_at IS NULL`

### 10.2 价格格式化规则 / Price Formatting Rules (v0.3)
- 若 `display_price_amount_minor` + `display_currency` 同时存在：优先使用 `Intl.NumberFormat` 本地化格式化。  
  If `display_price_amount_minor` + `display_currency` exist: prefer formatting via `Intl.NumberFormat`.
- 若 `Intl` 格式化失败：回退到 `display_price_text`（若存在）。  
  If `Intl` formatting fails: fall back to `display_price_text` (if present).
- 否则使用 `display_price_text`。  
  Otherwise display `display_price_text`.
  - locale: `navigator.language`
  - style: `currency`
  - currency: `display_currency`
- v0.3 默认认为 minor unit 为 2 位（amount_minor / 100）。  
  v0.3 assumes 2 minor units for fiat (amount_minor / 100).

### 10.3 `shares` 表（沿用 v0.2 能力）/ `shares` table (carry from v0.2)
- `id` (share_id)
- `user_id`
- `created_at`
- `revoked_at` (nullable)

**Constraint**
- One active share per user: unique(user_id) where revoked_at is null

---

## 11) API / 行为要求（最小集）/ API & Behavior Requirements (Minimal)

### 11.1 Items
- List items: returns only `deleted_at IS NULL`, includes display snapshot + note.  
- Update note: only updates `personal_note`.  
- Delete: soft delete sets `deleted_at`.  
- Restore: clears `deleted_at` (dedicated restore endpoint).  
- delete/restore 必须幂等。  
  delete/restore must be idempotent.

### 11.2 Share
- Fetch/generate active share link for current user.  
- Revoke active share.  
- Public share page reads items for owner and filters deleted.

### 11.3 Public response allowlist（防泄露）/ Public response allowlist (anti-leak)
- `/s/:share_id` 只允许输出（建议白名单）：  
  `/s/:share_id` should only output (suggested allowlist):
  - `display_cover_image_url`
  - `display_product_title`
  - `display_merchant_logo_url`
  - `display_merchant_domain`
  - `display_price_amount_minor`, `display_currency`, `display_price_text`
  - `personal_note`
  - `source_url`
- 明确禁止输出：`user_id`, `email`, 以及任何内部追踪/鉴权字段。  
  Must not include: `user_id`, `email`, or any internal tracking/auth fields.

---

## 12) 文案选择（v0.3 英文为主）/ Microcopy (English-first v0.3)

### 12.1 Empty State (空列表)
- 中间大按钮 / Center large button:
  - `Add items in ChatGPT. Tap here for Cheatsheet.`
- 点击按钮：打开 Cheatsheet overlay（复用同一组件）。  
  Tap opens Cheatsheet overlay (reuse the same component).

### 12.2 Price tooltip
- `Price tracking is best-effort.`

### 12.3 Delete toast
- `Item deleted` + `Undo`

### 12.4 Decision Sheet CTA
- Primary: `View on website`
- Secondary: `Delete`
- Note actions: `Save`
- Link empty hint: `Link unavailable`

### 12.5 Share sheet
- `Share list`
- `Copy link`
- `Revoke link`
- `Generate new link`
- `This link is disabled.`

---

## 13) UI 风格 / UI Style（消费级生活化 + 极简）
- 生活化（消费级）但极简：更大圆角、舒适留白、图片优先。  
  Consumer-friendly but minimal: larger radius, comfortable spacing, image-first.
- Logo 为圆形容器，放标题旁边（更像消费品列表）。  
  Circular merchant logo next to title.
- v0.3 light-theme only。  
  v0.3 is light-theme only.

---

## 14) 验收标准 / Acceptance Criteria (v0.3)
- `/app`：移动端优先单列卡片；桌面自适配不破版。  
  `/app` renders single-column cards mobile-first; desktop adapts without breaking.
- Sort：仅 Newest/Oldest 两态切换生效，且排序基于 `created_at`。  
  Sort toggle works for Newest/Oldest only, based on `created_at`.
- Card click 打开 Decision Sheet，包含 View on website / note inline edit+save / delete。  
  Card click opens Decision Sheet with View on website / inline note edit+save / delete.
- `⋯` popover 仅两项：Edit note（打开并聚焦）/ Delete（无确认）。  
  `⋯` popover has only Edit note (opens+focus) and Delete (no confirm).
- Delete：soft delete + toast Undo（4s）；Undo 恢复同 id；失败回滚 UI。  
  Delete uses soft delete + Undo toast (4s); Undo restores same id; failures roll back UI.
- Decision Sheet 中删除成功后会关闭 sheet；Undo 不自动重开 sheet。  
  Deleting from sheet closes it on success; Undo does not auto-reopen.
- Floating GPT icon：下滑隐藏、上滑显示；不遮挡最后卡片内容。  
  Floating GPT icon hides on scroll down, shows on scroll up; never covers last card.
- Cheatsheet：Header 常驻入口；overlay 轻；Got it/Back to GPT 可用；空态按钮复用同一 overlay。  
  Cheatsheet is persistent; overlay is light; Got it/Back to GPT works; empty-state button reuses same overlay.
- Share：一键打开；Copy link；系统 share 不可用时自动降级；revoke 后 404 生效且可 regenerate。  
  Share is one-click; copy link works; system share degrades gracefully; revoke causes 404 and regenerate works.
- `/s/:share_id`：只读，无 PII，过滤 deleted items，revoked 必须 404；包含 personal_note 与 View on website。  
  `/s/:share_id` is read-only, no PII, filters deleted items, revoked returns 404; includes personal_note and View on website.

---
