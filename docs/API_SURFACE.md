# API Surface (Actions) / Actions 调用面 API

This doc is a human-readable contract. The machine-readable contract is generated from:
- `actions/openapi.template.yaml` (source template)
- `public/openapi.yaml` (build artifact via `npm run gen:openapi`)

> Spec reference: `docs/MVP_SPEC.md` → section “API（Actions 调用面）”.

---

## 1) Auth / 鉴权

All private APIs require OAuth2 authorization code flow and a bearer access token:
- `Authorization: Bearer <access_token>`

The token maps to a Supabase `user.id`.

---

## 2) Me

**Current Actions OpenAPI (v0):**
- `GET /me`

**Response**
- `{ "user_id": "...", "client_id": "..." }`

---

## 3) Items

**Current Actions OpenAPI (v0):**
- `POST /items`, `GET /items` only
- Idempotency based on `(user_id, url_original)`
- Sort: `created_at desc`
- No normalize/OG/dedupe/rank/delete yet (next step)

### 3.1 `POST /items` (save/upsert, idempotent by url_original)

**Request**
```json
{
  "url": "https://..."
}
```

**Backend steps (Step 1)**
1. Validate `url`
2. Upsert by `(user_id, url_original)`; on conflict, update `updated_at`

**Response**
- `item` object (`id`, `url_original`, `created_at`, `updated_at`)

### 3.2 `GET /items` (list current user)

**Response**
- `{ "items": [...] }` sorted by `created_at desc`

### 3.3 `PATCH /items/{id}` (planned)

### 3.4 `DELETE /items/{id}` (planned)

---

## 4) Share (planned)

### 4.1 `POST /share`

**Behavior**
- create `shares` row bound to `user_id`
- return `{ share_url }`

### 4.2 `GET /s/{token}`

**Behavior**
- render read-only HTML of user's list
- must be **unlisted** and **noindex**
