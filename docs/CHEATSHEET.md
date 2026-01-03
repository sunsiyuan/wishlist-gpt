# CHEATSHEET

## 一页 Happy Path 清单 / One-Page Happy Path Checklist

1. 设置必要环境变量：`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OAUTH_ALLOWED_CLIENTS_JSON`, `OAUTH_SIGNING_SECRET`。
2. 安装依赖并启动：`npm install` → `npm run dev`。
3. 生成 OpenAPI（如需）：`npm run gen:openapi`（输出 `public/openapi.yaml`）。
4. 跑 OAuth smoke：`npm run smoke:oauth`。
5. 跑 Items smoke：`npm run smoke:items`。

1. Set required env vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OAUTH_ALLOWED_CLIENTS_JSON`, `OAUTH_SIGNING_SECRET`.
2. Install and start: `npm install` → `npm run dev`.
3. Generate OpenAPI (if needed): `npm run gen:openapi` (writes `public/openapi.yaml`).
4. Run OAuth smoke: `npm run smoke:oauth`.
5. Run Items smoke: `npm run smoke:items`.

## 环境变量设置（dev/preview/prod） / Env Setup (dev/preview/prod)

### 开发 / Dev

- 必需：`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OAUTH_ALLOWED_CLIENTS_JSON`, `OAUTH_SIGNING_SECRET`。
- 本地生成 OpenAPI：设置 `BASE_URL`（必须是 `https://`）或使用 Vercel env（见下）。
- 可选：`OAUTH_ALLOW_AUTH_HEADER_LOGIN`（未设置时 dev 默认允许 header bypass）。

- Required: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OAUTH_ALLOWED_CLIENTS_JSON`, `OAUTH_SIGNING_SECRET`.
- OpenAPI generation locally: set `BASE_URL` (must be `https://`) or use Vercel env vars (below).
- Optional: `OAUTH_ALLOW_AUTH_HEADER_LOGIN` (when unset, dev defaults to allow header bypass).

### 预览 / Preview (Vercel)

- `scripts/gen-openapi.mjs` 会使用以下顺序推导 base URL：
  - `BASE_URL`
  - `VERCEL_BRANCH_URL`（当 `VERCEL_ENV=preview`）
  - `VERCEL_URL`
- `OAUTH_ALLOW_AUTH_HEADER_LOGIN` 若未设置，preview 环境默认允许 header bypass（因为非 production）。

- `scripts/gen-openapi.mjs` derives base URL in this order:
  - `BASE_URL`
  - `VERCEL_BRANCH_URL` (when `VERCEL_ENV=preview`)
  - `VERCEL_URL`
- If `OAUTH_ALLOW_AUTH_HEADER_LOGIN` is unset, preview defaults to allow header bypass (non-production).

### 生产 / Production (Vercel)

- `scripts/gen-openapi.mjs` 会使用以下顺序推导 base URL：
  - `BASE_URL`
  - `VERCEL_PROJECT_PRODUCTION_URL`（当 `VERCEL_ENV=production`）
  - `VERCEL_URL`
- `OAUTH_ALLOW_AUTH_HEADER_LOGIN` 若未设置，生产环境默认禁用 header bypass。

- `scripts/gen-openapi.mjs` derives base URL in this order:
  - `BASE_URL`
  - `VERCEL_PROJECT_PRODUCTION_URL` (when `VERCEL_ENV=production`)
  - `VERCEL_URL`
- If `OAUTH_ALLOW_AUTH_HEADER_LOGIN` is unset, production defaults to disallow header bypass.

## 常见坑位表 / Common Pitfalls Table

| 问题 / Issue | 现象 / Symptom | 处理 / Fix |
| --- | --- | --- |
| 代理/网络 / Proxy | `preflight` 网络检查失败 | 设置 `HTTPS_PROXY/ALL_PROXY` 或修正网络环境 |
| 迁移未运行 / Missing migrations | `/items` 500 或列表异常 | 确认 Supabase 已执行 `supabase/migrations/*` |
| 环境变量错配 / Env mismatch | 登录或 OAuth 失败 | 检查 `SUPABASE_*` 与 `OAUTH_*` 是否与环境一致 |
| 本地服务残留 / Stale dev process | smoke 命令命中旧服务 | 关闭旧进程并重启 `npm run dev` |
| OpenAPI 路径不一致 / OpenAPI path mismatch | Actions 指向错误 URL | 确认 `public/openapi.yaml` 已用正确 `BASE_URL` 生成 |
| redirect allowlist / 重定向白名单 | `/api/oauth/authorize` 返回 400 | 检查 `OAUTH_ALLOWED_CLIENTS_JSON` 包含 `redirect_uri` |
| 生产环境 header-login 默认关闭 / Prod header-login default off | header bypass 失败 | 生产环境需显式 `OAUTH_ALLOW_AUTH_HEADER_LOGIN=true`（慎用） |

| Issue | Symptom | Fix |
| --- | --- | --- |
| Proxy | Preflight network check fails | Set `HTTPS_PROXY/ALL_PROXY` or fix network |
| Missing migrations | `/items` 500 or list errors | Ensure Supabase ran `supabase/migrations/*` |
| Env mismatch | Login or OAuth fails | Verify `SUPABASE_*` and `OAUTH_*` match the environment |
| Stale dev process | Smoke hits old server | Stop stale process and restart `npm run dev` |
| OpenAPI path mismatch | Actions hits wrong URL | Regenerate `public/openapi.yaml` with correct `BASE_URL` |
| Redirect allowlist | `/api/oauth/authorize` returns 400 | Ensure `OAUTH_ALLOWED_CLIENTS_JSON` allows `redirect_uri` |
| Prod header-login default off | Header bypass fails | In prod, set `OAUTH_ALLOW_AUTH_HEADER_LOGIN=true` explicitly (use cautiously) |

## 在哪里找实现 / Where to Look

- OAuth 路由：`src/app/api/oauth/authorize/route.ts`, `src/app/api/oauth/token/route.ts`（别名在 `src/app/oauth/*`）。
- 认证逻辑：`src/server/auth/bearer.ts`（OAuth bearer）, `src/server/auth/supabase.ts`（Supabase session + header bypass）。
- OpenAPI 生成：`actions/openapi.template.yaml`, `scripts/gen-openapi.mjs`, `public/openapi.yaml`。
- Smoke 脚本：`scripts/smoke_oauth.sh`, `scripts/smoke_items.sh`, `scripts/preflight.sh`。

- OAuth routes: `src/app/api/oauth/authorize/route.ts`, `src/app/api/oauth/token/route.ts` (aliases in `src/app/oauth/*`).
- Auth logic: `src/server/auth/bearer.ts` (OAuth bearer), `src/server/auth/supabase.ts` (Supabase session + header bypass).
- OpenAPI generation: `actions/openapi.template.yaml`, `scripts/gen-openapi.mjs`, `public/openapi.yaml`.
- Smoke scripts: `scripts/smoke_oauth.sh`, `scripts/smoke_items.sh`, `scripts/preflight.sh`.
