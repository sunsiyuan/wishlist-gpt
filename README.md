# WishlistGPT

## 简介 / Overview

WishlistGPT 是一个基于 Next.js 的最小化 OAuth bridge + wishlist API 服务，面向 Actions/OpenAPI 使用场景：支持 OAuth 授权码交换、`/me` 身份验证与 `/items` 列表/创建接口。文档严格对齐当前实现。

WishlistGPT is a minimal Next.js OAuth bridge + wishlist API service for Actions/OpenAPI use cases. It supports OAuth authorization-code exchange, `/me` identity verification, and `/items` list/create APIs. Documentation is strictly aligned with the current implementation.

## 文档入口 / Docs

- [docs/MVP_SPEC.md](docs/MVP_SPEC.md)
- [docs/PROJECT_MAP.md](docs/PROJECT_MAP.md)
- [docs/CHEATSHEET.md](docs/CHEATSHEET.md)
- [docs/SECURITY.md](docs/SECURITY.md)

## 快速开始 / Quickstart

### 必要环境变量 / Required env vars

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OAUTH_ALLOWED_CLIENTS_JSON`
- `OAUTH_SIGNING_SECRET`

> 可选但常用 / Optional but common: `OAUTH_ALLOW_AUTH_HEADER_LOGIN`, `BASE_URL`, `CLIENT_ID`, `REDIRECT_URI`, `TEST_USER_EMAIL`, `TEST_USER_PASSWORD`.

### 安装与启动 / Install & run

```bash
npm install
npm run dev
```

### Smoke 入口 / Smoke entrypoints

```bash
npm run smoke:oauth
npm run smoke:items
npm run smoke:all
```

## Actions / OpenAPI

- OpenAPI 生成来源：`actions/openapi.template.yaml`，输出到 `public/openapi.yaml`（`npm run gen:openapi`，`npm run build` 会自动执行）。
- Base URL 由 `BASE_URL` 或 Vercel 环境变量推导（详见 `scripts/gen-openapi.mjs`）。

- OpenAPI source: `actions/openapi.template.yaml`, output to `public/openapi.yaml` (`npm run gen:openapi`, and `npm run build` runs it automatically).
- Base URL is derived from `BASE_URL` or Vercel env vars (see `scripts/gen-openapi.mjs`).
