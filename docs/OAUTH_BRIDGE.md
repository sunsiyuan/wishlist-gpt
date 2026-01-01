# OAuth Bridge / OAuth 桥接（MVP）

This doc defines the **minimal OAuth bridge** required by the MVP spec, focusing on:
- endpoints
- parameters
- token/code lifecycle
- mapping to Supabase user id

> Spec reference: `docs/MVP_SPEC.md` → “OAuth bridge 最小要求”.

---

## 1) Goal / 目标

**中文**
- 让 GPT Actions 通过 OAuth “连接账号”，拿到 `access_token`，之后能以用户身份调用我们的私有 API（Items/Share）。

**English**
- Allow GPT Actions to connect a user account via OAuth, obtain an `access_token`, and call private APIs as that user.

---

## 2) OAuth Flow / 流程（Authorization Code）

### 2.1 Sequence (high level)

1. GPT Actions opens:
   `GET /oauth/authorize?...&state=...`
2. User signs in on our hosted login page (Google/Apple via Supabase Auth).
3. Server validates `state`, issues a **one-time `code`** (TTL 5 min), then redirects:
   `redirect_uri?code=...&state=...`
4. GPT exchanges code:
   `POST /oauth/token` (`grant_type=authorization_code`)
5. Server returns:
   - `access_token` (TTL 15 min)
   - `refresh_token` (recommended, TTL 30 days)

> Note: If the platform requires PKCE, add it later (out of MVP unless required).

---

## 3) Endpoints / 接口

### 3.1 `GET /oauth/authorize`

**Purpose**
- Start connect flow, validate `state`, then redirect back with `code`.

**Query parameters (minimum)**
- `response_type=code`
- `client_id`
- `redirect_uri`
- `scope` (optional)
- `state` (required, CSRF)

**Behavior**
- Validate `redirect_uri` matches allowlist for `client_id`.
- Require user login (Google/Apple).
- Create `oauth_codes` row:
  - `code` (pk), `user_id`, `client_id`, `redirect_uri`, `expires_at`, `used_at=null`
- Redirect: `redirect_uri?code=...&state=...`

### 3.2 `POST /oauth/token`

**Purpose**
- Exchange code for tokens, and refresh access token.

**Request (application/x-www-form-urlencoded)**
- `grant_type=authorization_code`
  - `code`
  - `redirect_uri`
  - `client_id`
- `grant_type=refresh_token`
  - `refresh_token`
  - `client_id`

**Response (JSON)**
- `access_token`
- `token_type` = `Bearer`
- `expires_in` (seconds)
- `refresh_token` (optional, but recommended)
- `scope` (optional)

**Rules**
- Code is **one-time**: set `used_at` on success; reject reuse.
- Code must not be expired; TTL ~ 5 minutes.
- Access token TTL ~ 15 minutes.
- Refresh token TTL ~ 30 days; stored hashed in `oauth_tokens` (optional table).

---

## 4) Token to User Mapping / token 与用户映射

MVP requirement:
- token must map uniquely to **Supabase `user.id`**.

Implementation notes (minimal):
- `access_token` can be a signed JWT (server secret), with claims:
  - `sub = user_id`
  - `aud = client_id`
  - `exp`
- API routes validate token, extract `user_id`, then use it to enforce RLS / query items.

---

## 5) Security Checklist / 安全检查清单（MVP）

- [ ] Validate `state` strictly (CSRF)
- [ ] `redirect_uri` allowlist per `client_id`
- [ ] One-time code with TTL and `used_at`
- [ ] Rate limit token endpoint (per IP / per user)
- [ ] Token secrets stored in env vars only
