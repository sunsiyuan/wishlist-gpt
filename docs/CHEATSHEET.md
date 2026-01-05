# CHEATSHEET

## 0) 目标：最小闭环 / Goal: the minimal closed loop
CN：你要跑通的闭环只有一条：**Actions Connect → getMe → createItem → listItems**。  
EN: There is only one loop you must get working: **Actions Connect → getMe → createItem → listItems**.

---

## 1) 一页 Happy Path（照着做）/ One-page happy path (do this in order)

### 1.1 设置环境变量 / Set env vars
必需 / Required:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OAUTH_ALLOWED_CLIENTS_JSON`
- `OAUTH_SIGNING_SECRET`

可选但常用 / Optional but common:
- `OAUTH_ALLOW_AUTH_HEADER_LOGIN`
- `BASE_URL`

> CN：改 `.env*` 后，务必重启终端并重启 `npm run dev`（旧进程最容易误导你）。  
> EN: After changing `.env*`, restart your terminal and `npm run dev` (stale processes are the #1 confusion source).

### 1.2 启动 / Start
```bash
npm install
npm run dev
````

CN：Login → visit `/app` to see a raw list of URLs (minimal UI)。  
CN：Unauthed `/app` redirects to `/login` (expected)。  
EN: Login → visit `/app` to see a raw list of URLs (minimal UI).  
EN: Unauthed `/app` redirects to `/login` (expected).

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
```

### 1.5 Shares（cookie session）/ Shares (cookie session)

CN：

1. 浏览器登录后，复制 `sb-access-token`/`sb-refresh-token` cookies（DevTools → Application → Cookies）。
2. 连续调用两次 `/api/shares`，第二次应复用同一个 `share_id`。
3. 调用 `/api/shares/rotate` 应返回新的 `share_id`。
4. 调用 `/api/shares/<id>/revoke` 后，再访问 `/s/<id>` 必须 404。

```bash
curl -X POST "<BASE_URL>/api/shares" \
  -H "Cookie: sb-access-token=<ACCESS>; sb-refresh-token=<REFRESH>"
curl -X POST "<BASE_URL>/api/shares/rotate" \
  -H "Cookie: sb-access-token=<ACCESS>; sb-refresh-token=<REFRESH>"
curl -X POST "<BASE_URL>/api/shares/<SHARE_ID>/revoke" \
  -H "Cookie: sb-access-token=<ACCESS>; sb-refresh-token=<REFRESH>"
curl -X POST "<BASE_URL>/api/shares" \
  -H "Cookie: sb-access-token=<ACCESS>; sb-refresh-token=<REFRESH>"
```

EN:

1. After logging in via browser, copy the `sb-access-token`/`sb-refresh-token` cookies (DevTools → Application → Cookies).
2. Call `/api/shares` twice; the second response should reuse the same `share_id`.
3. Call `/api/shares/rotate` and expect a new `share_id`.
4. Call `/api/shares/<id>/revoke`, then `/s/<id>` must 404.

```bash
curl -X POST "<BASE_URL>/api/shares" \
  -H "Cookie: sb-access-token=<ACCESS>; sb-refresh-token=<REFRESH>"
curl -X POST "<BASE_URL>/api/shares/rotate" \
  -H "Cookie: sb-access-token=<ACCESS>; sb-refresh-token=<REFRESH>"
curl -X POST "<BASE_URL>/api/shares/<SHARE_ID>/revoke" \
  -H "Cookie: sb-access-token=<ACCESS>; sb-refresh-token=<REFRESH>"
curl -X POST "<BASE_URL>/api/shares" \
  -H "Cookie: sb-access-token=<ACCESS>; sb-refresh-token=<REFRESH>"
```

### 1.5.1 Share page 手动验收 / Share page manual validation

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

### 1.6 Logout（for testing）

CN：

* 浏览器：访问 `/logout`（清理 Supabase auth cookies 后 redirect 回 `/login`）
* 程序：`curl -X POST <BASE_URL>/api/logout`（返回 `{ ok: true }`）
* 说明：这是测试工具，不属于 Actions OpenAPI contract

EN:

* Browser: visit `/logout` (clears Supabase auth cookies and redirects to `/login`)
* Programmatic: `curl -X POST <BASE_URL>/api/logout` (returns `{ ok: true }`)
* Note: this is a testing utility, not part of the Actions OpenAPI contract

### 1.7 Logout & GPTs 使用注意事项（必读）/ Logout & GPTs runtime notes (important)

#### 1) `/logout` 只清理“网站浏览器登录态”，不会清理 GPTs 登录态

CN：

* `/logout`（GET）与 `/api/logout`（POST）**仅用于测试**：清理当前网站（浏览器）里的 Supabase 登录态（cookies）。
* ⚠️ 它们**不会**清理 GPTs / Actions 的 OAuth Connect 登录态。
* 所以你在浏览器访问 `/logout` 后，GPTs 里仍显示“已登录 / 已 Connect”，是**预期行为**。

EN:

* `/logout` (GET) and `/api/logout` (POST) are **testing utilities**: they clear the website (browser) Supabase session (cookies).
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

EN:

* OAuth: `src/app/api/oauth/authorize/route.ts`, `src/app/api/oauth/token/route.ts` (aliases: `src/app/oauth/*`)
* Auth: `src/server/auth/bearer.ts`, `src/server/auth/supabase.ts`
* OpenAPI: `actions/openapi.template.yaml`, `scripts/gen-openapi.mjs`, `public/openapi.yaml`
* Smoke: `scripts/preflight.sh`, `scripts/smoke_openapi.sh`, `scripts/smoke_oauth.sh`, `scripts/smoke_items.sh`
  * Local may skip: `BASE_URL=http://localhost:3000 npm run smoke:openapi` can skip if `public/openapi.yaml` isn't generated
  * Remote gate: `BASE_URL=https://<preview-or-prod-domain> npm run smoke:openapi`
