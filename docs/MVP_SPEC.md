# MVP_SPEC

## 0. 一句话结论 / One-line summary
CN：MVP v0 只保证 **OAuth bridge + `/me` + `/items` + 可导入的 OpenAPI** 这条闭环，所有接口形态与字段**以当前代码实现为准**。  
EN: MVP v0 only guarantees the closed loop of **OAuth bridge + `/me` + `/items` + importable OpenAPI**, and all shapes/fields follow the current implementation.

---

## 1. MVP 定义（范围）/ MVP Definition (Scope)

### 1.1 目标 / Goals
CN：
- Actions 通过 OAuth Connect 完成授权码流程并拿到 access token
- Actions 使用 Bearer 调 `GET /me` 获取 `user_id + client_id`
- Actions 使用 Bearer 调 `POST /items` 保存 URL、调 `GET /items` 列表
- OpenAPI 合约由模板生成并可被 Actions 导入（驱动上述调用）

EN:
- Actions completes OAuth Connect (authorization-code flow) and obtains an access token
- Actions calls `GET /me` (Bearer) to get `user_id + client_id`
- Actions calls `POST /items` (Bearer) to save a URL and `GET /items` to list items
- OpenAPI contract is generated from a template and importable by Actions (enabling the calls above)

### 1.2 非目标 / Non-goals
CN：以下内容不属于 MVP v0（即使曾经有文档或目录，也不代表已实现）：
- 分享页 / share page
- URL 归一化 / URL normalization
- 更丰富的数据模型、额外 API、排序/删除等扩展能力

EN: The following are NOT part of MVP v0 (legacy docs/folders do not imply implementation):
- Share pages
- URL normalization
- Expanded data model, additional APIs, reorder/delete, etc.

---

## 2. 当前已实现状态（MVP v0）/ Current Implemented Status (MVP v0)

### 2.1 已实现 / Implemented
- OAuth bridge：
  - `GET /api/oauth/authorize`（别名 `GET /oauth/authorize`）生成授权码（redirect 到 allowlisted `redirect_uri`）
  - `POST /api/oauth/token`（别名 `POST /oauth/token`）支持 `authorization_code` 与 `refresh_token`
- 受保护 API（需要 OAuth Bearer）：
  - `GET /me`
  - `GET /items`
  - `POST /items`（同一 URL 幂等 create/touch）
- OpenAPI：
  - 从 `actions/openapi.template.yaml` 渲染为 `public/openapi.yaml`

- OAuth bridge:
  - `GET /api/oauth/authorize` (alias `GET /oauth/authorize`) issues authorization codes (redirects to allowlisted `redirect_uri`)
  - `POST /api/oauth/token` (alias `POST /oauth/token`) supports `authorization_code` and `refresh_token`
- Protected APIs (OAuth Bearer required):
  - `GET /me`
  - `GET /items`
  - `POST /items` (idempotent create/touch for the same URL)
- OpenAPI:
  - Render `actions/openapi.template.yaml` into `public/openapi.yaml`

### 2.2 未实现 / Not implemented
CN：任何不在“已实现”列表中的能力，都视为未实现。  
EN: Any capability not explicitly listed as “Implemented” is not implemented.

---

## 3. 现有 API 形状（按实现）/ Current API Shapes (As implemented)

> 说明：这里只描述“对外可见的 contract”。如代码内部还有更多字段/错误码，以实现为准。  
> Note: This describes the externally visible contract. Additional fields/errors are implementation-defined.

### 3.1 `GET /me`
- 响应 / Response:
```json
{ "user_id": "string", "client_id": "string" }
````

### 3.2 `GET /items`

* 响应 / Response:

```json
{
  "items": [
    { "id": "uuid", "url_original": "string", "created_at": "timestamptz", "updated_at": "timestamptz" }
  ]
}
```

### 3.3 `POST /items`

* 请求 / Request:

```json
{ "url": "string" }
```

* 响应 / Response:

```json
{
  "item": { "id": "uuid", "url_original": "string", "created_at": "timestamptz", "updated_at": "timestamptz" }
}
```

### 3.4 `POST /oauth/token`（authorization_code）

* 请求体 / Request body: `application/x-www-form-urlencoded`
* 响应 / Response: `access_token`, `token_type`, `expires_in`, `refresh_token`

### 3.5 `POST /oauth/token`（refresh_token）

* 请求体 / Request body: `application/x-www-form-urlencoded`
* 响应 / Response: `access_token`, `token_type`, `expires_in`（无 / no `refresh_token`）

---

## 4. 用户路径（已实现 vs 规划）/ User flows (Current vs Planned)

### 4.1 已实现 / Current

1. 用户通过 `/login` 使用 Supabase 密码登录获取 session（设置 `sb-access-token` cookie）

2. Actions 调 `GET /api/oauth/authorize`（或别名 `/oauth/authorize`）进入授权码流程

3. Actions 调 `POST /oauth/token`（或 `/api/oauth/token`）换取 access token（可选 refresh token）

4. Actions 使用 Bearer 调 `GET /me`、`POST /items`、`GET /items`

5. User logs in via `/login` (Supabase password grant) to set `sb-access-token` cookie

6. Actions calls `GET /api/oauth/authorize` (or alias `/oauth/authorize`)

7. Actions calls `POST /oauth/token` (or `/api/oauth/token`) to exchange for an access token (optional refresh token)

8. Actions uses Bearer to call `GET /me`, `POST /items`, `GET /items`

### 4.2 规划 / Planned

CN：规划中的流程不写入“当前闭环”，也不作为验收依据。
EN: Planned flows are not part of the current loop and are not acceptance criteria.

---

## 5. 验收标准（当前）/ Acceptance criteria (Current)

### 5.1 脚本验收 / Script-level acceptance

* `npm run smoke:oauth` 通过（OAuth flow + `/me`）

* `npm run smoke:items` 通过（`/items` POST + GET）

* `npm run smoke:oauth` passes (OAuth flow + `/me`)

* `npm run smoke:items` passes (`/items` POST + GET)

### 5.2 Actions 验收 / Actions-level acceptance

* Actions 能导入生成后的 OpenAPI（`public/openapi.yaml` 对外可访问）

* 完成 Connect 后，能依次调用：`getMe` → `createItem` → `listItems` 且成功返回

* Actions can import the generated OpenAPI (served from `public/openapi.yaml`)

* After Connect, Actions can call: `getMe` → `createItem` → `listItems` successfully

---

## 6. 数据模型摘要（当前字段）/ Data model summary (Current fields)

### items

* `id` (uuid)
* `user_id` (uuid)
* `url_original` (text)
* `created_at` (timestamptz)
* `updated_at` (timestamptz)

### oauth_codes

* `code` (text)
* `user_id` (uuid)
* `client_id` (text)
* `redirect_uri` (text)
* `expires_at` (timestamptz)
* `used_at` (timestamptz, nullable)

### oauth_tokens

* `refresh_token_hash` (text)
* `user_id` (uuid)
* `client_id` (text)
* `expires_at` (timestamptz)
* `revoked_at` (timestamptz, nullable)
* `created_at` (timestamptz)
