# Share Page / 分享页（/s/{token}）

> Spec reference: `docs/MVP_SPEC.md` → “分享 / Share”.

---

## 1) Requirements / 要求

- Unlisted: only accessible via token link
- Noindex: prevent search engine indexing
- Read-only: no auth required to view, no mutations

---

## 2) Implementation Notes / 实现要点

- Add `X-Robots-Tag: noindex, nofollow` header for `/s/*`
- Add `<meta name="robots" content="noindex,nofollow" />` in HTML
- Add `robots.txt` disallow for `/s/`

---

## 3) Token Design / token 设计

- High-entropy random string
- Stored in `shares.token` (PK)
- Maps to `user_id`
