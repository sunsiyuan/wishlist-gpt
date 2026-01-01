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

### 2.1 `POST /items` (save/upsert + move-to-top)

**Request**
```json
{
  "url": "https://...",
  "note": "optional",
  "tags": ["optional"]
}
```

**Backend steps (MVP)**
1. ACP detect → if not ACP: URL normalize (LLM-first)
2. Fetch OG: title + image (optional)
3. Build dedupe_key (ACP URL OR normalized URL)
4. Upsert item (same key: update fields, do not create new)
5. Move to top via fractional rank

**Response**
- `item` object (id, url, title, image, rank, created_at, updated_at)

### 2.2 `GET /items` (list, default not deleted)

**Query**
- `include_deleted=false` (default)

**Response**
- `{ "items": [...] }` sorted by `rank asc`

### 2.3 `PATCH /items/{id}` (reorder)

**Request**
```json
{ "rank": "string or number (fractional)" }
```

### 2.4 `DELETE /items/{id}` (soft delete)

**Behavior**
- mark `deleted_at` (or `is_deleted`) but keep row.

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
