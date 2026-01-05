# PROJECT_MAP

## 0. 单一导航入口 / Single navigation entry
CN：本项目的规范性文档只保留：`README.md`、`MVP_SPEC`、`PROJECT_MAP`、`CHEATSHEET`、`SECURITY`。其他任何文档都不再是规范来源。  
EN: Normative docs are limited to: `README.md`, `MVP_SPEC`, `PROJECT_MAP`, `CHEATSHEET`, `SECURITY`. No other doc is normative.

---

## 1. “我该去哪找？”索引 / “Where do I find…?” index
- OAuth authorize 路由 / route: `src/app/api/oauth/authorize/route.ts`（别名 / alias: `src/app/oauth/authorize/route.ts`）
- OAuth token 路由 / route: `src/app/api/oauth/token/route.ts`（别名 / alias: `src/app/oauth/token/route.ts`）
- /app 路由 / route: `src/app/app/page.tsx`
- Logout 路由 / routes: `src/app/logout/route.ts`, `src/app/api/logout/route.ts`
- Bearer 认证 / auth: `src/server/auth/bearer.ts`
- Supabase session + header bypass / gating: `src/server/auth/supabase.ts`
- Items 存储 / storage: `src/server/items/`
- OpenAPI 模板与生成 / template & generator:
  - `actions/openapi.template.yaml`
  - `scripts/gen-openapi.mjs`
  - `public/openapi.yaml`
- Smoke / preflight:
  - `scripts/preflight.sh`
  - `scripts/smoke_oauth.sh`
  - `scripts/smoke_items.sh`

---

## 2. 当前项目地图 / Current project map

> 说明 / Note: 这里只表达“代码组织与入口”。API 的对外 contract 以 `MVP_SPEC` 为准。  
> This section describes structure/entrypoints; the external contract is defined in `MVP_SPEC`.

```text
.
├─ actions/
│  └─ openapi.template.yaml          # OpenAPI 模板（占位符 __BASE_URL__）/ OpenAPI template (__BASE_URL__)
├─ docs/
│  ├─ MVP_SPEC.md                    # MVP 范围与验收 / MVP scope & acceptance
│  ├─ PROJECT_MAP.md                 # 本文件 / this file
│  ├─ CHEATSHEET.md                  # 速查与排障 / cheats & troubleshooting
│  └─ SECURITY.md                    # 安全与生产默认 / security & prod defaults
├─ public/
│  └─ openapi.yaml                   # 由模板生成（npm run gen:openapi）/ generated artifact
├─ scripts/
│  ├─ gen-openapi.mjs                # 渲染模板 -> public/openapi.yaml / render template -> artifact
│  ├─ smoke_oauth.sh                 # OAuth flow smoke / OAuth flow smoke
│  ├─ smoke_items.sh                 # Items API smoke / Items API smoke
│  └─ preflight.sh                   # 预检查 / preflight checks
├─ src/
│  ├─ app/
│  │  ├─ app/page.tsx                # /app minimal UI (auth-gated list)
│  │  ├─ api/oauth/authorize/route.ts  # OAuth authorize / 授权码
│  │  ├─ api/oauth/token/route.ts      # OAuth token exchange / 换 token
│  │  ├─ oauth/authorize/route.ts      # Alias / 别名
│  │  ├─ oauth/token/route.ts          # Alias / 别名
│  │  ├─ api/logout/route.ts           # POST /api/logout (clear Supabase cookies)
│  │  ├─ api/me/route.ts               # /me handler (see MVP_SPEC) / /me 处理（以 MVP_SPEC 为准）
│  │  ├─ api/items/route.ts            # /items handler (see MVP_SPEC) / /items 处理（以 MVP_SPEC 为准）
│  │  ├─ logout/route.ts               # GET /logout (clear cookies + redirect)
│  │  └─ login/                        # /login (Supabase password grant) / 登录页
│  ├─ server/
│  │  ├─ auth/                         # bearer + supabase session / 认证层
│  │  ├─ oauth/                        # OAuth helpers / OAuth 辅助逻辑
│  │  └─ items/                        # Items storage / items 存储
│  └─ supabase/                        # Admin fetch helper / 管理端请求封装
└─ supabase/migrations/
   ├─ 001_init.sql                     # oauth_codes/oauth_tokens
   └─ 002_items.sql                    # items
````

---

## 3. OpenAPI 生成方式 / OpenAPI generation

CN：

* 来源：`actions/openapi.template.yaml`（包含 `__BASE_URL__`）
* 输出：`public/openapi.yaml`
* 生成命令：`npm run gen:openapi`（`npm run build` 会通过 `prebuild` 自动执行）
* Base URL 解析：`scripts/gen-openapi.mjs` 使用 `BASE_URL` 或 Vercel 环境变量

EN:

* Source: `actions/openapi.template.yaml` (contains `__BASE_URL__`)
* Output: `public/openapi.yaml`
* Command: `npm run gen:openapi` (also runs via `prebuild` during `npm run build`)
* Base URL resolution: `scripts/gen-openapi.mjs` uses `BASE_URL` or Vercel env vars

---

## 4. 维护规则（防止漂移）/ Maintenance rule (prevent drift)

CN：如果你改动了 routes / scripts / OpenAPI 产物路径，必须同步更新：

* `docs/MVP_SPEC.md`（contract 与验收）
* `docs/CHEATSHEET.md`（如何跑通与排障）
* `docs/PROJECT_MAP.md`（入口与文件位置）

EN: If you change routes/scripts/OpenAPI artifact paths, update:

* `docs/MVP_SPEC.md` (contract & acceptance)
* `docs/CHEATSHEET.md` (how-to-run & troubleshooting)
* `docs/PROJECT_MAP.md` (entrypoints & file locations)
