# SECURITY

## 0) 安全边界一句话 / One-line security boundary
CN：**`/api/mcp`** 必须通过 **OAuth 2.1 `Authorization: Bearer`** 访问，且 access token 的 `aud` 必须绑定到本 MCP resource（`<BASE_URL>/api/mcp`，RFC 8707）——受众不匹配一律 401。授权码流强制 PKCE `S256`；ChatGPT 通过 DCR（`/oauth/register`）自注册。`/api/*` Web 路由仍以 Supabase cookie session 为主。  
EN: **`/api/mcp`** requires **OAuth 2.1 `Authorization: Bearer`**, and the access token `aud` MUST be bound to this MCP resource (`<BASE_URL>/api/mcp`, RFC 8707) — audience mismatch is rejected with 401. The authorization-code flow requires PKCE `S256`; ChatGPT self-registers via DCR (`/oauth/register`). Web `/api/*` routes remain primarily Supabase cookie-session based.

> ⚠️ 旧的 Actions 根级 `/me` `/items` `/shares` 路由已移除；本文件下方历史条目仅作参考。

---

## 1) 生产默认行为 / Production defaults
- `OAUTH_ALLOW_AUTH_HEADER_LOGIN` 未设置时，生产环境默认 **禁用** Supabase Authorization 头部登录绕过，仅允许 cookie-based session。  
- OAuth access token（`/me`, `/items`）校验不受 `OAUTH_ALLOW_AUTH_HEADER_LOGIN` 影响，始终通过 `Authorization: Bearer` 验证。  

- When `OAUTH_ALLOW_AUTH_HEADER_LOGIN` is unset, production defaults to **disallow** Supabase Authorization header bypass and only allows cookie-based session.  
- OAuth access token verification (`/me`, `/items`) is not gated by `OAUTH_ALLOW_AUTH_HEADER_LOGIN`; it always uses `Authorization: Bearer` validation.  

---

## 2) 威胁模型（最小）/ Minimal threat model
- 未授权访问：必须使用有效 OAuth bearer 访问 `/me` 与 `/items`。  
- OAuth 重定向滥用：`redirect_uri` 必须在 `OAUTH_ALLOWED_CLIENTS_JSON` 允许列表内。  
- 管理密钥泄露：`SUPABASE_SERVICE_ROLE_KEY` 必须仅在服务器端使用并妥善保管。  
- 分享页数据边界：public share 使用 service role 读取数据时，只能返回非 PII 字段（不返回 `user_id` / email）。  
- 公共埋点端点：`/api/track/share-view` 可公开访问，仅写入最小事件（不包含 PII；`meta` 仅 `request_id` + `x_vercel_id`）。  

- Unauthorized access: `/me` and `/items` require a valid OAuth bearer.  
- OAuth redirect abuse: `redirect_uri` must be allow-listed via `OAUTH_ALLOWED_CLIENTS_JSON`.  
- Admin key exposure: `SUPABASE_SERVICE_ROLE_KEY` must remain server-only and protected.  
- Share page data boundary: when the public share page uses the service role to read data, return only non-PII fields (no `user_id` / email).  
- Public tracking endpoint: `/api/track/share-view` is publicly accessible and only writes minimal events (no PII; `meta` limited to `request_id` + `x_vercel_id`).  

---

## 3) 操作准则 / Operational do’s & don’ts

### Do
- 将 `OAUTH_SIGNING_SECRET` 视为敏感密钥并安全存储。  
- 为 production 显式配置 `OAUTH_ALLOWED_CLIENTS_JSON`（最小化 redirect_uris）。  
- 只在必要时启用 `OAUTH_ALLOW_AUTH_HEADER_LOGIN`（尤其不要长期在生产开启）。  

- Treat `OAUTH_SIGNING_SECRET` as a secret and store it securely.  
- Configure `OAUTH_ALLOWED_CLIENTS_JSON` explicitly for production (minimize redirect_uris).  
- Enable `OAUTH_ALLOW_AUTH_HEADER_LOGIN` only when needed (do not keep it enabled in prod).  

### Don’t
- 不要在客户端或日志中泄露 `SUPABASE_SERVICE_ROLE_KEY`。  
- 不要让 allowlist 变成“过宽泛匹配”（降低 redirect 滥用门槛）。  
- 不要默认开启生产 header bypass。  

- Do not expose `SUPABASE_SERVICE_ROLE_KEY` in client code or logs.  
- Do not make redirect allowlists overly broad (reduces the bar for redirect abuse).  
- Do not enable header bypass by default in production.  

---

## 4) 相关环境开关 / Relevant env flags
- `OAUTH_ALLOW_AUTH_HEADER_LOGIN`：控制 Supabase Authorization header 登录绕过；未设置时 prod 默认关闭，非 prod 默认开启。  
- `OAUTH_ALLOWED_CLIENTS_JSON`：OAuth client + redirect allowlist。  
- `OAUTH_SIGNING_SECRET`：OAuth access token 签名密钥。  
- `SUPABASE_SERVICE_ROLE_KEY`：Supabase 管理密钥（仅服务器端）。  

- `OAUTH_ALLOW_AUTH_HEADER_LOGIN`: gates Supabase Authorization header login bypass; when unset, prod defaults off and non-prod defaults on.  
- `OAUTH_ALLOWED_CLIENTS_JSON`: OAuth client + redirect allowlist.  
- `OAUTH_SIGNING_SECRET`: signing secret for OAuth access tokens.  
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase admin key (server-only). 
