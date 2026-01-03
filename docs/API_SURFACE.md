# API Surface (Actions) / Actions 调用面 API

This doc is a human-readable contract. The machine-readable contract lives in:
- `actions/openapi.yaml` (to be implemented)

> Spec reference: `docs/MVP_SPEC.md` → section “API（Actions 调用面）”.

---

## 1) Auth / 鉴权

All private APIs require:
- `Authorization: Bearer <access_token>`

The token maps to a Supabase `user.id`.

---

## 2) Items

**Step 1 implemented (current):**
- `POST /items`, `GET /items` only
- Idempotency based on `(user_id, url_original)`
- Sort: `created_at desc`
- No normalize/OG/dedupe/rank/delete yet (next step)

### 2.1 `POST /items` (save/upsert, idempotent by url_original)

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

### 2.2 `GET /items` (list current user)

**Response**
- `{ "items": [...] }` sorted by `created_at desc`

### 2.3 `PATCH /items/{id}` (reorder, next step)

### 2.4 `DELETE /items/{id}` (soft delete, next step)

---

## 3) Share

### 3.1 `POST /share`

**Behavior**
- create `shares` row bound to `user_id`
- return `{ share_url }`

### 3.2 `GET /s/{token}`

**Behavior**
- render read-only HTML of user's list
- must be **unlisted** and **noindex**
