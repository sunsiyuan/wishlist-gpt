# PROJECT_MAP

> ⚠️ **Apps SDK / MCP migration**: 项目已从 ChatGPT Actions 迁移到 OpenAI Apps SDK（MCP）。
> 新增关键位置：
> - MCP server: `src/app/api/mcp/route.ts`（`createMcpHandler` + `withMcpAuth`）
> - MCP tools: `src/server/mcp/tools.ts`（`list_wishlist` / `add_to_wishlist` / `share_wishlist` / `send_feedback`）
> - Widget: `src/server/mcp/widget.ts`（resource `ui://widget/wishlist.html`）
> - MCP token 校验: `src/server/mcp/auth.ts`
> - OAuth 2.1: `src/app/.well-known/*`（发现）、`src/app/api/oauth/register`（DCR）、`src/server/oauth/*`（PKCE、resource/aud、client-store）
> - 共享写入逻辑: `src/server/items/addItem.ts`
>
> 已移除：`actions/`、OpenAPI 生成、根级 `/items` `/me` `/shares` `/feedback`、服务端富化（`enrich`）与标注台（`/ops`）、`/api/cron/enrich`、`/api/dev`。

## 0. 单一导航入口 / Single navigation entry
CN：本项目的规范性文档只保留：`README.md`、`MVP_SPEC`、`PROJECT_MAP`、`CHEATSHEET`、`SECURITY`。其他任何文档都不再是规范来源。（`ENRICH_STRATEGY` 已随服务端富化移除而废弃。）  
EN: Normative docs are limited to: `README.md`, `MVP_SPEC`, `PROJECT_MAP`, `CHEATSHEET`, `SECURITY`. (`ENRICH_STRATEGY` is deprecated — server-side enrichment was removed.)

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
- Items URL sanitization / URL清理: `src/server/items/sanitizeUrl.ts`
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
- Cron enrich route / 定时enrich任务: `src/app/api/cron/enrich/route.ts`
- Cron daily route / 每日定时任务: `src/app/api/cron/daily/route.ts`
- Cron system-health route / 系统健康检查: `src/app/api/cron/system-health/route.ts`
- Dev enrich route / 开发enrich测试: `src/app/api/dev/enrich/route.ts`
- Metrics daily route / 每日指标: `src/app/api/metrics/daily/route.ts`
- Ops routes / 运维路由: `src/app/api/ops/item/[id]/route.ts`, `src/app/api/ops/queue/route.ts`
- Tracking routes / 埋点路由: `src/app/api/track/event/route.ts`, `src/app/api/track/share-view/route.ts`
- Public share page / 分享页: `src/app/s/[share_id]/page.tsx`
- Onboarding profile page / 个人资料设置页: `src/app/onboarding/profile/page.tsx`
- Ops page / 运维页面: `src/app/ops/page.tsx`
- Settings page / 设置页面: `src/app/app/settings/page.tsx`
- Privacy/Terms pages / 隐私和条款页: `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`
- Shares migration: `supabase/migrations/004_shares.sql`
- Events migration: `supabase/migrations/005_events.sql`
- Items v0.3 migration: `supabase/migrations/006_items_v03.sql`
- Item enrich runs migration: `supabase/migrations/007_item_enrich_runs.sql`
- Item enrich runs attempts migration: `supabase/migrations/009_item_enrich_runs_attempts.sql`
- Feedback migration: `supabase/migrations/008_feedback.sql`
- Profiles migration: `supabase/migrations/010_profiles.sql`
- Profiles social migration: `supabase/migrations/011_profiles_social.sql` (v0.9)
- Follows migration: `supabase/migrations/012_follows.sql` (v0.9)
- Items v1.0 migration: `supabase/migrations/013_items_v1_0.sql`
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
│  ├─ SECURITY.md                    # 安全与生产默认 / security & prod defaults
│  └─ ENRICH_STRATEGY.md             # Enrich策略文档 / Enrich strategy documentation
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
│  │  ├─ api/cron/enrich/route.ts     # /api/cron/enrich (Vercel Cron daily enrich)
│  │  ├─ api/cron/daily/route.ts      # /api/cron/daily (Vercel Cron daily tasks)
│  │  ├─ api/cron/system-health/route.ts # /api/cron/system-health (system health check)
│  │  ├─ api/dev/enrich/route.ts      # /api/dev/enrich (dev enrich testing)
│  │  ├─ api/metrics/daily/route.ts   # /api/metrics/daily (daily metrics)
│  │  ├─ api/ops/item/[id]/route.ts  # /api/ops/item/:id (ops item management)
│  │  ├─ api/ops/queue/route.ts       # /api/ops/queue (ops queue management)
│  │  ├─ api/track/event/route.ts     # /api/track/event (event tracking)
│  │  ├─ api/track/share-view/route.ts # share view tracking (public)
│  │  ├─ feedback/route.ts             # /feedback (OAuth bearer Actions)
│  │  ├─ logout/route.ts               # GET /logout (clear cookies + redirect)
│  │  ├─ login/                        # /login (Supabase auth UI) / 登录页
│  │  ├─ onboarding/                  # /onboarding (onboarding flow) / 引导流程
│  │  ├─ ops/                          # /ops (ops dashboard) / 运维面板
│  │  ├─ app/settings/                 # /app/settings (user settings) / 用户设置
│  │  ├─ privacy/                      # /privacy (privacy policy) / 隐私政策
│  │  ├─ terms/                        # /terms (terms of service) / 服务条款
│  │  ├─ components/                   # Shared React components / 共享组件
│  │  ├─ go/chatgpt/route.ts          # /go/chatgpt (redirect to ChatGPT GPT)
│  │  └─ s/[share_id]/                 # /s/:share_id public share page + components
│  ├─ lib/
│  │  ├─ supabase/                     # Supabase SSR client setup
│  │  ├─ avatar.ts                     # Avatar generation helpers
│  │  ├─ chatgpt.ts                    # ChatGPT GPT URL helpers
│  │  ├─ itemDisplay.ts                # Item display helpers
│  │  ├─ options.ts                    # Options/constants
│  │  └─ profile.ts                     # Profile helpers
│  ├─ server/
│  │  ├─ auth/                         # bearer + supabase session / 认证层
│  │  ├─ feedback/                     # Feedback storage + notifications
│  │  ├─ oauth/                        # OAuth helpers / OAuth 辅助逻辑
│  │  ├─ items/                        # Items storage / items 存储
│  │  │  ├─ displayFields.ts          # Display field validation & sanitization
│  │  │  ├─ enrich.ts                  # Enrichment strategy implementation
│  │  │  ├─ sanitizeUrl.ts            # URL sanitization
│  │  │  └─ store.ts                   # Items database operations
│  │  ├─ profiles/                     # Profiles storage / profiles 存储
│  │  │  └─ store.ts                   # Profiles database operations
│  │  ├─ follows/                      # Follows storage / follows 存储
│  │  │  ├─ items.ts                   # Follows items queries
│  │  │  └─ store.ts                   # Follows database operations
│  │  ├─ shares/                       # Shares storage / shares 存储
│  │  │  ├─ index.ts                  # Shares database operations
│  │  │  └─ public.ts                  # Public share queries / 分享页查询
│  │  ├─ tracking/                     # Event tracking helpers / 埋点 helper
│  │  │  ├─ requestMeta.ts            # Request metadata extraction
│  │  │  ├─ trackBestEffort.ts        # Best-effort tracking
│  │  │  ├─ trackEvent.ts             # Event tracking
│  │  │  └─ types.ts                   # Tracking types
│  │  └─ supabase/                     # Admin fetch helper / 管理端请求封装
│  │     └─ admin.ts                   # Supabase admin client
├─ middleware.ts                      # SSR session refresh middleware
└─ supabase/migrations/
   ├─ 001_init.sql                     # oauth_codes/oauth_tokens
   ├─ 002_items.sql                    # items
   ├─ 003_rls.sql                      # RLS policies
   ├─ 004_shares.sql                   # shares
   ├─ 005_events.sql                   # events
   ├─ 006_items_v03.sql                # items v0.3
   ├─ 007_item_enrich_runs.sql         # item_enrich_runs
   ├─ 008_feedback.sql                 # feedback
   ├─ 009_item_enrich_runs_attempts.sql # item_enrich_runs enhancements
   ├─ 010_profiles.sql                 # profiles
   ├─ 011_profiles_social.sql          # profiles social fields (v0.9)
   ├─ 012_follows.sql                  # follows (v0.9)
   └─ 013_items_v1_0.sql               # items v1.0 enhancements
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
