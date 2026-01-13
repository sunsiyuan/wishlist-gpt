# PROJECT_MAP

## 0. 单一导航入口 / Single navigation entry
CN：本项目的规范性文档只保留：`README.md`、`MVP_SPEC`、`PROJECT_MAP`、`CHEATSHEET`、`SECURITY`。其他任何文档都不再是规范来源。  
EN: Normative docs are limited to: `README.md`, `MVP_SPEC`, `PROJECT_MAP`, `CHEATSHEET`, `SECURITY`. No other doc is normative.

---

## 1. “我该去哪找？”索引 / “Where do I find…?” index
- OAuth authorize 路由 / route: `src/app/api/oauth/authorize/route.ts`（别名 / alias: `src/app/oauth/authorize/route.ts`）
- OAuth token 路由 / route: `src/app/api/oauth/token/route.ts`（别名 / alias: `src/app/oauth/token/route.ts`）
- /app 路由 / route: `src/app/app/page.tsx`
- /login 路由 / route: `src/app/login/page.tsx`, `src/app/login/LoginClient.tsx`
- /auth/callback 路由 / route: `src/app/auth/callback/route.ts`
- /auth/signout 路由 / route: `src/app/auth/signout/route.ts`
- Logout 路由 / routes: `src/app/logout/route.ts`, `src/app/api/logout/route.ts`
- Bearer 认证 / auth: `src/server/auth/bearer.ts`
- Supabase session + header bypass / gating: `src/server/auth/supabase.ts`
- Supabase SSR clients / SSR: `src/lib/supabase/{client,server,config}.ts`
- Middleware session refresh / 中间件刷新: `middleware.ts`
- Items 存储 / storage: `src/server/items/`
- Items display hint validation / enrichment: `src/server/items/displayFields.ts`, `src/server/items/enrich.ts`
- Shares 存储 / storage: `src/server/shares/`
- Public share helper / 分享页查询: `src/server/shares/public.ts`
- Profiles 存储 / storage: `src/server/profiles/store.ts`
- Follows 存储 / storage: `src/server/follows/store.ts`, `src/server/follows/items.ts`
- Feedback 存储 / storage: `src/server/feedback/`
- Items note/delete/restore routes: `src/app/api/items/[id]/note/route.ts`, `src/app/api/items/[id]/delete/route.ts`, `src/app/api/items/[id]/restore/route.ts`
- Feedback routes: `src/app/api/feedback/route.ts`, `src/app/feedback/route.ts`
- Shares API 路由 / routes: `src/app/api/shares/route.ts`, `src/app/api/shares/rotate/route.ts`, `src/app/api/shares/[id]/revoke/route.ts`
- Profile API 路由 / route: `src/app/api/profile/route.ts`
- Follows API 路由 / route: `src/app/api/follows/route.ts`
- Public share page / 分享页: `src/app/s/[share_id]/page.tsx`
- Share view tracking route / 分享页埋点路由: `src/app/api/track/share-view/route.ts`
- Onboarding profile page / 个人资料设置页: `src/app/onboarding/profile/page.tsx`
- Shares migration: `supabase/migrations/004_shares.sql`
- Events migration: `supabase/migrations/005_events.sql`
- Items v0.3 migration: `supabase/migrations/006_items_v03.sql`
- Item enrich runs migration: `supabase/migrations/007_item_enrich_runs.sql`
- Feedback migration: `supabase/migrations/008_feedback.sql`
- Profiles social migration: `supabase/migrations/011_profiles_social.sql` (v0.9)
- Follows migration: `supabase/migrations/012_follows.sql` (v0.9)
- Tracking helpers / 埋点 helpers: `src/server/tracking/`
- OpenAPI 模板与生成 / template & generator:
  - `actions/openapi.template.yaml`
  - `scripts/gen-openapi.mjs`
  - `public/openapi.yaml`
- Smoke / preflight:
  - `scripts/preflight.sh`
  - `scripts/smoke_oauth.sh`
  - `scripts/smoke_items.sh`
  - `scripts/smoke_shares.sh`
  - `scripts/smoke_feedback.sh`

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
│  ├─ AUTH_WEB.md                    # Web auth flow / Web 登录流
│  └─ SECURITY.md                    # 安全与生产默认 / security & prod defaults
├─ public/
│  └─ openapi.yaml                   # 由模板生成（npm run gen:openapi）/ generated artifact
├─ scripts/
│  ├─ gen-openapi.mjs                # 渲染模板 -> public/openapi.yaml / render template -> artifact
│  ├─ smoke_oauth.sh                 # OAuth flow smoke / OAuth flow smoke
│  ├─ smoke_items.sh                 # Items API smoke / Items API smoke
│  ├─ smoke_feedback.sh              # Feedback API smoke / Feedback API smoke
│  └─ preflight.sh                   # 预检查 / preflight checks
├─ src/
│  ├─ app/
│  │  ├─ app/page.tsx                # /app consumer UI (auth-gated list)
│  │  ├─ app/AppClient.tsx           # /app client UI + sheets + toast
│  │  ├─ app/ShareControls.tsx       # legacy share/revoke controls (client)
│  │  ├─ auth/callback/route.ts       # /auth/callback OAuth exchange
│  │  ├─ auth/signout/route.ts        # /auth/signout POST
│  │  ├─ api/oauth/authorize/route.ts  # OAuth authorize / 授权码
│  │  ├─ api/oauth/token/route.ts      # OAuth token exchange / 换 token
│  │  ├─ oauth/authorize/route.ts      # Alias / 别名
│  │  ├─ oauth/token/route.ts          # Alias / 别名
│  │  ├─ api/logout/route.ts           # POST /api/logout (clear Supabase cookies)
│  │  ├─ api/me/route.ts               # /me handler (see MVP_SPEC) / /me 处理（以 MVP_SPEC 为准）
│  │  ├─ api/items/route.ts            # /items handler (see MVP_SPEC) / /items 处理（以 MVP_SPEC 为准）
│  │  ├─ api/items/[id]/note/route.ts  # /api/items/:id/note (see MVP_SPEC)
│  │  ├─ api/items/[id]/delete/route.ts # /api/items/:id/delete (see MVP_SPEC)
│  │  ├─ api/items/[id]/restore/route.ts # /api/items/:id/restore (see MVP_SPEC)
│  │  ├─ api/feedback/route.ts         # /api/feedback (cookie session)
│  │  ├─ api/shares/route.ts           # /shares handler (see MVP_SPEC) / /shares 处理（以 MVP_SPEC 为准）
│  │  ├─ api/shares/rotate/route.ts    # /shares/rotate handler (see MVP_SPEC)
│  │  ├─ api/shares/[id]/revoke/route.ts # /shares/:id/revoke handler (see MVP_SPEC)
│  │  ├─ api/track/share-view/route.ts # share view tracking (public)
│  │  ├─ feedback/route.ts             # /feedback (OAuth bearer Actions)
│  │  ├─ logout/route.ts               # GET /logout (clear cookies + redirect)
│  │  ├─ login/                        # /login (Supabase auth UI) / 登录页
│  │  └─ s/[share_id]/page.tsx         # /s/:share_id public share page
│  ├─ lib/
│  │  └─ supabase/                     # Supabase SSR client setup
│  ├─ server/
│  │  ├─ auth/                         # bearer + supabase session / 认证层
│  │  ├─ feedback/                     # Feedback storage + notifications
│  │  ├─ oauth/                        # OAuth helpers / OAuth 辅助逻辑
│  │  ├─ items/                        # Items storage / items 存储
│  │  ├─ shares/                       # Shares storage / shares 存储
│  │  │  └─ public.ts                  # Public share queries / 分享页查询
│  │  └─ tracking/                     # Event tracking helpers / 埋点 helper
│  └─ supabase/                        # Admin fetch helper / 管理端请求封装
├─ middleware.ts                      # SSR session refresh middleware
└─ supabase/migrations/
   ├─ 001_init.sql                     # oauth_codes/oauth_tokens
   ├─ 002_items.sql                    # items
   ├─ 003_rls.sql                      # RLS policies
   ├─ 004_shares.sql                   # shares
   ├─ 005_events.sql                   # events
   ├─ 006_items_v03.sql                # items v0.3
   ├─ 007_item_enrich_runs.sql         # item_enrich_runs
   └─ 008_feedback.sql                 # feedback
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
