# Deployment / 部署与域名

> Spec reference: `docs/MVP_SPEC.md` and repo Intended Map.

---

## 1) Domains / 域名（设计态）

- `app.<domain>`: login + list UI
- `api.<domain>`: Actions API surface + OAuth bridge
- `<domain>/s/{token}`: share page

MVP simplification:
- all served from one Next.js deployment; split by Host in `middleware.ts`.

---

## 2) Env Vars / 环境变量

- Supabase URL
- Supabase anon key (client)
- Supabase service role key (server only)
- OAuth signing secret (server)
- Allowed redirect URIs / client IDs

---

## 3) Security Headers / 安全头

- `/s/*`: noindex headers
- all: standard security headers (CSP, etc.) — minimal acceptable for MVP
