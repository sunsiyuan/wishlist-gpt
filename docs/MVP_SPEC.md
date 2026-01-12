# MVP_SPEC

> CN：本文件是 WishlistGPT 的**对外 contract + 验收标准**（normative）。  
> EN: This file is the **normative external contract + acceptance criteria** for WishlistGPT.

---

## 0) 文档约定 / Doc conventions

### 0.1 规范范围 / What this spec controls
CN：
- 本文件定义**对外可见的行为与接口 contract**（Actions/OpenAPI + Web API + Web pages 的关键语义）。
- 若代码与本文件不一致：**以本文件为准**，应更新代码或更新本文件（保持一致）。

EN:
- This defines the **externally visible contract** (Actions/OpenAPI + Web APIs + key page semantics).
- If code diverges: **this file wins**; update code or update this file (keep them in sync).

### 0.2 双语格式 / Bilingual format
CN：默认采用 `中文一行 + 英文一行`（或同一条 bullet 的 `CN/EN` 并列）。  
EN: Default style is `CN line + EN line` (or CN/EN paired bullets).

### 0.3 “Locked” 与 “Best-effort” / “Locked” vs “Best-effort”
CN：
- **Locked**：必须满足；否则视为不符合验收。
- **Best-effort**：尽量做，但失败不得阻塞核心链路。

EN:
- **Locked**: must hold; otherwise it fails acceptance.
- **Best-effort**: try your best, but failures must not block the core loop.

---

## 1) 认证模型（统一定义）/ Auth model (single source of truth)

### 1.1 两种认证 / Two auth modes
CN：
- **OAuth Bearer（Actions）**：用于 `/me`、`/items`、`/shares`、`/feedback`。Header：`Authorization: Bearer <access_token>`  
- **Supabase Cookie Session（Web）**：用于 `/app` 与所有 `/api/*` web endpoints（shares/items note/delete/restore/feedback 等）。

EN:
- **OAuth Bearer (Actions)**: for `/me`, `/items`, `/shares`, `/feedback`. Header: `Authorization: Bearer <access_token>`  
- **Supabase Cookie Session (Web)**: for `/app` and all `/api/*` web endpoints (shares/items note/delete/restore/feedback, etc.).

### 1.2 明确禁止 / Explicitly disallowed
CN：
- `/api/shares*` **只允许 cookie session**（显式拒绝 Authorization 头）。  
- `/me`、`/items` 与 `/shares` **必须支持 Bearer**（Actions 必须可用）。

EN:
- `/api/shares*` is **cookie-session only** (explicitly rejects Authorization headers).  
- `/me`, `/items`, and `/shares` **must support Bearer** (Actions must work).

### 1.3 生产默认（明确关键开关）/ Production defaults (key toggle)
CN：
- 生产环境中，若 `OAUTH_ALLOW_AUTH_HEADER_LOGIN` **未设置**，默认 **禁用** “Supabase Authorization 头部登录绕过”，仅允许 cookie-based session（Web）。  
- 注意：OAuth Bearer 校验（`/me`, `/items`, `/feedback`）**不受**该开关影响，始终使用 `Authorization: Bearer` 校验。

EN:
- In production, when `OAUTH_ALLOW_AUTH_HEADER_LOGIN` is **unset**, the Supabase “Authorization header login bypass” is **disabled** by default; Web auth is cookie-session only.  
- Note: OAuth Bearer verification (`/me`, `/items`, `/feedback`) is **not gated** by this flag; it always uses `Authorization: Bearer`.

### 1.4 最小隐私与安全基线（Locked）/ Minimal privacy & security baseline (Locked)
CN：
- Public share 页面严格 non-PII：不输出 `user_id`、email、任何鉴权/内部字段（见 §2.2.1）。  
- 追踪与反馈的 `meta` 应“够用但克制”：只记录诊断所需字段，避免写入 PII。  
- 任何网络抓取/enrichment 必须做 SSRF 防护、redirect 复检、超时与大小限制（见 v0.4）。  
- 具体安全细则与运维准则以 `SECURITY.md` 为准（本文件只保留最关键的对外 contract）。

EN:
- Public share pages must be non-PII: never return `user_id`, email, or any auth/internal fields (see §2.2.1).  
- Tracking/feedback `meta` should be “useful but minimal”: log only what’s needed for debugging; avoid PII.  
- Any fetch/enrichment must implement SSRF protections, redirect re-checks, hard timeouts and size caps (see v0.4).  
- For detailed security/ops guidance, `SECURITY.md` is the source of truth (this spec keeps only the external contract).

---

## 2) 核心对象与语义（统一定义）/ Core entities & semantics (single definition)

## 2.1 Item（wishlist item）
CN：Item 是“用户收藏的一条记录”，核心为 `url_original`，展示字段为 `display_*` 快照（best-effort）。  
EN: An Item is a user-owned wishlist record; `url_original` is the core, and `display_*` are best-effort display snapshots.

### 2.1.1 排序与过滤（Locked）/ Sorting & filtering (Locked)
CN：
- 列表读取必须过滤：`deleted_at IS NULL`。  
- 列表排序**只按 `created_at`**（Newest/Oldest 两态）。  
- 编辑 `personal_note`、异步 enrichment 更新 `display_*` **不得改变排序位置**。

EN:
- List reads must filter: `deleted_at IS NULL`.  
- List ordering uses **`created_at` only** (Newest/Oldest).  
- Editing `personal_note` and async enrichment updates **must not reorder** items.

### 2.1.2 display_* 的语义 / Semantics of display_*
CN：
- `display_*` 是展示快照：允许为空、不保证实时、不作为主键/幂等键。  
- `display_price_updated_at` 只在价格字段被写入/更新时变化；不得被 touch/note/非价格补全误更新。

EN:
- `display_*` are display snapshots: nullable, not real-time, not identity keys.  
- `display_price_updated_at` updates only when price fields change; it must not be bumped by touch/note/non-price fills.

### 2.1.3 Soft delete（Locked）/ Soft delete (Locked)
CN：
- 删除采用 soft delete：`deleted_at = now()`；restore 清空 `deleted_at`。  
- delete/restore **必须幂等**（重复请求不报错）。

EN:
- Deletion is soft delete: `deleted_at = now()`, restore clears `deleted_at`.  
- delete/restore **must be idempotent**.

---

## 2.2 Share（公开分享链接）
CN：Share 是“每用户最多一个 active share（`revoked_at is null`）”的只读公开入口 `/s/:share_id`。  
EN: Share is a per-user public read-only entry `/s/:share_id`, with at most one active share (`revoked_at is null`).

### 2.2.1 PII 边界（Locked）/ PII boundary (Locked)
CN：
- `/s/:share_id` 不得输出 `user_id`、email、任何鉴权/内部追踪字段。  
- 推荐 allowlist 输出：`display_*`、`personal_note`、`source_url`。

EN:
- `/s/:share_id` must not output `user_id`, email, or any auth/internal tracking fields.  
- Suggested allowlist: `display_*`, `personal_note`, `source_url`.

### 2.2.2 revoke 行为（Locked）/ Revoke semantics (Locked)
CN：revoke 后同链接必须立即 404（与不存在一致）。  
EN: After revoke, the same URL must 404 immediately (indistinguishable from not found).

---

## 2.3 Tracking（最小埋点）
CN：埋点写入 `events` 表，必须 best-effort 且不阻塞渲染/接口响应。  
EN: Tracking writes to `events` and must be best-effort and non-blocking.

---

## 2.4 Feedback（用户反馈）
CN：反馈写入 `feedback` 表，最小限流 1/min/user，覆盖 Web + Actions。  
EN: Feedback writes to `feedback` with a minimal 1/min/user rate limit across Web + Actions.

---

## 3) 数据模型摘要 / Data model summary

> CN：这里只列“语义上被 spec 依赖的字段/约束”。  
> EN: This lists only the fields/constraints that the spec relies on.

### 3.1 items
- `id` uuid
- `user_id` uuid
- `url_original` text
- `source_url` text nullable
- `personal_note` text nullable
- `deleted_at` timestamptz nullable
- `created_at` timestamptz
- `updated_at` timestamptz
- `display_cover_image_url` text nullable
- `display_product_title` text nullable
- `display_merchant_logo_url` text nullable
- `display_merchant_domain` text nullable
- `display_price_amount_minor` int nullable
- `display_currency` text nullable
- `display_price_text` text nullable
- `display_price_updated_at` timestamptz nullable

### 3.2 shares
- `id` uuid (share_id)
- `user_id` uuid
- `created_at` timestamptz
- `revoked_at` timestamptz nullable
- Constraint: partial unique index `unique(user_id) where revoked_at is null`

### 3.3 events
- `event_name` text (namespaced)
- `occurred_at` timestamptz
- `user_id` uuid nullable
- `share_id` uuid/text nullable
- `client_id` text nullable
- `meta` jsonb not null default `{}`  
- Dedupe: unique `(event_name, meta->>'request_id')`

### 3.4 feedback
- `id` uuid
- `user_id` uuid
- `message` text
- `created_at` timestamptz
- `meta` jsonb not null default `{}`  
- Index: `(user_id, created_at desc)`

### 3.5 oauth_codes / oauth_tokens
- 见 v0.1（OAuth bridge）章节。

---

## 4) API Contract（按“对外入口”组织）/ API contract (by external surface)

## 4.1 OAuth bridge（Actions Connect 必需）/ OAuth bridge (required for Actions Connect)

### 4.1.1 `GET /api/oauth/authorize`（alias: `GET /oauth/authorize`）
CN：签发 authorization code，并 redirect 到 allowlisted `redirect_uri`。  
EN: Issues an authorization code and redirects to allowlisted `redirect_uri`.

### 4.1.2 `POST /api/oauth/token`（alias: `POST /oauth/token`）
CN：支持 `authorization_code` 与 `refresh_token` 两种 grant。  
EN: Supports both `authorization_code` and `refresh_token` grants.

---

## 4.2 Actions APIs（Bearer）/ Actions APIs (Bearer)

### 4.2.1 `GET /me`
Response:
```json
{ "user_id": "string", "client_id": "string" }
```

### 4.2.2 `GET /items`
Response (additive):
```json
{
  "items": [
    {
      "id": "uuid",
      "url_original": "string",
      "source_url": "string|null",
      "personal_note": "string|null",
      "deleted_at": "timestamptz|null",
      "created_at": "timestamptz",
      "updated_at": "timestamptz",

      "display_cover_image_url": "string|null",
      "display_product_title": "string|null",
      "display_merchant_logo_url": "string|null",
      "display_merchant_domain": "string|null",
      "display_price_amount_minor": 1234,
      "display_currency": "USD",
      "display_price_text": "string|null",
      "display_price_updated_at": "timestamptz|null"
    }
  ]
}
```

CN：必须满足 §2.1.1 的排序/过滤规则（deleted filter + created_at ordering）。  
EN: Must follow §2.1.1 (deleted filter + created_at ordering).

### 4.2.3 `POST /items`（idempotent create/touch）
Request (url required; display_* optional as hints):
```json
{
  "url": "string",

  "display_cover_image_url": "string (optional)",
  "display_product_title": "string (optional)",
  "display_merchant_logo_url": "string (optional)",
  "display_merchant_domain": "string (optional)",
  "display_price_amount_minor": 1234,
  "display_currency": "USD",
  "display_price_text": "string (optional)"
}
```

Response:
```json
{
  "item": {
    "id": "uuid",
    "url_original": "string",
    "source_url": "string|null",
    "personal_note": "string|null",
    "deleted_at": "timestamptz|null",
    "created_at": "timestamptz",
    "updated_at": "timestamptz",

    "display_cover_image_url": "string|null",
    "display_product_title": "string|null",
    "display_merchant_logo_url": "string|null",
    "display_merchant_domain": "string|null",
    "display_price_amount_minor": 1234,
    "display_currency": "USD",
    "display_price_text": "string|null",
    "display_price_updated_at": "timestamptz|null"
  }
}
```

CN：display hints 校验失败应“忽略该字段，不影响创建成功”；异步 enrichment 不得阻塞响应。  
EN: Invalid display hints must be ignored (do not fail the request); async enrichment must not block.

### 4.2.4 `POST /shares`（create-or-reuse active share）
CN：返回 `{ share_id, share_url }`，`share_url` 必须为绝对 URL（`/s/:share_id`）。  
EN: Returns `{ share_id, share_url }` where `share_url` is an absolute URL (`/s/:share_id`).

### 4.2.5 `POST /feedback`（v0.5，Bearer）
CN：与 `POST /api/feedback` 同 shape/validation/response。  
EN: Same shape/validation/response as `POST /api/feedback`.

---

## 4.3 Web Pages（页面语义，非纯 API）/ Web pages (semantic contract)

### 4.3.1 `/login`
CN：支持 Supabase Google 登录和 Email OTP（6 位码）登录；成功后进入 `/onboarding`（或 `next=`）。  
EN: Supports Supabase Google login and Email OTP (6-digit code) login; lands on `/onboarding` (or `next=`).

CN：Email OTP 流程：输入 email → 请求 6 位码 → 输入 code → 验证登录/注册。  
EN: Email OTP flow: enter email → request 6-digit code → enter code → verify login/signup.

### 4.3.2 `/app`（cookie session gated）
CN：显示单列列表 + sort toggle + share controls + cheatsheet + decision sheet（详见 v0.3）。  
EN: Shows single-column list + sort toggle + share controls + cheatsheet + decision sheet (see v0.3).

### 4.3.3 `/s/:share_id`（public read-only）
CN：公开可访问；revoked 或不存在 → 404；不泄露 PII；过滤 deleted。  
EN: Public; revoked/not found → 404; no PII; filters deleted.

---

## 4.4 Web APIs（cookie session）/ Web APIs (cookie session)

### 4.4.1 Shares（v0.2）
- `POST /api/shares`：create-or-reuse active share → `{ share_id, share_url }`
- `POST /api/shares/rotate`：revoke active then create new → `{ share_id, share_url }`
- `POST /api/shares/:id/revoke`：idempotent revoke → `{ ok: true }`

CN：必须满足“一用户仅一个 active share”的约束与 §2.2.2 的 404 语义。  
EN: Must enforce single active share and §2.2.2 404 semantics.

### 4.4.2 Items web-only mutations（v0.3）
#### `PATCH /api/items/:id/note`
Request:
```json
{ "personal_note": "string|null" }
```
Response:
```json
{ "ok": true, "item": { "id": "uuid", "personal_note": "string|null", "updated_at": "timestamptz" } }
```

#### `POST /api/items/:id/delete`
Response:
```json
{ "ok": true }
```

#### `POST /api/items/:id/restore`
Response:
```json
{ "ok": true }
```

CN：仅 cookie session；delete/restore 幂等；列表语义遵循 §2.1.1。  
EN: Cookie-only; idempotent delete/restore; list semantics follow §2.1.1.

### 4.4.3 Tracking endpoints（v0.2 + v0.7）
#### `POST /api/track/share-view`（public, v0.2）
CN：
- 在浏览器访问 `/s/:share_id` 时 fire-and-forget 调用。  
- 写入 `events`：`event_name='web.share.page_view'`，`share_id` 必填，`user_id` 若已登录则填，否则 null。  
- **HEAD 请求不得写入事件**。

EN:
- Fire-and-forget from `/s/:share_id`.  
- Writes `events`: `event_name='web.share.page_view'`, `share_id` required, `user_id` set if authenticated otherwise null.  
- **HEAD must not write events**.

#### `POST /api/track/event`（cookie session, v0.7）
CN：
- 通用客户端事件追踪端点，接收 `{ event_name: string, meta?: Record<string, unknown> }`。  
- 从 session 获取 `user_id`（如果已登录）。  
- 客户端生成 `request_id`（UUID）放入 meta，服务端通过 unique index 去重。  
- 使用 `trackBestEffort` 确保非阻塞。  
- 返回 204 No Content（成功）或 400（参数错误）。

EN:
- Generic client-side event tracking endpoint, accepts `{ event_name: string, meta?: Record<string, unknown> }`.  
- Gets `user_id` from session (if authenticated).  
- Client generates `request_id` (UUID) in meta; server dedupes via unique index.  
- Uses `trackBestEffort` to ensure non-blocking.  
- Returns 204 No Content (success) or 400 (invalid params).

### 4.4.4 Feedback（v0.5）
#### `POST /api/feedback`（cookie session）
Request:
```json
{
  "message": "string",
  "context": {
    "page": "/app | /s/:share_id | ...",
    "share_id": "optional",
    "item_id": "optional",
    "source_url": "optional"
  }
}
```
Response:
```json
{ "ok": true }
```

Validation & rate limit (Locked):
- `message` trimmed length 1..1000
- 60s 内重复提交：429 `{ "ok": false, "error": "rate_limited" }`
- `meta` must include: `context`(if any) + `request_id` + `x_vercel_id` + `ua`

---

# 5) Version Specs（按版本组织；避免重复）/ Version specs (organized; de-duplicated)

> CN：版本章节主要回答“为什么做、验收是什么”。接口与语义的**唯一来源**是 §1–§4。  
> EN: Version sections focus on “why” and acceptance. The **single source of truth** for contracts is §1–§4.

---

## v0.1_SPEC (GPT MVP: OAuth bridge + /me + /items)

### 0) 一句话结论 / One-line summary
CN：v0.1 只保证 Actions 闭环：OAuth Connect → `GET /me` → `POST /items` → `GET /items`，且 OpenAPI 可导入。  
EN: v0.1 guarantees the Actions loop: OAuth Connect → `GET /me` → `POST /items` → `GET /items`, and importable OpenAPI.

### 1) 目标与非目标 / Goals & non-goals
Goals:
- OAuth authorization-code flow for Actions (bridge)
- Bearer-protected `/me` and `/items`
- OpenAPI generated from template and importable by Actions

Non-goals:
- Share pages
- URL normalization / product scraping
- Web UI / delete / notes (introduced later)

### 2) 已实现清单（v0.1 基线）/ Implemented baseline (v0.1)
- OAuth: `GET /api/oauth/authorize` + `POST /api/oauth/token` (and aliases)
- Protected APIs: `GET /me`, `GET /items`, `POST /items`
- OpenAPI: render `actions/openapi.template.yaml` → `public/openapi.yaml`
- Logout testing utility (not in Actions contract): `GET /logout`, `POST /api/logout`

CN：任何不在此列表的能力，视为未实现。  
EN: Anything not explicitly listed here is considered not implemented.

### 3) 验收 / Acceptance
Script-level:
- `npm run smoke:oauth` passes (OAuth flow + `/me`)
- `npm run smoke:items` passes (`/items` POST + GET)

Actions-level:
- Actions can import `public/openapi.yaml`
- After Connect: `getMe → createItem → listItems` succeeds

---

## v0.2_SPEC (Growth MVP: /app + shares + public share + minimal tracking)

### 0) 一句话结论 / One-line summary
CN：v0.2 在 v0.1 之上新增 Web：`/app` 私有列表、`/s/:share_id` 公开只读分享、shares APIs，以及最小埋点落库。  
EN: v0.2 adds Web surfaces on top of v0.1: private `/app`, public read-only `/s/:share_id`, shares APIs, and minimal tracking.

### 1) Goals
- Authenticated list UI `/app` (cookie session)
- Share link generation + revoke/rotate (one active share per user)
- Public share page `/s/:share_id` (no PII leakage)
- Minimal tracking (non-blocking): `web.app.items_list_load`, `web.share.page_view`

### 2) Non-goals
- No product scraping / OG poster
- No analytics dashboard (SQL only)
- No complex abuse controls (beyond minimal dedupe)

### 3) Tracking details (Locked)
Event names:
- `web.app.items_list_load`
- `web.share.page_view`

Meta fields (Locked):
- `meta.request_id` (UUID generated once per request)
- `meta.x_vercel_id` (nullable)
CN：埋点写入必须 best-effort，不能阻塞页面渲染/API 响应。  
EN: Tracking must be best-effort and must not block page/API responses.

### 4) 验收 / Acceptance
Manual:
1. Google 登录后进入 `/app`，能看到 items 列表（排序/过滤遵循 §2.1.1）。  
2. `/app` Share 生成 `share_url`，无痕打开 `/s/<share_id>` 可见只读列表。  
3. revoke/rotate 后旧链接 404。  
4. Public page 不泄露 PII（源码/响应中不出现 `user_id`、`@` 等）。

SQL:
- `/app` list load → `events(event_name='web.app.items_list_load', user_id=<me>)`
- `/s/:share_id` view → `events(event_name='web.share.page_view', share_id=<share_id>)`

---

## v0.3_SPEC (Consumer minimal UI + Notes + Delete/Undo + Share Sheet)

### 0) 一句话结论 / One-line summary
CN：v0.3 引入“消费者 UI”与“快速决策”：单列卡片 `/app`、Decision Sheet、`personal_note`、soft delete + Undo、分享面板。  
EN: v0.3 adds consumer UI and quick decisions: card list `/app`, Decision Sheet, `personal_note`, soft delete + Undo, and Share sheet.

### 1) 核心功能 / Core features
CN：
1) `/app` 单列卡片浏览（移动端优先）。  
2) Sort toggle：Newest ↔ Oldest（只按 `created_at`）。  
3) 卡片展示：封面、标题、商家 logo、价格（best-effort）、备注预览。  
4) Decision Sheet：View on website + note inline edit/save + Delete。  
5) Delete：无确认、soft delete、4s Undo toast（仅保证最近一次删除可撤销）。  
6) Cheatsheet：Header 入口；空态按钮复用。  
7) Share：Share sheet（copy link / system share / revoke / regenerate）。  
8) Floating Return（GPT icon）：下滑隐藏，上滑显示，不遮挡最后卡片。

EN: (mirrors CN; see detailed UI spec below.)

### 2) 非目标 / Non-goals
- Web 不提供 Add item（不支持从 URL 添加，不做 web chat）
- Web 不允许编辑 `display_*`（只允许改 `personal_note`）
- v0.3 light theme only
- 不做多 list / settings 页面 / poster 海报

### 3) 详细 UI/UX 规范（Locked）/ Detailed UI/UX (Locked)
> 说明 / Note: 以下为 v0.3 的“体验 contract”，用于 QA 与实现对齐。

#### 3.1 `/app` layout
- Header（non-sticky）：Left `WishlistGPT`, Right `Cheatsheet`
- List top bar：Left sort toggle, Right `Share`
- List bottom padding：避免浮动 Return 按钮遮挡

#### 3.2 Card rendering rules (must avoid noisy error UI)
- Cover: always render 1:1 container; image failure → placeholder; no infinite retry
- Merchant logo: only render container when logo exists; failure → fallback (domain initial or icon)
- Domain fallback priority:
  1) `display_merchant_domain`
  2) parse from `source_url` host (strip `www.`)
  3) null
- Title fallback:
  - prefer `display_product_title`
  - else if domain: `From {domain}`
  - else `Untitled item`
- Price row:
  - render only when price exists (`display_price_text` or (`display_price_amount_minor` + `display_currency`))
  - otherwise omit the whole row (and omit `?` tooltip)
- Personal note preview:
  - if present: show 1–2 lines
  - else show secondary placeholder `Add a note…`

#### 3.3 Overflow menu (`⋯`)
- Popover with only:
  - `Edit note`
  - `Delete` (danger)

#### 3.4 Delete behavior (Locked)
- No confirmation
- May optimistically remove card, but **toast appears only after delete succeeds**
- Failure: rollback UI, show `Couldn’t delete. Try again.`
- Toast 4s: `Item deleted` + `Undo`
- Undo restores same id; only last delete is guaranteed undoable

#### 3.5 Decision Sheet
- Opens from card tap (~70% height; can expand)
- Content order: cover → title+logo → price → note editor (+ inline Save) → `View on website` (primary) → `Delete` (implicit text link)
- If Delete triggered in sheet: close sheet after success
- `View on website` uses `source_url` (desktop opens new tab; mobile same tab)

#### 3.6 Share sheet
- Shows active share on open; if none, creates one
- Copy link always available; system share only if available
- Revoke link → shows disabled state + `Generate new link`

### 4) v0.3 验收 / Acceptance
- `/app` renders correctly on mobile and desktop (single column)
- Sort toggle works (created_at only; no reorder on note edit)
- Card → Decision Sheet works; note edit/save works
- Delete is soft + Undo; idempotent; rollback on failure
- Share sheet works; revoke makes `/s/:share_id` 404; regenerate works
- `/s/:share_id` read-only, filters deleted, no PII, includes personal_note + `View on website`

---

## v0.4_SPEC (GPT Created Item Enrichment: display snapshot via GPT hints + server best-effort)

### 0) 一句话结论 / One-line summary
CN：v0.4 让 GPT 在 `POST /items` 时尽量写入 `display_*`（hints），服务端异步 enrichment 兜底补全缺失字段，且不阻塞响应。  
EN: v0.4 lets GPT send `display_*` hints during `POST /items`, with async server enrichment to backfill missing fields without blocking.

### 1) 范围 / Scope
- No new tables/columns (reuse v0.3 `display_*`)
- Additive API schema update so Actions can send/receive `display_*`
- Async enrichment is non-blocking; fill-only by default (no override)

### 2) `POST /items` behavior (two-phase)
Phase 1 (sync):
1) Perform idempotent create/touch first (preserve semantics)  
2) Validate and persist provided `display_*` hints (local-only validation; ignore invalid fields; never fail success)  
3) Optional deterministic no-network fills:
   - derive `display_merchant_domain` from URL host if missing
   - set deterministic favicon URL for `display_merchant_logo_url` if missing

Phase 2 (async):
- Fetch/parse URL to fill missing `display_*` (best-effort, non-blocking)
- Enforce SSRF protections, redirect limit, body size cap, hard timeout
- Default policy: fill-only (do not overwrite existing non-null fields)

### 3) 安全 / Security (must hold)
- allow http/https only
- block localhost/private/metadata ranges (re-check after redirects)
- no user cookies; do not log full HTML bodies

### 4) 验收 / Acceptance
1) Actions `createItem(POST /items)` can include hints; response includes Phase-1 written/derived fields  
2) `listItems(GET /items)` returns items with `display_*` additively; may become richer after async runs  
3) Failures/timeouts do not block `POST /items` success  
4) v0.1 loop remains intact

---

## v0.5_SPEC (Feedback Loop)

### 0) 一句话结论 / One-line summary
CN：v0.5 新增反馈入口（Web + Actions）、落库与最小限流（1/min/user），并要求文档同步。  
EN: v0.5 adds feedback entrypoints (Web + Actions), persistence, and minimal rate limiting (1/min/user), with doc sync required.

### 1) Goals
- Web feedback entrypoints:
  - `/app` Cheatsheet → feedback modal
  - `/s/:share_id` footer `Feedback` (logged out → `/login?next=...&intent=feedback`)
- Actions endpoint: `POST /feedback` (Bearer)
- Store into `feedback` table with minimal context meta
- Rate limit: 1/min/user; message length ≤ 1000

### 2) Non-goals
- No anonymous feedback
- No categories/tags
- No admin dashboard / email notifications
- No large onboarding/UI overhaul

### 3) Validation & rate limit (Locked)
- message trimmed length 1..1000
- within 60s → 429 `{ ok:false, error:"rate_limited" }`
- meta includes: `context` (if provided), `request_id`, `x_vercel_id`, `ua`

### 4) 验收 / Acceptance
- `/app` feedback submits and writes to DB
- `/s/:share_id` feedback writes with `meta.context.share_id`
- Actions `POST /feedback` works and OpenAPI is importable
- 60s repeat → 429; >1000 chars → 400
- Docs sync: PROJECT_MAP + CHEATSHEET + MVP_SPEC updated (normative docs stay aligned)

---

## v0.6_SPEC (UI Upgrade: Tailwind CSS + Dark Mode + Heroicons)

### 0) 一句话结论 / One-line summary
CN：v0.6 引入 Tailwind CSS、暗黑模式、Heroicons 图标库，统一 UI 组件系统，提升视觉一致性与交互体验。  
EN: v0.6 introduces Tailwind CSS, dark mode, Heroicons library, and unified UI components for improved visual consistency and UX.

### 1) Goals
- Migrate all inline styles to Tailwind CSS utility classes
- Implement dark mode toggle (class strategy, localStorage persistence)
- Replace text/emoji icons with Heroicons (@heroicons/react/24/outline)
- Extract reusable UI components (Button, Card, DarkModeToggle)
- Optimize existing styles with subtle animations and transitions

### 2) Non-goals
- No design system overhaul (keep existing visual language)
- No new pages or major feature additions
- No icon library beyond Heroicons

### 3) Key changes
- Tailwind config: custom theme colors, dark mode class strategy, @tailwindcss/forms plugin
- Dark mode: toggle in settings page, persists in localStorage, respects system preference
- Icons: settings gear, sort arrows, share, price tooltip question mark → Heroicons
- Components: extracted Button, Card, DarkModeToggle for reuse

### 4) 验收 / Acceptance
- All pages render correctly in light and dark modes
- Dark mode toggle works and persists across sessions
- Icons display correctly (no emoji/text fallbacks)
- No visual regressions from v0.3 baseline
- Tailwind classes replace all inline styles

---

## v0.7_SPEC (User Behavior Tracking: Comprehensive Event Logging)

### 0) 一句话结论 / One-line summary
CN：v0.7 扩展埋点覆盖核心用户行为（认证、Item 操作、Share 操作、UI 交互），并实现日常指标推送（Telegram Bot + Vercel Cron）。  
EN: v0.7 extends tracking to cover core user behaviors (auth, item operations, share operations, UI interactions) and implements daily metrics push (Telegram Bot + Vercel Cron).

### 1) Goals
- Track user lifecycle events (login, onboarding)
- Track item operations (create, delete, restore, note update, view detail, click source URL)
- Track share operations (create, rotate, revoke, copy/native share)
- Track UI interactions (sort toggle, cheatsheet open)
- Daily metrics aggregation and Telegram push via Vercel Cron Jobs

### 2) Non-goals
- No analytics dashboard (SQL queries only)
- No real-time monitoring (daily batch only)
- No PII in event meta (minimal fields only)

### 3) Event naming convention (Locked)
Format: `{source}.{entity}.{action}`
- source: `web`, `actions`
- entity: `auth`, `item`, `share`, `app`, `settings`
- action: `create`, `update`, `delete`, `restore`, `view`, `click`, `toggle`, `share_action`

### 4) Meta fields (Locked)
- Minimal strategy: only IDs (`item_id`, `share_id`) and simple flags (`is_new_user`, `sort_order`, `action_type`)
- No PII: no URLs, text content, user input, sensitive info
- Dedupe: `request_id` (UUID) in meta, unique index `(event_name, meta->>'request_id')`

### 5) Daily metrics endpoint
#### `GET /api/metrics/daily` (Vercel Cron)
CN：
- Vercel Cron Jobs 每天 09:00 UTC 自动调用（`vercel.json` 配置）。  
- 查询基于事件的指标（DAU、新用户、Item/Share 操作数等）和基于数据表的指标（总 Item 数、Enrichment 成功率等）。  
- 通过 Telegram Bot API 发送格式化消息到指定 chat_id。  
- 验证：检查 `Authorization: Bearer ${CRON_SECRET}`（可选，Vercel 会自动添加 header）。

EN:
- Vercel Cron Jobs calls daily at 09:00 UTC (configured in `vercel.json`).  
- Queries event-based metrics (DAU, new users, item/share operations) and table-based metrics (total items, enrichment success rate).  
- Sends formatted message via Telegram Bot API to configured chat_id.  
- Auth: checks `Authorization: Bearer ${CRON_SECRET}` (optional, Vercel adds header automatically).

### 6) 验收 / Acceptance
- P0 events fire correctly: `web.auth.login_success`, `actions.item.create`, `web.item.delete`, `web.share.create`
- Client-side events work via `/api/track/event` endpoint
- Daily metrics endpoint returns 200 and sends Telegram message
- Vercel Cron Job executes daily (verify in Vercel dashboard)
- No blocking: all tracking uses `trackBestEffort` (non-blocking)

---

## v0.8_SPEC (Buy with AI / Gift with AI: Early Access Waitlist)

### 0) 一句话结论 / One-line summary
CN：v0.8 在 4 个位置（App Item Card/Sheet、Share Item Card/Sheet）添加 "Buy with AI" / "Gift with AI" 按钮，使用统一的 Early Access Modal 收集 waitlist，并加入每日监控指标。  
EN: v0.8 adds "Buy with AI" / "Gift with AI" buttons in 4 locations (App Item Card/Sheet, Share Item Card/Sheet), uses unified Early Access Modal for waitlist collection, and includes daily metrics tracking.

### 1) Goals
- Add "Buy with AI" buttons in App Item Card and Item Sheet (owner context)
- Add "Gift with AI" buttons in Share Item Card and Share Item Sheet (viewer context)
- Unified Early Access Modal with waitlist join functionality
- Event tracking: `web.ai.waitlist_join` with context (owner|share), surface (card|sheet), intent (buy|gift)
- Daily metrics: track AI waitlist joins (total, byIntent, bySurface)

### 2) Non-goals
- No actual Buy/Gift functionality implementation
- No payment or checkout integration
- No waitlist management UI beyond modal

### 3) UI/UX details (Locked)
- Button layout: "View on website" (primary) and "Buy/Gift with AI" (secondary) on same row for cards
- Early access badge: small label in top-right corner of button (iOS-style)
- Modal description: "Buy with AI / Gift with AI is coming soon. Join the waitlist to be notified when it's available."
- Button click events: use `event.stopPropagation()` to prevent card click triggering
- Disabled state: "View on website" button disabled when source_url is missing

### 4) Event tracking
- Event name: `web.ai.waitlist_join`
- Meta fields:
  - `context`: "owner" | "share"
  - `surface`: "card" | "sheet"
  - `intent`: "buy" | "gift"
  - `item_id`: string (optional)
  - `source_url`: string (optional, full URL) - **Note**: Exception to v0.7 minimal principle; used for AI waitlist analysis
  - `request_id`: string (UUID, client-generated)
- Daily metrics: query `web.ai.waitlist_join` events, group by `intent` and `surface`

### 5) Acceptance criteria
- All 4 locations show correct button ("Buy with AI" for owner, "Gift with AI" for share)
- Clicking button opens Early Access Modal
- Modal "Join waitlist & continue on website" button:
  - Tracks event `web.ai.waitlist_join` with correct meta fields
  - Opens source_url
  - Closes modal
- Button clicks do not trigger card click events (stopPropagation)
- "View on website" button disabled when source_url is missing
- Daily metrics Telegram message includes AI function metrics (total, byIntent, bySurface)

---

## 6) Parking Lot（future / 暂缓项）
CN：
- Apple 登录（等待 D-U-N-S / Apple Dev Program）
- OG 预览与 share poster
- Actions 埋点（`actions.get_me / actions.list_items / actions.create_item`）
- 更复杂的分享页风控（bot filter、rate limit、更细去重）

EN:
- Apple login (waiting for D-U-N-S / Apple Dev Program)
- OG preview and share poster
- Actions tracking (`actions.get_me / actions.list_items / actions.create_item`)
- Stronger public share abuse controls (bot filtering, rate limits, richer dedupe)
