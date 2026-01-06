# MVP_SPEC

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

