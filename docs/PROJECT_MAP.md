# PROJECT_MAP

## 单一导航入口 / Single Navigation Entry

文档仅保留本文件 + `MVP_SPEC` + `CHEATSHEET` + `SECURITY` + 根目录 `README.md`。任何其他文档均不再是规范来源。

Documentation is consolidated to this file + `MVP_SPEC` + `CHEATSHEET` + `SECURITY` + the root `README.md`. No other docs are normative.

## 当前项目地图 / Current Project Map

```
.
├─ actions/
│  └─ openapi.template.yaml      # OpenAPI 模板（占位符 __BASE_URL__）
├─ docs/
│  ├─ MVP_SPEC.md
│  ├─ PROJECT_MAP.md
│  ├─ CHEATSHEET.md
│  └─ SECURITY.md
├─ public/
│  └─ openapi.yaml               # 由模板渲染生成（npm run gen:openapi）
├─ scripts/
│  ├─ gen-openapi.mjs            # 渲染 openapi.template.yaml -> public/openapi.yaml
│  ├─ smoke_oauth.sh             # OAuth flow smoke
│  ├─ smoke_items.sh             # Items API smoke
│  └─ preflight.sh               # 预检查
├─ src/
│  ├─ app/
│  │  ├─ api/oauth/authorize/route.ts  # GET /api/oauth/authorize
│  │  ├─ api/oauth/token/route.ts      # POST /api/oauth/token
│  │  ├─ oauth/authorize/route.ts      # GET /oauth/authorize (alias)
│  │  ├─ oauth/token/route.ts          # POST /oauth/token (alias)
│  │  ├─ api/me/route.ts               # GET /me
│  │  ├─ api/items/route.ts            # GET/POST /items
│  │  └─ login/                        # /login (Supabase password grant)
│  ├─ server/
│  │  ├─ auth/                         # bearer + supabase session
│  │  ├─ oauth/                        # OAuth code/token helpers
│  │  └─ items/                        # Items storage
│  └─ supabase/                        # Admin fetch helper
└─ supabase/migrations/
   ├─ 001_init.sql                 # oauth_codes/oauth_tokens
   └─ 002_items.sql                # items
```

```
.
├─ actions/
│  └─ openapi.template.yaml      # OpenAPI template (__BASE_URL__ placeholder)
├─ docs/
│  ├─ MVP_SPEC.md
│  ├─ PROJECT_MAP.md
│  ├─ CHEATSHEET.md
│  └─ SECURITY.md
├─ public/
│  └─ openapi.yaml               # Generated via template (npm run gen:openapi)
├─ scripts/
│  ├─ gen-openapi.mjs            # Render template -> public/openapi.yaml
│  ├─ smoke_oauth.sh             # OAuth flow smoke
│  ├─ smoke_items.sh             # Items API smoke
│  └─ preflight.sh               # Preflight checks
├─ src/
│  ├─ app/
│  │  ├─ api/oauth/authorize/route.ts  # GET /api/oauth/authorize
│  │  ├─ api/oauth/token/route.ts      # POST /api/oauth/token
│  │  ├─ oauth/authorize/route.ts      # GET /oauth/authorize (alias)
│  │  ├─ oauth/token/route.ts          # POST /oauth/token (alias)
│  │  ├─ api/me/route.ts               # GET /me
│  │  ├─ api/items/route.ts            # GET/POST /items
│  │  └─ login/                        # /login (Supabase password grant)
│  ├─ server/
│  │  ├─ auth/                         # bearer + supabase session
│  │  ├─ oauth/                        # OAuth code/token helpers
│  │  └─ items/                        # Items storage
│  └─ supabase/                        # Admin fetch helper
└─ supabase/migrations/
   ├─ 001_init.sql                 # oauth_codes/oauth_tokens
   └─ 002_items.sql                # items
```

## OpenAPI 生成方式 / OpenAPI Generation

- 来源：`actions/openapi.template.yaml`（包含 `__BASE_URL__` 占位符）。
- 输出：`public/openapi.yaml`。
- 生成命令：`npm run gen:openapi`（`npm run build` 会通过 `prebuild` 自动执行）。
- Base URL 解析：`scripts/gen-openapi.mjs` 使用 `BASE_URL` 或 Vercel 环境变量。

- Source: `actions/openapi.template.yaml` (contains `__BASE_URL__` placeholder).
- Output: `public/openapi.yaml`.
- Command: `npm run gen:openapi` (automatically run via `prebuild` during `npm run build`).
- Base URL resolution: `scripts/gen-openapi.mjs` uses `BASE_URL` or Vercel env vars.

## 现有 API 路由（高层级） / Existing API Routes (High-Level)

- OAuth bridge: `GET /api/oauth/authorize` (alias `GET /oauth/authorize`), `POST /api/oauth/token` (alias `POST /oauth/token`).
- Identity: `GET /me` (requires OAuth bearer).
- Items: `GET /items`, `POST /items` (requires OAuth bearer).

- OAuth bridge: `GET /api/oauth/authorize` (alias `GET /oauth/authorize`), `POST /api/oauth/token` (alias `POST /oauth/token`).
- Identity: `GET /me` (requires OAuth bearer).
- Items: `GET /items`, `POST /items` (requires OAuth bearer).
