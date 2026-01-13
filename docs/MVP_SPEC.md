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
  - **不显示价格问号图标**（UI 简化，v0.9+）
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

---

## v0.9_SPEC (Social boost: Profile + Follow + List Switcher)

### 0) 一句话结论 / One-line summary
CN：v0.9 在保持"单用户单 wishlist（items 挂 user_id）"不变的前提下，引入**对外 Profile（nickname+avatar）**、Share 页登录后 **Follow list**、以及 `/app` 左上角的 **List Owner Switcher**（Me / Following），并定义 **Stop sharing vs Rotate link** 对 follower 访问的清晰语义。  
EN: v0.9 keeps the "single wishlist per user (items scoped to user_id)" model, while adding **public-facing Profile (nickname+avatar)**, **Follow-from-share** after login, and an `/app` top-left **List Owner Switcher** (Me / Following), with clear **Stop sharing vs Rotate link** semantics for follower access.

### 1) Goals / 目标
CN：
* 为每个用户提供可对外展示的基础信息：`nickname` + `avatar`（用于 `/app` header 与 `/s/:share_id`）。
* Share 页支持登录后 Follow：未登录提示 `Sign in to follow this list`；登录后可 `Follow this list`。
* `/app` 用**左上角切换器**替代 tab：显示"当前正在看的 list owner"的头像+昵称；下拉包含 `Me` 与 `Following`（含副标题）。
* Followed list 只读，展示字段与 share 页一致（不额外泄露信息）。
* 分享控制语义定型：
  * **Stop sharing**：旧链接 404；followers 失去访问；/app 显示该 list private/unavailable。
  * **Rotate link**：旧 share_id 404，新 share_id 可访问；**不影响 followers 访问**（sharing 仍开启）。
* 引入 `list_ref` 作为"list 语义主体"以避免未来沟通漂移（不等同于多 list）。

EN:
* Public-facing user basics: `nickname` + `avatar` for `/app` header and `/s/:share_id`.
* Follow from share page after login (`Sign in to follow this list` → `Follow this list`).
* Replace tabs with a top-left **switcher** showing the current list owner (avatar+nickname), with `Me` + `Following` sections (with subtitle).
* Followed lists are read-only and match the share page field allowlist.
* Sharing controls: Stop sharing removes access (including followers); Rotate invalidates old link but keeps follower access.
* Introduce `list_ref` as the semantic list identifier (without introducing multi-list UX).

### 2) Non-goals / 非目标
CN：
* 不做多 list 创建/管理（仍然单 list，items 按 user 聚合）。
* 不做头像上传、不依赖 OAuth 外链头像；只用内置方案（Tapback）。
* 不在 switcher 下拉里做取消关注（交互过重）；取消关注在被关注 list 详情页完成。
* 不做通知、评论、点赞、动态等重社交能力。

EN:
* No multi-list creation/management (still one list per user).
* No avatar upload; no reliance on OAuth avatar URLs; Tapback-only.
* No unfollow inside the switcher dropdown; unfollow happens on the followed list page.
* No notifications/comments/likes/activity feed.

### 3) Data model additions / 数据模型增量（Locked）

#### 3.1 `profiles`
CN：每用户一行；用于对外展示（non-PII）。  
EN: One row per user; public-facing (non-PII).

Fields (minimum):
* `user_id` uuid (pk)
* `nickname` text not null
* `avatar_name` text not null
* `created_at`, `updated_at`

#### 3.2 `follows`
CN：关注关系以 `list_ref` 表达"关注的是 list"。  
EN: Follow relationship targets a list via `list_ref`.

Fields (minimum):
* `follower_user_id` uuid
* `list_ref` text
* `created_at` timestamptz
* Constraint: unique `(follower_user_id, list_ref)`

#### 3.3 `list_ref` 规范（必须写入文档，防漂移）/ list_ref convention (Locked)
CN：
* v0.9 仅支持默认 list：`list_ref = "u:<owner_user_id>"`。
* 保留前缀扩展：未来实体 list 可使用 `l:<list_id>`（v0.9 不实现）。
* Public surfaces（如 `/s/:share_id`）不得输出 `list_ref`、`user_id`、email。

EN:
* v0.9 supports only the default list: `list_ref = "u:<owner_user_id>"`.
* Reserve `l:<list_id>` for future multi-list (not in v0.9).
* Public surfaces must not expose `list_ref`, `user_id`, or email.

### 4) Web APIs（cookie session）/ Web APIs (cookie session)

#### 4.1 Profile
* `GET /api/profile` → `{ nickname, avatar_name }`
* `PATCH /api/profile` body `{ nickname?, avatar_name? }` → `{ ok: true, profile: ... }`

CN：校验（Locked）：nickname 非空（trim 后 1..50）；avatar_name 非空。  
EN: Validation (Locked): nickname must be non-empty after trim (1..50); avatar_name required.

#### 4.2 Follows
* `GET /api/follows` → `{ following_count, following: [{ list_ref, owner: { nickname, avatar_name } }] }`
* `POST /api/follows` body `{ share_id }` → `{ ok: true, list_ref, owner: { nickname, avatar_name } }`
* `DELETE /api/follows` body `{ list_ref }` → `{ ok: true }`

CN：follow 必须幂等（重复 follow 不报错，仍返回 ok）。  
EN: Follow must be idempotent (repeated follow returns ok).

#### 4.3 Followed list items（只读）/ Followed list items (read-only)
* `GET /api/items?scope=followed&list_ref=...`

CN：必须校验当前用户确实 follow 该 list_ref。如果 owner 的 sharing disabled，返回 `{ sharing_disabled: true, owner: { nickname, avatar_name } }`。  
EN: Must verify the caller follows the list_ref. If sharing disabled, return `{ sharing_disabled: true, owner: { nickname, avatar_name } }`.

### 5) UX Contract / 页面与交互契约（Locked）

#### 5.1 `/onboarding/profile`（软必填）/ Soft-required onboarding
CN：
* 若用户 profile 未完成（无 nickname 或无 avatar_name），登录后进入 `/onboarding/profile?next=...`。
* 默认昵称：`Me`（用户可改；允许 Skip，但系统必须落一个可用昵称）。
* 头像选择：每次展示 **5 个随机头像**；按钮 `Try 5 more` 可再随机 5 个；用户选 1 个后保存。
* 头像来源：Tapback；保存的是 `avatar_name`（字符串），不保存 URL。
* Skip 行为：允许跳过，但必须自动生成并保存一个 `avatar_name`。

EN:
* If profile is incomplete (missing nickname or avatar_name), route to `/onboarding/profile?next=...` after login.
* Default nickname is `Me` (editable; Skip allowed but must still persist a usable nickname).
* Avatar picker shows **5 random** options; `Try 5 more` refreshes the set; user selects one to save.
* Tapback-backed; persist `avatar_name` only (no URL persistence).
* Skip must still auto-generate and save `avatar_name`.

#### 5.2 `/app` Header：List Owner Switcher（无 tab）
CN：
* 左上角永远显示：**当前正在看的 list owner** 的 `avatar + nickname`，并带一个切换 icon（swap）。
* swap icon 显隐：**当且仅当 following_count > 0 时显示**；否则隐藏。
* 点 header 打开下拉：
  * Section：`Me`（仅 1 条：自己的头像+昵称）
  * Section：`Following`（副标题；列出关注的 lists：头像+昵称）
* 下拉只负责切换，不提供 unfollow。

EN:
* Top-left header always shows the **currently viewed list owner** (avatar+nickname) with a swap icon.
* Swap icon is shown **only when following_count > 0**; otherwise hidden.
* Dropdown sections: `Me` (single entry) and `Following` (subtitle + list entries).
* Dropdown is for switching only; no unfollow actions inside.

#### 5.3 Followed list 视图（只读）/ Followed list view (read-only)
CN：
* 当切换到 followed list：页面必须显式只读（隐藏编辑/删除按钮）。
* 展示字段必须与 share 页 allowlist 一致（不展示额外内部信息）。
* 取消关注入口放在该 list 的页面内（例如 `Following ✓` 按钮 → 确认后 unfollow）。

EN:
* Followed lists must be clearly read-only (hide edit/delete buttons).
* Field allowlist must match the share page.
* Unfollow lives on the followed list page (e.g., `Following ✓` → confirm → unfollow).

#### 5.4 `/s/:share_id` → 登录/关注 → `/app` 衔接
CN：
* Header 布局：登录后显示选择器 UI（与 `/app` 对齐），包含 Me 和 Following 列表；未登录显示简单 header。
* 未登录：底部悬浮 CTA 显示 `Sign In`；点击跳转到登录页。
* 登录后未 follow：底部悬浮 CTA 显示 `Follow`（带 UserPlusIcon）；点击后 follow 并跳转到 `/app`。
* 已 follow 或 isOwner：不显示底部悬浮 CTA。
* Follow 成功后跳转到 `/app`，并默认选中该 owner 的 list（用户不会迷路）。
* 选择器列表：不包含当前 share 页面（除非已 follow），切换后无法通过选择器返回（只能通过链接）。
* 移除 "This list is read-only." 副标题（UI 简化）。
* Header 右侧：登录后显示 Settings 按钮；已 follow 时显示 "Following ✓" 状态。

EN:
* Header layout: logged-in shows switcher UI (aligned with `/app`) with Me and Following sections; logged-out shows simple header.
* Logged-out: bottom floating CTA shows `Sign In`; click redirects to login.
* Logged-in not following: bottom floating CTA shows `Follow` (with UserPlusIcon); click follows and redirects to `/app`.
* Already following or isOwner: no bottom floating CTA.
* On follow success, deep-link to `/app` with the owner selected by default.
* Switcher list: excludes current share page (unless following); switching away requires link to return.
* Removed "This list is read-only." subtitle (UI simplification).
* Header right: logged-in shows Settings button; shows "Following ✓" when following.

### 6) Sharing semantics for followers / 分享语义（影响 follower 访问，Locked）
CN：
* **Stop sharing**：通过 revoke active share 达成；结果：
  * share link 立即 404（沿用 §2.2.2）
  * followers 访问也失效（/app 显示 private/unavailable 状态页）
* **Rotate link**：旧 share_id 404，新 share_id 可访问；并且：
  * **followers 不应失去访问**（sharing 仍为 enabled）
  * 实现需避免"rotate 过程短暂无 active share"导致 follower 访问抖动（推荐事务化 rotate：revoke+create 原子化）。

EN:
* Stop sharing revokes the active share: link 404 and followers lose access.
* Rotate invalidates the old link and issues a new one, while **keeping follower access**; implement rotate atomically to avoid transient access loss.

### 7) Acceptance / 验收用例（最小集合）
CN：
1. 新用户登录后若无 profile：进入 onboarding；默认昵称 `Me`；可随机 5 选 1 并保存；Skip 也会落 avatar_name。
2. `/app` header 显示我的头像+昵称；无 following 时不显示 swap icon。
3. 打开 `/s/:share_id`：展示 owner 头像+昵称与只读 items（non-PII）。
4. 未登录点击 `Sign in to follow` → 登录后回到 share 页 → Follow 成功跳 `/app` 且默认选中 owner；页面只读。
5. Rotate link：旧链接 404，新链接可访问；followers 仍可在 /app 访问该 list。
6. Stop sharing：链接 404；followers 在 /app 访问该 list 显示 private/unavailable。

EN:
(1) onboarding profile + defaults; (2) header switcher rules; (3) share page non-PII; (4) follow deep-link to `/app`; (5) rotate keeps follower access; (6) stop sharing removes follower access.

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
- Button spacing: `flex gap-2` (aligned across all pages, v0.9+)
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

### 5) Button text logic (Locked)
CN：
- `/app` 查看自己的 list：显示 "Buy with AI"
- `/app` 查看 followed list：显示 "Gift with AI"
- `/s/:share_id` 查看自己的 share（isOwner=true）：显示 "Buy with AI"
- `/s/:share_id` 查看别人的 share（isOwner=false）：显示 "Gift with AI"

EN:
- `/app` viewing own list: "Buy with AI"
- `/app` viewing followed list: "Gift with AI"
- `/s/:share_id` viewing own share (isOwner=true): "Buy with AI"
- `/s/:share_id` viewing others' share (isOwner=false): "Gift with AI"

### 6) Acceptance criteria
- All 4 locations show correct button based on context (see §5)
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
