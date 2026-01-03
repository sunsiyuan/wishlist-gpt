# MVP_SPEC

## MVP 定义（范围） / MVP Definition (Scope)

本项目的 MVP 聚焦于一个可用的 OAuth bridge + wishlist API：提供授权码流程、获取当前用户身份信息、以及按用户维度创建/列出 wishlist 条目。所有接口形态与数据字段以当前代码实现为准。

This MVP focuses on a usable OAuth bridge + wishlist API: it provides the authorization-code flow, current user identity lookup, and per-user wishlist item create/list. All interface shapes and data fields follow the current code implementation.

## 当前已实现状态（MVP v0） / Current Implemented Status (MVP v0)

**已实现 / Implemented**
- OAuth bridge：`GET /api/oauth/authorize`（并提供别名 `GET /oauth/authorize`）生成授权码。
- Token 交换：`POST /api/oauth/token`（并提供别名 `POST /oauth/token`）支持 `authorization_code` 与 `refresh_token`。
- 受保护的用户信息：`GET /me`，需要 OAuth access token（Bearer）。
- 受保护的条目接口：`GET /items` 列表、`POST /items` 创建/触达（idempotent）。
- OpenAPI 生成：从 `actions/openapi.template.yaml` 渲染为 `public/openapi.yaml`。

**Implemented**
- OAuth bridge: `GET /api/oauth/authorize` (plus alias `GET /oauth/authorize`) issues authorization codes.
- Token exchange: `POST /api/oauth/token` (plus alias `POST /oauth/token`) supports `authorization_code` and `refresh_token`.
- Protected identity: `GET /me` requires OAuth access token (Bearer).
- Protected items: `GET /items` list and `POST /items` create/touch (idempotent).
- OpenAPI generation: render `actions/openapi.template.yaml` into `public/openapi.yaml`.

**未实现 / Not implemented yet**
- 任何不在上面列表中的功能（例如分享页、URL 归一化、额外数据模型等）当前均未实现。

**Not implemented yet**
- Any capability not listed above (e.g., share pages, URL normalization, additional data models) is not implemented.

## 现有 API 形状（按实现） / Current API Shapes (As Implemented)

**`GET /me`**
- 响应：`{ "user_id": string, "client_id": string }`

**`GET /me`**
- Response: `{ "user_id": string, "client_id": string }`

**`GET /items`**
- 响应：`{ "items": [ { "id", "url_original", "created_at", "updated_at" } ] }`

**`GET /items`**
- Response: `{ "items": [ { "id", "url_original", "created_at", "updated_at" } ] }`

**`POST /items`**
- 请求：`{ "url": string }`
- 响应：`{ "item": { "id", "url_original", "created_at", "updated_at" } }`

**`POST /items`**
- Request: `{ "url": string }`
- Response: `{ "item": { "id", "url_original", "created_at", "updated_at" } }`

**`POST /oauth/token` (authorization_code)**
- 请求体为 `application/x-www-form-urlencoded`。
- 响应包含：`access_token`, `token_type`, `expires_in`, `refresh_token`。

**`POST /oauth/token` (authorization_code)**
- Request body is `application/x-www-form-urlencoded`.
- Response includes: `access_token`, `token_type`, `expires_in`, `refresh_token`.

**`POST /oauth/token` (refresh_token)**
- 请求体为 `application/x-www-form-urlencoded`。
- 响应包含：`access_token`, `token_type`, `expires_in`（无 `refresh_token`）。

**`POST /oauth/token` (refresh_token)**
- Request body is `application/x-www-form-urlencoded`.
- Response includes: `access_token`, `token_type`, `expires_in` (no `refresh_token`).

## 用户路径（已实现 vs 规划） / User Flows (Current vs Planned)

**已实现 / Current**
1. 用户通过 `/login` 使用 Supabase 密码登录获取 session（设置 `sb-access-token` cookie）。
2. Actions 调用 `GET /api/oauth/authorize`（或 `/oauth/authorize`）进行授权码流程。
3. Actions 调用 `POST /oauth/token` 交换 access token（可选 refresh token）。
4. Actions 使用 access token 调用 `GET /me`、`GET /items`、`POST /items`。

**Current**
1. User logs in at `/login` via Supabase password grant to set `sb-access-token` cookie.
2. Actions call `GET /api/oauth/authorize` (or `/oauth/authorize`) to start the authorization code flow.
3. Actions call `POST /oauth/token` to exchange for an access token (optional refresh token).
4. Actions use the access token to call `GET /me`, `GET /items`, `POST /items`.

**规划 / Planned**
- 任何未实现的扩展流程目前仅为规划，不应被视为已上线。

**Planned**
- Any extended flow not implemented today is only planned and should not be treated as shipped.

## 验收标准（当前 + 规划） / Acceptance Criteria (Current + Planned)

**当前 / Current**
- `/api/oauth/authorize` 与 `/oauth/authorize` 可成功返回 `code` 并重定向到允许的 `redirect_uri`。
- `/oauth/token` 可用 `authorization_code` 交换有效 `access_token`。
- `/me` 使用有效 OAuth bearer 可返回 `user_id` 与 `client_id`。
- `/items` 可在同一 URL 下实现幂等创建，并可列出当前用户的条目。

**Current**
- `/api/oauth/authorize` and `/oauth/authorize` can return a `code` and redirect to allowed `redirect_uri`.
- `/oauth/token` can exchange `authorization_code` for a valid `access_token`.
- `/me` returns `user_id` and `client_id` with a valid OAuth bearer.
- `/items` supports idempotent create for the same URL and lists current user items.

**规划 / Planned**
- 不超出当前实现范围的新增验收标准。

**Planned**
- No acceptance criteria beyond current implementation.

## 数据模型摘要（当前字段） / Data Model Summary (Current Fields)

**items**
- `id` (uuid)
- `user_id` (uuid)
- `url_original` (text)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

**items**
- `id` (uuid)
- `user_id` (uuid)
- `url_original` (text)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

**oauth_codes**
- `code` (text)
- `user_id` (uuid)
- `client_id` (text)
- `redirect_uri` (text)
- `expires_at` (timestamptz)
- `used_at` (timestamptz, nullable)

**oauth_codes**
- `code` (text)
- `user_id` (uuid)
- `client_id` (text)
- `redirect_uri` (text)
- `expires_at` (timestamptz)
- `used_at` (timestamptz, nullable)

**oauth_tokens**
- `refresh_token_hash` (text)
- `user_id` (uuid)
- `client_id` (text)
- `expires_at` (timestamptz)
- `revoked_at` (timestamptz, nullable)
- `created_at` (timestamptz)

**oauth_tokens**
- `refresh_token_hash` (text)
- `user_id` (uuid)
- `client_id` (text)
- `expires_at` (timestamptz)
- `revoked_at` (timestamptz, nullable)
- `created_at` (timestamptz)
