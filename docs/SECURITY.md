# SECURITY

## 生产默认行为 / Production Defaults

- `OAUTH_ALLOW_AUTH_HEADER_LOGIN` 未设置时，生产环境默认 **禁用** Supabase Authorization 头部登录绕过，仅允许 cookie-based session。
- OAuth access token（`/me`, `/items`）校验不受 `OAUTH_ALLOW_AUTH_HEADER_LOGIN` 影响，始终通过 `Authorization: Bearer` 验证。

- When `OAUTH_ALLOW_AUTH_HEADER_LOGIN` is unset, production defaults to **disallow** Supabase Authorization header bypass and only allows cookie-based session.
- OAuth access token verification (`/me`, `/items`) is not gated by `OAUTH_ALLOW_AUTH_HEADER_LOGIN`; it always uses `Authorization: Bearer` validation.

## 威胁模型（最小） / Minimal Threat Model

- 未授权访问：必须使用有效 OAuth bearer 访问 `/me` 与 `/items`。
- OAuth 重定向滥用：`redirect_uri` 必须在 `OAUTH_ALLOWED_CLIENTS_JSON` 允许列表内。
- 管理密钥泄露：`SUPABASE_SERVICE_ROLE_KEY` 必须仅在服务器端使用并妥善保管。

- Unauthorized access: `/me` and `/items` require a valid OAuth bearer.
- OAuth redirect abuse: `redirect_uri` must be allow-listed via `OAUTH_ALLOWED_CLIENTS_JSON`.
- Admin key exposure: `SUPABASE_SERVICE_ROLE_KEY` must remain server-only and protected.

## Do / Don't

**Do**
- 将 `OAUTH_SIGNING_SECRET` 视为敏感密钥并安全存储。
- 为 production 显式配置 `OAUTH_ALLOWED_CLIENTS_JSON`。
- 只在必要时启用 `OAUTH_ALLOW_AUTH_HEADER_LOGIN`。

**Don't**
- 不要在客户端或日志中泄露 `SUPABASE_SERVICE_ROLE_KEY`。
- 不要在生产环境默认启用 header bypass。

**Do**
- Treat `OAUTH_SIGNING_SECRET` as a secret and store it securely.
- Configure `OAUTH_ALLOWED_CLIENTS_JSON` explicitly for production.
- Enable `OAUTH_ALLOW_AUTH_HEADER_LOGIN` only when needed.

**Don't**
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` in client code or logs.
- Do not enable header bypass by default in production.

## 相关环境开关 / Relevant Env Flags

- `OAUTH_ALLOW_AUTH_HEADER_LOGIN`: 控制 Supabase Authorization header 登录绕过；未设置时 prod 默认关闭，非 prod 默认开启。
- `OAUTH_ALLOWED_CLIENTS_JSON`: OAuth client + redirect allowlist。
- `OAUTH_SIGNING_SECRET`: OAuth access token 签名密钥。

- `OAUTH_ALLOW_AUTH_HEADER_LOGIN`: Gates Supabase Authorization header login bypass; when unset, prod defaults off and non-prod defaults on.
- `OAUTH_ALLOWED_CLIENTS_JSON`: OAuth client + redirect allowlist.
- `OAUTH_SIGNING_SECRET`: Signing secret for OAuth access tokens.
