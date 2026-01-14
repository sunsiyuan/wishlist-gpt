# CHEATSHEET

## 0) 目标：最小闭环 / Goal: the minimal closed loop
CN：你要跑通的闭环只有一条：**Actions Connect → getMe → createItem → listItems**。  
EN: There is only one loop you must get working: **Actions Connect → getMe → createItem → listItems**.

---

## 1) 一页 Happy Path（照着做）/ One-page happy path (do this in order)

### 1.1 设置环境变量 / Set env vars
必需 / Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`（或 / or `NEXT_PUBLIC_SUPABASE_ANON_KEY`）
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OAUTH_ALLOWED_CLIENTS_JSON`
- `OAUTH_SIGNING_SECRET`

可选但常用 / Optional but common:
- `OAUTH_ALLOW_AUTH_HEADER_LOGIN`
- `BASE_URL`
- `SUPABASE_SESSION_COOKIE_NAME`（smoke 脚本需要时覆盖 cookie 名称）
- `TELEGRAM_BOT_TOKEN`（反馈通知 Telegram Bot token）
- `TELEGRAM_CHAT_ID`（反馈通知 Telegram chat id）
- `OPENGRAPH_IO_APP_ID`（opengraph.io 兜底抓取）
- `CRON_SECRET`（Vercel Cron Jobs 安全密钥，可选）
- `OPS_EMAIL_ALLOWLIST`（Ops Queue 访问权限，JSON 数组格式，如：`["email1@example.com","email2@example.com"]`）
- `CHATGPT_GPT_URL` 或 `NEXT_PUBLIC_CHATGPT_GPT_URL`（ChatGPT GPT 链接，用于 App 的 Back-to-GPT 按钮和 homepage 的 Open ChatGPT 按钮）
  - Staging: `https://chatgpt.com/g/g-69590ec742ac819197255326adcf1f7a-wishlistgpt-staging`
  - Production（默认）: `https://chatgpt.com/g/g-6963d49d46b4819197ad331b3167c2e8-wishlistgpt`
  - 如果未设置，默认使用 production 链接

> CN：改 `.env*` 后，务必重启终端并重启 `npm run dev`（旧进程最容易误导你）。  
> EN: After changing `.env*`, restart your terminal and `npm run dev` (stale processes are the #1 confusion source).

### 1.2 启动 / Start
```bash
npm install
npm run dev
````

CN：访问 `/login` → Google 登录或邮箱登录 → 回到 `/app`（显示用户信息与列表）。  
CN：未登录访问 `/app` 会跳转 `/login`（预期）。  
EN: Visit `/login` → Google/email login → land on `/app` (shows user info + list).  
EN: Unauthed `/app` redirects to `/login` (expected).

### 1.2.5 v0.3 /app 使用说明 / Using /app in v0.3

CN：
- 顶栏 `Cheatsheet` 打开轻量弹层；空状态按钮也会打开同一弹层。
- 列表顶栏可切换 `Newest/Oldest`（只按 `created_at` 排序）。
- 点击卡片打开 Decision Sheet：编辑备注 + 保存、`View on website`、`Delete`。
- 删除成功后显示 4 秒 Undo；仅保证最近一次删除可撤销。
- Share 按钮打开 Share Sheet（复制链接、系统 Share、撤销/重建）。
- v0.3 仅浅色主题。

EN:
- Tap `Cheatsheet` in the header to open the lightweight sheet; empty state button opens the same sheet.
- Toggle `Newest/Oldest` in the list top bar (sorting uses `created_at` only).
- Tap a card to open the Decision Sheet: edit note + save, `View on website`, `Delete`.
- After delete succeeds, a 4s Undo toast appears; only the last delete is guaranteed.
- Share button opens the Share Sheet (copy link, system Share when available, revoke/regenerate).
- v0.3 is light-theme only.

### 1.2.7 v0.9 Profile & Follow 功能 / Profile & Follow features (v0.9)

CN：
- 新用户登录后，如果 profile 不完整（无 nickname 或无 avatar_name），会自动跳转到 `/onboarding/profile`。
- Onboarding 页面：设置昵称（默认 "Me"）和头像（Tapback，5 个随机，可 "Try 5 more"）。
- 允许 Skip，但系统会自动保存默认值。
- `/app` 左上角显示当前 list owner 的头像+昵称，可切换查看自己的 list 或 followed lists。
- Share 页（`/s/:share_id`）登录后可 Follow，Follow 成功后跳转到 `/app?list_ref=u:<owner_user_id>`。
- Followed list 是只读的（隐藏编辑/删除按钮）。
- 如果 owner stop sharing，followed list 会显示 "Owner has made it private" 状态页。

EN:
- New users are redirected to `/onboarding/profile` if profile is incomplete (missing nickname or avatar_name).
- Onboarding page: set nickname (default "Me") and avatar (Tapback, 5 random, "Try 5 more" available).
- Skip is allowed, but system auto-saves default values.
- `/app` top-left shows current list owner (avatar+nickname), can switch between own list and followed lists.
- Share page (`/s/:share_id`) allows Follow after login, redirects to `/app?list_ref=u:<owner_user_id>` on success.
- Followed lists are read-only (edit/delete buttons hidden).
- If owner stops sharing, followed list shows "Owner has made it private" status page.

### 1.2.6 v0.5 反馈入口 / Feedback entrypoints (v0.5)

CN：
- `/app` 打开 Cheatsheet → `Send feedback` 弹层 → 提交成功 toast “Thanks — received.”
- `/s/<share_id>` 底部 `Feedback` 按钮：
  - 已登录：打开反馈弹层。
  - 未登录：跳转 `/login?next=/s/<share_id>?intent=feedback`，登录后自动打开弹层。
- DB 验证：Supabase Table Editor 查看 `feedback` 表，或 SQL：
  ```sql
  select * from feedback where user_id = '<me>' order by created_at desc limit 5;
  ```
- 速验：
  - 连续提交两次，第二次返回 429（1 分钟内限流）。
  - message > 1000 字符返回 400。

EN:
- `/app` → Cheatsheet → `Send feedback` modal → success toast “Thanks — received.”
- `/s/<share_id>` footer `Feedback` button:
  - Logged in: opens modal.
  - Logged out: redirects to `/login?next=/s/<share_id>?intent=feedback`, auto-opens after login.
- DB check: use Supabase Table Editor for `feedback`, or SQL:
  ```sql
  select * from feedback where user_id = '<me>' order by created_at desc limit 5;
  ```
- Quick checks:
  - Submit twice quickly; second returns 429 (1/min rate limit).
  - message > 1000 chars returns 400.

### 1.2.1 Google OAuth (Supabase) setup checklist

CN：

* Supabase Auth → Providers → Google：启用并填好 Client ID/Secret
* Supabase Auth → URL Configuration：
  * Site URL: `http://localhost:3000`（本地）
  * Redirect URLs: `http://localhost:3000/auth/callback`（以及 preview/prod 域名）
* Google Cloud Console → OAuth consent screen 已发布并允许你的测试账号

EN:

* Supabase Auth → Providers → Google: enable + set Client ID/Secret
* Supabase Auth → URL Configuration:
  * Site URL: `http://localhost:3000` (local)
  * Redirect URLs: `http://localhost:3000/auth/callback` (plus preview/prod domains)
* Google Cloud Console → OAuth consent screen is published + your tester is allowed

### 1.2.2 Web auth flow (Supabase SSR)

```text
/login
  └─ signInWithOAuth(provider=google, redirectTo=/auth/callback)
      └─ Google consent
          └─ /auth/callback?code=...
              └─ exchangeCodeForSession
                  └─ set sb-* cookies
                      └─ /app
```

### 1.2.3 Callback behavior

* `/auth/callback` expects `?code=...`.
* Missing/invalid codes redirect to `/login?error=missing_code` or `/login?error=oauth_exchange_failed`.
* Successful exchange sets `sb-*` cookies and redirects to `/app` (or `next=` when present).


### 1.2.4 How to verify success

CN：

* 你会短暂看到 `/auth/callback?code=...`
* DevTools → Application → Cookies 里有 `sb-...` cookies
* `/app` 显示已登录邮箱，并能刷新保持登录

EN:

* You briefly hit `/auth/callback?code=...`
* DevTools → Application → Cookies shows `sb-...` cookies
* `/app` shows the logged-in email and stays logged in on refresh

### 1.3 生成 OpenAPI（需要时）/ Generate OpenAPI (when needed)

```bash
npm run gen:openapi
```

产物 / artifact: `public/openapi.yaml`

### 1.4 跑 smoke / Run smoke

```bash
npm run smoke:oauth
npm run smoke:items
npm run smoke:shares
npm run smoke:feedback
```

### 1.4.1 测试 URL 清洗规则 / Test URL sanitization

CN：测试 `canonical_url` 清洗逻辑（移除 tracking 参数、处理 fragment 等）：

EN: Test `canonical_url` sanitization logic (removing tracking params, handling fragments, etc.):

```bash
# 测试单个或多个 URL
node scripts/test-url-sanitize.mjs "https://example.com/product?utm_source=google&gclid=123"
node scripts/test-url-sanitize.mjs "https://example.com/product?utm_source=google&gclid=123" "https://another.com/item?fbclid=456"

# 不传参数时使用默认测试 URL
node scripts/test-url-sanitize.mjs
```

CN：
- 脚本会输出原始 URL 和清洗后的 URL
- 如果清洗失败（返回 null），会显示错误信息
- 脚本逻辑与 `src/server/items/sanitizeUrl.ts` 保持一致（需手动同步）

EN:
- Script outputs original URL and sanitized URL
- If sanitization fails (returns null), error message is shown
- Script logic matches `src/server/items/sanitizeUrl.ts` (manual sync required)

### 1.5 Shares（cookie session）/ Shares (cookie session)

CN：

1. 浏览器登录后，复制 `sb-...` cookies（DevTools → Application → Cookies）。
2. 连续调用两次 `/api/shares`，第二次应复用同一个 `share_id`。
3. 调用 `/api/shares/rotate` 应返回新的 `share_id`。
4. 调用 `/api/shares/<id>/revoke` 后，再访问 `/s/<id>` 必须 404。

```bash
curl -X POST "<BASE_URL>/api/shares" \
  -H "Cookie: sb-<project-ref>-auth-token=<AUTH>; sb-<project-ref>-refresh-token=<REFRESH>"
curl -X POST "<BASE_URL>/api/shares/rotate" \
  -H "Cookie: sb-<project-ref>-auth-token=<AUTH>; sb-<project-ref>-refresh-token=<REFRESH>"
curl -X POST "<BASE_URL>/api/shares/<SHARE_ID>/revoke" \
  -H "Cookie: sb-<project-ref>-auth-token=<AUTH>; sb-<project-ref>-refresh-token=<REFRESH>"
curl -X POST "<BASE_URL>/api/shares" \
  -H "Cookie: sb-<project-ref>-auth-token=<AUTH>; sb-<project-ref>-refresh-token=<REFRESH>"
```

EN:

1. After logging in via browser, copy the `sb-...` cookies (DevTools → Application → Cookies).
2. Call `/api/shares` twice; the second response should reuse the same `share_id`.
3. Call `/api/shares/rotate` and expect a new `share_id`.
4. Call `/api/shares/<id>/revoke`, then `/s/<id>` must 404.

```bash
curl -X POST "<BASE_URL>/api/shares" \
  -H "Cookie: sb-<project-ref>-auth-token=<AUTH>; sb-<project-ref>-refresh-token=<REFRESH>"
curl -X POST "<BASE_URL>/api/shares/rotate" \
  -H "Cookie: sb-<project-ref>-auth-token=<AUTH>; sb-<project-ref>-refresh-token=<REFRESH>"
curl -X POST "<BASE_URL>/api/shares/<SHARE_ID>/revoke" \
  -H "Cookie: sb-<project-ref>-auth-token=<AUTH>; sb-<project-ref>-refresh-token=<REFRESH>"
```

### 1.5.1 Profile & Follows（v0.9）/ Profile & Follows (v0.9)

CN：

1. 获取当前用户的 profile：`GET /api/profile` → `{ nickname, avatar_name }`
2. 更新 profile：`PATCH /api/profile` body `{ nickname?, avatar_name? }`
3. 获取所有 follows：`GET /api/follows` → `{ following_count, following: [{ list_ref, owner: { nickname, avatar_name } }] }`
4. Follow 一个 list：`POST /api/follows` body `{ share_id }` → `{ ok: true, list_ref, owner: { nickname, avatar_name } }`
5. Unfollow：`DELETE /api/follows` body `{ list_ref }` → `{ ok: true }`
6. 获取 followed list 的 items：`GET /api/items?scope=followed&list_ref=u:<owner_user_id>`

```bash
# Get profile
curl -X GET "<BASE_URL>/api/profile" \
  -H "Cookie: sb-<project-ref>-auth-token=<AUTH>; sb-<project-ref>-refresh-token=<REFRESH>"

# Update profile
curl -X PATCH "<BASE_URL>/api/profile" \
  -H "Cookie: sb-<project-ref>-auth-token=<AUTH>; sb-<project-ref>-refresh-token=<REFRESH>" \
  -H "Content-Type: application/json" \
  -d '{"nickname": "My Name", "avatar_name": "cat"}'

# Get follows
curl -X GET "<BASE_URL>/api/follows" \
  -H "Cookie: sb-<project-ref>-auth-token=<AUTH>; sb-<project-ref>-refresh-token=<REFRESH>"

# Follow a list (need share_id from /api/shares)
curl -X POST "<BASE_URL>/api/follows" \
  -H "Cookie: sb-<project-ref>-auth-token=<AUTH>; sb-<project-ref>-refresh-token=<REFRESH>" \
  -H "Content-Type: application/json" \
  -d '{"share_id": "<SHARE_ID>"}'

# Get followed list items
curl -X GET "<BASE_URL>/api/items?scope=followed&list_ref=u:<OWNER_USER_ID>" \
  -H "Cookie: sb-<project-ref>-auth-token=<AUTH>; sb-<project-ref>-refresh-token=<REFRESH>"
```

EN:

1. Get current user's profile: `GET /api/profile` → `{ nickname, avatar_name }`
2. Update profile: `PATCH /api/profile` body `{ nickname?, avatar_name? }`
3. Get all follows: `GET /api/follows` → `{ following_count, following: [...] }`
4. Follow a list: `POST /api/follows` body `{ share_id }` → `{ ok: true, list_ref, owner: {...} }`
5. Unfollow: `DELETE /api/follows` body `{ list_ref }` → `{ ok: true }`
6. Get followed list items: `GET /api/items?scope=followed&list_ref=u:<owner_user_id>`

### 1.5.2 Share page 手动验收 / Share page manual validation

CN：

1. 通过 `/api/shares` 拿到 `share_id`（见上节）。
2. 无痕窗口打开：`<BASE_URL>/s/<share_id>`，应看到只读列表（空列表也要有 empty state）。
3. 检查 PII：在终端执行：

```bash
curl -sL "<BASE_URL>/s/<share_id>" | grep -E "user_id|@" && echo "PII LEAK" && exit 1 || echo "OK"
```

4. 调用 revoke：`POST /api/shares/<share_id>/revoke`（见上节），再次无痕打开同链接必须 404。

EN:

1. Get a `share_id` from `/api/shares` (see above).
2. Open `<BASE_URL>/s/<share_id>` in an incognito window; you should see the read-only list (empty state is OK).
3. Check PII in the response:

```bash
curl -sL "<BASE_URL>/s/<share_id>" | grep -E "user_id|@" && echo "PII LEAK" && exit 1 || echo "OK"
```

4. Revoke via `POST /api/shares/<share_id>/revoke` (see above), then the same URL must return 404 in incognito.

### 1.5.2 Tracking validation / 埋点验证

CN：在浏览器访问 `/app` 与 `/s/<share_id>` 后，用 SQL 验证埋点是否写入：

```sql
select *
from events
where event_name = 'web.app.items_list_load'
  and user_id = '<me>'
order by occurred_at desc
limit 5;
```

```sql
select *
from events
where event_name = 'web.share.page_view'
  and share_id = '<share_id>'
order by occurred_at desc
limit 5;
```

HEAD 不应写入事件：

```bash
curl -I "<BASE_URL>/s/<share_id>"
```

说明：`meta.request_id` 由服务器生成；`meta.x_vercel_id` 仅在 Vercel 环境可用。

EN: After visiting `/app` and `/s/<share_id>`, validate the tracking writes with SQL:

```sql
select *
from events
where event_name = 'web.app.items_list_load'
  and user_id = '<me>'
order by occurred_at desc
limit 5;
```

```sql
select *
from events
where event_name = 'web.share.page_view'
  and share_id = '<share_id>'
order by occurred_at desc
limit 5;
```

HEAD should not write events:

```bash
curl -I "<BASE_URL>/s/<share_id>"
```

Note: `meta.request_id` is server-generated; `meta.x_vercel_id` appears only on Vercel.

### 1.6 Logout（for testing）

CN：

* 浏览器：访问 `/logout` 或在 `/app` 点击 **Sign out**（会 POST `/auth/signout`）
* 程序：`curl -X POST <BASE_URL>/api/logout`（返回 `{ ok: true }`）
* 说明：这是测试工具，不属于 Actions OpenAPI contract

EN:

* Browser: visit `/logout` or click **Sign out** on `/app` (POSTs to `/auth/signout`)
* Programmatic: `curl -X POST <BASE_URL>/api/logout` (returns `{ ok: true }`)
* Note: this is a testing utility, not part of the Actions OpenAPI contract

### 1.7 Logout & GPTs 使用注意事项（必读）/ Logout & GPTs runtime notes (important)

#### 1) `/logout` 只清理“网站浏览器登录态”，不会清理 GPTs 登录态

CN：

* `/logout`（GET）、`/auth/signout`（POST）与 `/api/logout`（POST）**仅用于测试**：清理当前网站（浏览器）里的 Supabase 登录态（cookies）。
* ⚠️ 它们**不会**清理 GPTs / Actions 的 OAuth Connect 登录态。
* 所以你在浏览器访问 `/logout` 后，GPTs 里仍显示“已登录 / 已 Connect”，是**预期行为**。

EN:

* `/logout` (GET), `/auth/signout` (POST), and `/api/logout` (POST) are **testing utilities**: they clear the website (browser) Supabase session (cookies).
* ⚠️ They **do not** revoke/clear the GPTs / Actions OAuth connection.
* It is expected that after visiting `/logout`, GPTs may still appear “connected”.

#### 2) 如果要在 GPTs 里“登出 / 断开连接”，只能通过 Privacy setting

CN：

* 要在 GPTs / Actions 层面真正 logout（断开 OAuth 连接），请在 **GPT Builder → Actions → Privacy / Authentication settings** 中执行 **Disconnect / Remove connection**。
* 这是目前 GPTs 唯一支持的 OAuth 登出方式。

EN:

* To truly log out at the GPTs / Actions layer, go to **GPT Builder → Actions → Privacy / Authentication settings** and **Disconnect / Remove connection**.
* This is currently the only supported way to revoke a GPTs OAuth session.

### 1.8 GPTs 当前不支持推理模型（thinking / reasoning mode）导致 Actions 异常（reminder）

CN：

* ⚠️ 当前 GPTs + Actions 在推理模型（thinking / reasoning mode）下可能会出错（例如工具调用失败、行为不一致）。
* 如果线上体验遇到 Actions 异常：优先检查是否启用了推理模型；必要时切换到非推理模型再重试。
* 这是平台侧限制/兼容性问题的常见来源之一。

EN:

* ⚠️ GPTs + Actions may fail or behave inconsistently under reasoning/thinking models.
* If you see Action errors in production: first check whether a reasoning model is enabled; switch to a non-reasoning model and retry.
* This is a common platform-level limitation / compatibility pitfall.

---

## 2) Actions 验收（从脚本到 GPT）/ Actions validation (from scripts to GPT)

### 2.1 导入 OpenAPI / Import OpenAPI

CN：

* 只导入生成后的 `public/openapi.yaml` 对外 URL（由你的部署域名提供）
* 如果你改了 `BASE_URL` 或部署域名，重新生成并重新导入

EN:

* Import only the generated OpenAPI served from `public/openapi.yaml` on your deployed domain
* If you change `BASE_URL` or deployment domain, regenerate and re-import

### 2.2 Connect & 调用顺序 / Connect & call order

CN：

1. 在 GPT Builder → Actions 点击 Connect 完成授权
2. 调 `getMe`
3. 调 `createItem`（提交一个 URL）
4. 调 `listItems`（确认包含刚提交的 item）

EN:

1. In GPT Builder → Actions, click Connect and finish authorization
2. Call `getMe`
3. Call `createItem` with a URL
4. Call `listItems` and confirm the new item is present

---

## 3) 环境差异（只写会踩坑的点）/ Environment notes (only what bites you)

### 3.1 Dev（本地）/ Dev (local)

CN：

* 需要完整的 `SUPABASE_*` 与 `OAUTH_*`
* `BASE_URL` 会影响 OpenAPI 的 base URL（以 `scripts/gen-openapi.mjs` 为准）
* `OAUTH_ALLOW_AUTH_HEADER_LOGIN` 未设置时：当前实现为 dev 默认允许 header bypass（见下文“坑位”与 `SECURITY`）

EN:

* Requires full `SUPABASE_*` and `OAUTH_*`
* `BASE_URL` affects OpenAPI base URL (authoritative: `scripts/gen-openapi.mjs`)
* When `OAUTH_ALLOW_AUTH_HEADER_LOGIN` is unset: current behavior is to allow header bypass in non-prod (see pitfalls and `SECURITY`)

### 3.2 Preview（Vercel）/ Preview (Vercel)

CN：

* OpenAPI base URL 推导顺序（以 `scripts/gen-openapi.mjs` 为准）：

  * `BASE_URL`
  * `VERCEL_BRANCH_URL`（当 `VERCEL_ENV=preview`）
  * `VERCEL_URL`
* Preview 默认视为 non-prod，因此 header bypass 默认允许（未设置时）

EN:

* OpenAPI base URL derivation order (authoritative: `scripts/gen-openapi.mjs`):

  * `BASE_URL`
  * `VERCEL_BRANCH_URL` (when `VERCEL_ENV=preview`)
  * `VERCEL_URL`
* Preview is treated as non-prod; header bypass is allowed by default when unset

### 3.3 Production（Vercel）/ Production (Vercel)

CN：

* OpenAPI base URL 推导顺序（以 `scripts/gen-openapi.mjs` 为准）：

  * `BASE_URL`
  * `VERCEL_PROJECT_PRODUCTION_URL`（当 `VERCEL_ENV=production`）
  * `VERCEL_URL`
* `OAUTH_ALLOW_AUTH_HEADER_LOGIN` 未设置时：生产默认禁用 header bypass

EN:

* OpenAPI base URL derivation order (authoritative: `scripts/gen-openapi.mjs`):

  * `BASE_URL`
  * `VERCEL_PROJECT_PRODUCTION_URL` (when `VERCEL_ENV=production`)
  * `VERCEL_URL`
* When `OAUTH_ALLOW_AUTH_HEADER_LOGIN` is unset: production disables header bypass by default

---

## 4) 常见坑位（症状 → 原因 → 处理）/ Common pitfalls (symptom → cause → fix)

| 问题 / Issue                                        | 现象 / Symptom                      | 处理 / Fix                                          |
| ------------------------------------------------- | --------------------------------- | ------------------------------------------------- |
| 代理/网络 / Proxy                                     | `preflight` 网络检查失败                | 配置 `HTTPS_PROXY/ALL_PROXY` 或切换网络                  |
| 迁移未运行 / Missing migrations                        | `/items` 500 或返回异常                | 确认 Supabase 已执行 `supabase/migrations/*`           |
| 环境变量错配 / Env mismatch                             | 本地 OK，preview/prod 401 或 OAuth 失败 | 对齐 `SUPABASE_*` 与 `OAUTH_*`；检查 allowlist          |
| 本地服务残留 / Stale dev process                        | smoke 命中旧服务、行为不随改动变化              | 关旧进程/旧终端，重启 `npm run dev`                         |
| OpenAPI 不一致 / OpenAPI mismatch                    | Actions 404 或打错路径                 | 重新 `npm run gen:openapi` 并重新导入                    |
| redirect allowlist / 重定向白名单                       | `/api/oauth/authorize` 400        | 更新 `OAUTH_ALLOWED_CLIENTS_JSON` 包含 `redirect_uri` |
| 生产 header-login 默认关闭 / Prod bypass off by default | header bypass 失败                  | 生产要显式设置 `OAUTH_ALLOW_AUTH_HEADER_LOGIN=true`（慎用）  |

---

## 5) 去哪里找实现（定位入口）/ Where to look (entrypoints)

CN：

* OAuth：`src/app/api/oauth/authorize/route.ts`, `src/app/api/oauth/token/route.ts`（别名：`src/app/oauth/*`）
* 认证：`src/server/auth/bearer.ts`, `src/server/auth/supabase.ts`
* OpenAPI：`actions/openapi.template.yaml`, `scripts/gen-openapi.mjs`, `public/openapi.yaml`
* Smoke：`scripts/preflight.sh`, `scripts/smoke_openapi.sh`, `scripts/smoke_oauth.sh`, `scripts/smoke_items.sh`
  * 本地可能会跳过：`BASE_URL=http://localhost:3000 npm run smoke:openapi` 在未生成 `public/openapi.yaml` 时会提示跳过
  * 远端验证：`BASE_URL=https://<preview-or-prod-domain> npm run smoke:openapi`
* 日常指标推送：`src/app/api/metrics/daily/route.ts`, `src/app/api/cron/daily/route.ts`, `vercel.json`（Vercel Cron Jobs 配置）
* Enrichment 定时重试：`src/app/api/cron/enrich/route.ts`（通过 `/api/cron/daily` 调用）
* 系统健康度报告：`src/app/api/cron/system-health/route.ts`（通过 `/api/cron/daily` 调用）
* Ops Queue：`src/app/api/ops/queue/route.ts`, `src/app/ops/page.tsx`（条件：`enrich_attempts >= 0` 且缺失 title/image）

---

## 6) Email OTP 登录（无密码）/ Email OTP Login (Passwordless)

CN：`/login` 支持 Email OTP（6 位码）登录，无需密码。  
EN: `/login` supports Email OTP (6-digit code) login, no password required.

### 6.1 Supabase Custom SMTP（SMTP2GO 示例）/ Supabase Custom SMTP (SMTP2GO Example)

CN：Supabase 使用 SMTP 凭证发送邮件，不使用 SMTP2GO API key。  
EN: Supabase uses SMTP credentials to send emails, not SMTP2GO API key.

**SMTP2GO 配置 / SMTP2GO Configuration：**
- SMTP server: `mail.smtp2go.com`
- Port: `2525`（推荐，多数网络更通 / recommended, works on most networks）或 `587`（STARTTLS 常用 / common for STARTTLS）
- Username/Password：在 SMTP2GO Dashboard → Sending → SMTP Users 里创建/查看
- TLS：启用 / Enabled

**Supabase Dashboard 路径 / Supabase Dashboard Path：**
- Authentication → Emails → SMTP Settings → Enable Custom SMTP
- 填写 Host/Port/User/Pass + 设置默认 From（如 `no-reply@yourdomain.com`）
- Fill in Host/Port/User/Pass + set default From (e.g., `no-reply@yourdomain.com`)

### 6.2 Supabase 需要打开的开关 / Required Supabase Toggles

CN：在 Supabase Dashboard 中确保以下开关已启用：  
EN: Ensure the following toggles are enabled in Supabase Dashboard:

- ✅ Authentication → Providers：Email enabled
- ✅ Authentication → General：Allow new users to sign up（允许注册）
- ✅ Authentication → Emails：Enable Custom SMTP（生产建议必开 / recommended for production）

### 6.3 Email 模板需要怎么改（OTP）/ Email Template Changes (OTP)

CN：Supabase Email 模板需要改为显示 6 位 OTP 码，而不是 magic link。  
EN: Supabase Email templates need to display 6-digit OTP code instead of magic link.

**重要 / Important：** 新用户第一次可能走 "Confirm sign up" 模板，不一定只走 "Magic link" 模板，所以建议两个模板都改成 OTP 风格。  
**Important:** New users may use the "Confirm sign up" template on first signup, not just "Magic link", so update both templates to OTP style.

**需要修改的模板 / Templates to Update：**
- Authentication → Emails → Templates → **Confirm sign up**
- Authentication → Emails → Templates → **Magic link**

**模板变量更改 / Template Variable Change：**
- 将 `{{ .ConfirmationURL }}` 替换为 `{{ .Token }}`
- Replace `{{ .ConfirmationURL }}` with `{{ .Token }}`
- `{{ .Token }}` 是 6 位 OTP 码
- `{{ .Token }}` is the 6-digit OTP code

**建议模板片段 / Suggested Template Snippet：**
```html
<p>Your sign-in code:</p>
<p style="font-size:24px;letter-spacing:4px;"><strong>{{ .Token }}</strong></p>
<p>This code expires soon.</p>
```

---

## 7) Vercel Cron Jobs 配置 / Vercel Cron Jobs configuration

### 7.1 配置 vercel.json

CN：在项目根目录创建或更新 `vercel.json`，配置定时任务：

EN: Create or update `vercel.json` in project root to configure scheduled tasks:

```json
{
  "crons": [
    {
      "path": "/api/cron/daily",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/metrics/daily",
      "schedule": "0 9 * * *"
    }
  ]
}
```

CN：
- `/api/cron/daily`：统一入口，依次执行 metrics/daily、enrich、system-health 三个任务
- `/api/metrics/daily`：保留作为可单独调用的选项
- **注意**：Vercel Hobby Plan 限制整个账号只能设置 2 个 Cron，每天只能触发一次

EN:
- `/api/cron/daily`: Unified entry point that executes metrics/daily, enrich, and system-health sequentially
- `/api/metrics/daily`: Kept as an option for standalone calls
- **Note**: Vercel Hobby Plan limits the entire account to 2 Cron jobs, and each can only trigger once per day

CN：
- `path`: API route 路径（相对于项目根目录）
- `schedule`: Cron 表达式（UTC 时间）
  - `0 9 * * *` = 每天 09:00 UTC
  - 格式：`分钟 小时 日 月 星期`
  - 示例：`0 0 * * *`（每天 00:00 UTC）、`0 */6 * * *`（每 6 小时）

EN:
- `path`: API route path (relative to project root)
- `schedule`: Cron expression (UTC time)
  - `0 9 * * *` = daily at 09:00 UTC
  - Format: `minute hour day month weekday`
  - Examples: `0 0 * * *` (daily at 00:00 UTC), `0 */6 * * *` (every 6 hours)

### 6.2 环境变量配置

CN：在 Vercel 项目设置中添加以下环境变量：

EN: Add the following environment variables in Vercel project settings:

- `TELEGRAM_BOT_TOKEN` - Bot token（从 @BotFather 获取 / Get from @BotFather）
- `TELEGRAM_CHAT_ID` - 接收消息的 chat_id（个人或群组 / Personal or group chat）
- `CRON_SECRET`（可选 / Optional）- 如果设置，API route 会验证 Authorization header

### 7.3 Cron Jobs 说明

CN：
- **统一入口**：`/api/cron/daily` 每天执行一次（UTC 9:00），依次调用：
  1. `/api/metrics/daily` - 用户行为日报
  2. `/api/cron/enrich` - Enrichment 重试（移除 4 小时限制，每天处理一次直到 attempts >= 3）
  3. `/api/cron/system-health` - 系统健康度报告
- **独立调用**：三个 API 端点仍然可以单独调用进行测试
- **错误隔离**：每个任务失败不影响其他任务

EN:
- **Unified entry**: `/api/cron/daily` runs once daily (UTC 9:00), sequentially calling:
  1. `/api/metrics/daily` - User behavior daily report
  2. `/api/cron/enrich` - Enrichment retries (4-hour cooldown removed, processes once daily until attempts >= 3)
  3. `/api/cron/system-health` - System health report
- **Standalone calls**: All three API endpoints can still be called individually for testing
- **Error isolation**: Failures in one task don't block others

### 7.4 验证 Cron Job

CN：
1. 部署到 Vercel 后，在 Vercel Dashboard → Settings → Cron Jobs 查看配置
2. 手动触发：在 Vercel Dashboard 点击 "Run Now" 测试
3. 查看日志：Vercel Dashboard → Functions → `/api/cron/daily` → Logs

EN:
1. After deploying to Vercel, check configuration in Vercel Dashboard → Settings → Cron Jobs
2. Manual trigger: Click "Run Now" in Vercel Dashboard to test
3. View logs: Vercel Dashboard → Functions → `/api/cron/daily` → Logs

### 7.5 本地测试

CN：本地开发时，可以手动调用 API endpoint 测试：

EN: For local development, manually call the API endpoint to test:

```bash
# 需要设置环境变量
export TELEGRAM_BOT_TOKEN="your_bot_token"
export TELEGRAM_CHAT_ID="your_chat_id"
export CRON_SECRET="optional_secret"

# 调用统一入口（需要 Authorization header）
curl -X GET http://localhost:3000/api/cron/daily \
  -H "Authorization: Bearer ${CRON_SECRET}"

# 或单独调用某个任务
curl -X GET http://localhost:3000/api/metrics/daily \
  -H "Authorization: Bearer ${CRON_SECRET}"
curl -X GET http://localhost:3000/api/cron/enrich \
  -H "Authorization: Bearer ${CRON_SECRET}"
curl -X GET http://localhost:3000/api/cron/system-health \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

EN:

* OAuth: `src/app/api/oauth/authorize/route.ts`, `src/app/api/oauth/token/route.ts` (aliases: `src/app/oauth/*`)
* Auth: `src/server/auth/bearer.ts`, `src/server/auth/supabase.ts`
* OpenAPI: `actions/openapi.template.yaml`, `scripts/gen-openapi.mjs`, `public/openapi.yaml`
* Smoke: `scripts/preflight.sh`, `scripts/smoke_openapi.sh`, `scripts/smoke_oauth.sh`, `scripts/smoke_items.sh`
  * Local may skip: `BASE_URL=http://localhost:3000 npm run smoke:openapi` can skip if `public/openapi.yaml` isn't generated
  * Remote gate: `BASE_URL=https://<preview-or-prod-domain> npm run smoke:openapi`
