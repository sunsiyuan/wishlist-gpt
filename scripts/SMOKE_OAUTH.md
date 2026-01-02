### OAuth Bridge + `/me` Smoke Test (Local)

#### 0) One-liner: load env

在 repo 根目录执行（每次开新 terminal/tab 都可复用）：

```bash
set -a; source .env.local; set +a
```

#### 1) Network proxy (optional)

如果 `npm install` 需要代理：

```bash
export http_proxy="http://127.0.0.1:7897"
export https_proxy="http://127.0.0.1:7897"
export NO_PROXY="localhost,127.0.0.1"
```

#### 2) Install & run dev server

```bash
npm install
npm run dev
```

#### 3) Sanity: server is reachable

```bash
curl -i http://localhost:3000/
```

**Expected**

* 200/307/404 都可以接受（只要不是 “Couldn’t connect”）
* 目标是确认服务在监听 3000

---

## A. Route existence checks (fast)

### A1) `/oauth/authorize` exists

```bash
curl -i "http://localhost:3000/oauth/authorize"
```

**Expected**

* `400 invalid_request`（缺必要参数：`state/client_id/redirect_uri`）
* 关键点：**不是 404**

### A2) `/me` is protected

```bash
curl -i "http://localhost:3000/me"
```

**Expected**

* `401`（missing bearer token）
* 关键点：**不是 404**

---

## B. Get Supabase user access token (password grant)

> 用 Supabase Auth 生成“用户登录态 token”，用于调用 `/oauth/authorize` 触发授权流程。

```bash
curl -s \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_USER_EMAIL\",\"password\":\"$TEST_USER_PASSWORD\"}" \
  "$SUPABASE_URL/auth/v1/token?grant_type=password"
```

**Expected**

* 返回 JSON，包含 `access_token`（记为 `TEST_USER_ACCESS_TOKEN`）

建议立即导出：

```bash
export TEST_USER_ACCESS_TOKEN="(paste access_token here)"
```

**Key negative cases**

* `invalid_grant` / `Invalid login credentials`：邮箱/密码不对，或 Email provider 没开
* `email not confirmed`：启用了邮箱确认但用户未确认（本地可暂时关闭确认）

---

## C. OAuth authorize: get `code`

预先设置 OAuth 测试参数（client allowlist 需与 `.env.local` 一致）：

```bash
export BASE_URL="http://localhost:3000"
export CLIENT_ID="local-dev-client"
export REDIRECT_URI="http://localhost:3000/dev/callback"
export STATE="state-123"
```

请求 authorize（带 cookie jar）：

```bash
curl -i -c cookies.txt -b cookies.txt \
  -H "Authorization: Bearer $TEST_USER_ACCESS_TOKEN" \
  "$BASE_URL/oauth/authorize?response_type=code&client_id=$CLIENT_ID&redirect_uri=$REDIRECT_URI&state=$STATE"
```

**Expected**

* `302/307` redirect
* `Location: $REDIRECT_URI?code=...&state=$STATE`
* 注意：`/dev/callback` 实际存在与否不影响 smoke test（我们只要 `code`）

导出 `code`：

```bash
export TEST_USER_CODE="(paste code here)"
```

**Key negative cases**

* Missing `state` → `400 invalid_request`
* Redirect not allowlisted → `400`（redirect_uri not allowed）
* Login required → `{"error":"invalid_request","error_description":"login required"}`

  * 表示服务端没识别到登录态（token 无效或 authorize 不支持 header token）

---

## D. OAuth token exchange: code → tokens

```bash
curl -s -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&client_id=$CLIENT_ID&redirect_uri=$REDIRECT_URI&code=$TEST_USER_CODE" \
  "$BASE_URL/oauth/token"
```

**Expected**

* JSON with:

  * `access_token` (OAuth access token)
  * `token_type=Bearer`
  * `expires_in`
  * `refresh_token`（如果启用 refresh）

导出：

```bash
export TEST_USER_OAUTH_ACCESS_TOKEN="(paste access_token here)"
export TEST_USER_OAUTH_REFRESH_TOKEN="(paste refresh_token here, if present)"
```

### Key negative case: code replay must fail (one-time)

```bash
curl -i -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&client_id=$CLIENT_ID&redirect_uri=$REDIRECT_URI&code=$TEST_USER_CODE" \
  "$BASE_URL/oauth/token"
```

**Expected**

* `400`（invalid/expired/used code）

---

## E. Call protected `/me` with OAuth access token

```bash
curl -i -H "Authorization: Bearer $TEST_USER_OAUTH_ACCESS_TOKEN" "$BASE_URL/me"
```

**Expected**

* `200`
* JSON includes:

  * `user_id` (Supabase user.id)
  * ideally `client_id` (the OAuth client)

**Key negative cases**

* Missing bearer → `401`
* Invalid/expired bearer → `401/400`（按实现）

---

## F. Refresh (optional)

如果你有 refresh token：

```bash
curl -s -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token&client_id=$CLIENT_ID&refresh_token=$TEST_USER_OAUTH_REFRESH_TOKEN" \
  "$BASE_URL/oauth/token"
```

**Expected**

* 返回新的 `access_token`
* 可用新 token 再调用 `/me` 成功

**Key negative cases**

* Invalid refresh token → `400`
* Expired/revoked → `400`

---

## Pass criteria (MVP OAuth Bridge)

* `/oauth/authorize` can issue code for a logged-in user
* `/oauth/token` exchanges code → access token
* Code is one-time (replay fails)
* `/me` returns `user_id` when called with OAuth access token
* (Optional) refresh works

---

## “关键负例”至少保留这 6 个

1. `/oauth/authorize` 缺 `state` → 400
2. `/oauth/authorize` `redirect_uri` 不在 allowlist → 400
3. `/oauth/authorize` login required（无登录态） → 400 invalid_request
4. `/oauth/token` 重放同一个 code → 400
5. `/me` 不带 bearer → 401
6. `/me` 带无效/过期 bearer → 401/400

这 6 个就足够把 OAuth 的“安全骨架”锁住。 
