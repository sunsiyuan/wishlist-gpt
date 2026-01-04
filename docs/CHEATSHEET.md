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

### 1.3 生成 OpenAPI（需要时）/ Generate OpenAPI (when needed)

```bash
npm run gen:openapi
```

产物 / artifact: `public/openapi.yaml`

### 1.4 跑 smoke / Run smoke

```bash
npm run smoke:oauth
npm run smoke:items
```

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
