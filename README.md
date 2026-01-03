# WishlistGPT

## 简介 / Overview
WishlistGPT 是一个基于 Next.js 的**最小化 OAuth bridge + wishlist API** 服务，面向 ChatGPT Actions / OpenAPI 使用场景：支持 OAuth 授权码流程、`/me` 身份验证，以及 `/items` 列表/创建接口。文档严格对齐当前实现，且本仓库只保留 5 份规范性文档（见下）。

WishlistGPT is a minimal **Next.js OAuth bridge + wishlist API** for ChatGPT Actions / OpenAPI: it supports the OAuth authorization-code flow, `/me` identity verification, and `/items` list/create APIs. Docs are strictly aligned with the current implementation, and only 5 normative docs remain (see below).

---

## 当前能力（MVP v0）/ What’s implemented (MVP v0)
- OAuth bridge：
  - `GET /api/oauth/authorize`（别名 `GET /oauth/authorize`）签发授权码
  - `POST /api/oauth/token`（别名 `POST /oauth/token`）支持 `authorization_code` 与 `refresh_token`
- 受保护 API（OAuth Bearer）：
  - `GET /me`
  - `GET /items`
  - `POST /items`（同一 URL 幂等 create/touch）
- OpenAPI：
  - 从 `actions/openapi.template.yaml` 渲染生成 `public/openapi.yaml`

- OAuth bridge:
  - `GET /api/oauth/authorize` (alias `GET /oauth/authorize`) issues authorization codes
  - `POST /api/oauth/token` (alias `POST /oauth/token`) supports `authorization_code` and `refresh_token`
- Protected APIs (OAuth Bearer):
  - `GET /me`
  - `GET /items`
  - `POST /items` (idempotent create/touch for the same URL)
- OpenAPI:
  - Render `actions/openapi.template.yaml` into `public/openapi.yaml`

---

## 文档入口（规范来源）/ Docs (normative sources)
> 只有以下 5 个文件是“规范来源”。其他 README 或历史文档不再作为规范依据。  
> Only the 5 files below are normative. Other READMEs or legacy docs are non-normative.

- `README.md`（本文件 / this file）
- `docs/MVP_SPEC.md`
- `docs/PROJECT_MAP.md`
- `docs/CHEATSHEET.md`
- `docs/SECURITY.md`

---

## 快速开始 / Quickstart

### 必要环境变量 / Required env vars
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OAUTH_ALLOWED_CLIENTS_JSON`
- `OAUTH_SIGNING_SECRET`

可选但常用 / Optional but common:
- `OAUTH_ALLOW_AUTH_HEADER_LOGIN`
- `BASE_URL`
- `CLIENT_ID`
- `REDIRECT_URI`
- `TEST_USER_EMAIL`
- `TEST_USER_PASSWORD`

> 重要 / Important: 修改 `.env*` 后，务必**重启终端**并重启 `npm run dev`，避免旧进程导致“改了但没生效”。  
> After changing `.env*`, **restart your terminal** and restart `npm run dev` to avoid stale-process confusion.

### 安装与启动 / Install & run
```bash
npm install
npm run dev
````

---

## Smoke（先脚本，后 Actions）/ Smoke (scripts first, then Actions)

```bash
npm run smoke:oauth
npm run smoke:items
npm run smoke:all
```

* `smoke:oauth`：验证 OAuth bridge + `/me`

* `smoke:items`：验证 `/items`（POST + GET）

* `smoke:all`：依次跑完全部 smoke

* `smoke:oauth`: validate OAuth bridge + `/me`

* `smoke:items`: validate `/items` (POST + GET)

* `smoke:all`: run all smokes in sequence

---

## Actions / OpenAPI（给 GPT 导入用）/ Actions / OpenAPI (for GPT import)

### OpenAPI 的“真相” / OpenAPI source of truth

* 模板 / Template: `actions/openapi.template.yaml`（含 `__BASE_URL__` 占位符）

* 生成 / Generate: `npm run gen:openapi`（`npm run build` 的 `prebuild` 也会自动执行）

* 产物 / Artifact: `public/openapi.yaml`

* Template: `actions/openapi.template.yaml` (with `__BASE_URL__`)

* Generate: `npm run gen:openapi` (also runs via `prebuild` during `npm run build`)

* Artifact: `public/openapi.yaml`

### Base URL 如何决定 / How base URL is derived

由 `scripts/gen-openapi.mjs` 根据 `BASE_URL` 或 Vercel 环境变量推导。
Authoritative logic lives in `scripts/gen-openapi.mjs` and derives the base URL from `BASE_URL` or Vercel env vars.

---

## 维护规则（避免文档再次发散）/ Maintenance rules (prevent doc drift)

* 改动 API 路由、OpenAPI 生成路径、smoke 命令或关键 env：必须同步更新 `MVP_SPEC` + `CHEATSHEET` + `PROJECT_MAP`。
* If you change API routes, OpenAPI generation paths, smoke commands, or key env flags: update `MVP_SPEC` + `CHEATSHEET` + `PROJECT_MAP`.
