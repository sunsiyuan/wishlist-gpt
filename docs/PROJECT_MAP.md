# Project Map / 项目地图（Intended vs Current）

> This document is the **single navigation entry** for the repo.
> It contains **two maps**:
> 1) **Intended Project Map** (the design target)
> 2) **Current Project Map** (the as-is repo state)
>
> Going forward, every implementation change should:
> - move the repo **closer to the Intended Map**, and
> - update the **Current Map** to match reality.

---

## 0) Context / 背景

- Spec of record: `docs/MVP_SPEC.md`
- MVP first milestone: **OAuth bridge end-to-end** (Actions connect -> API call as user)

---

## 1) Intended Project Map / 目标结构（设计态）

### 1.1 Repo Tree / 仓库树（目标）

```txt
.
├─ docs/
│  ├─ MVP_SPEC.md
│  ├─ PROJECT_MAP.md                # (this file) intended vs current
│  ├─ OAUTH_BRIDGE.md               # OAuth bridge: endpoints + flows + token rules
│  ├─ API_SURFACE.md                # Actions surface: Items/Share API contract
│  ├─ DATA_MODEL.md                 # Minimal tables + RLS policies
│  ├─ URL_NORMALIZE.md              # LLM-first normalize + prompt versioning rules
│  ├─ SHARE_PAGE.md                 # /s/{token} noindex / unlisted rules
│  ├─ DEPLOYMENT.md                 # domains, headers, env, secrets
│  └─ SECURITY.md                   # threat model + MVP guardrails
│
├─ src/
│  ├─ app/                          # Next.js routes (UI + API routes)
│  ├─ server/                       # server-only business logic (no React import)
│  └─ components/                   # reusable UI components (drag reorder, list, etc.)
│
├─ actions/
│  ├─ openapi.yaml                  # GPT Actions contract
│  └─ README.md
│
├─ prompts/
│  ├─ README.md
│  └─ url_normalize/
│     ├─ README.md
│     ├─ v1.md                      # prompt text (treat as code)
│     └─ CHANGELOG.md
│
├─ supabase/
│  ├─ README.md
│  └─ migrations/
│     ├─ 001_init.sql               # items / shares / oauth_codes / oauth_tokens(optional)
│     └─ 002_rls.sql                # RLS policies
│
├─ scripts/
│  ├─ README.md
│  └─ smoke_oauth.ts                # OAuth e2e smoke test (optional)
│
├─ middleware.ts                    # host split + security headers + noindex
├─ next.config.js                   # headers/rewrites
├─ .env.example
└─ README.md
```

### 1.2 Boundary Rules / 边界规则（必须遵守）

**Server-only boundary (`src/server/*`)**
- Must not be imported from Client Components.
- Holds: auth session parsing, OAuth code/token issuance, DB calls (admin), normalize, OG fetch, rate limit, audit.

**API route handlers (`src/app/api/**/route.ts`)**
- Thin layer only: parse input → call `src/server/*` → return JSON.
- No business logic duplication.

**Prompts (`prompts/**`)**
- Prompt files are **versioned** and treated like code.
- Every normalize result should record `prompt_version` in logs.

**Supabase (`supabase/**`)**
- Schema + RLS are security-critical; changes must be migration-based.

---

## 2) Current Project Map / 当前结构（现实态）

### 2.1 Repo Tree / 仓库树（当前）

```txt
.
├─ docs/
│  └─ MVP_SPEC.md
└─ .gitignore
```

### 2.2 Gaps / 与目标差距（要补齐的结构件）

- [ ] `docs/PROJECT_MAP.md` (this file) committed into repo
- [ ] OAuth bridge docs + API surface docs
- [ ] Create `src/` skeleton (app/server/components)
- [ ] Create `supabase/` migrations
- [ ] Create `actions/openapi.yaml`
- [ ] Create `prompts/url_normalize/v1.md` + changelog

---

## 3) How to Maintain This Doc / 如何维护

### 3.1 When you implement something…
Update **Current Map**:
- Add the new paths and describe *what exists now* (no assumptions).
- Add “Evidence” links (path references) once code exists.

### 3.2 Keep Intended Map stable
- Intended Map changes only when product scope/architecture decisions change.
- If scope changes, update `docs/MVP_SPEC.md` first, then update Intended Map.

---

## 4) MVP Implementation Order (suggested) / MVP落地顺序（建议）

1. OAuth bridge + Supabase Auth providers (Google/Apple)
2. Items API (POST/GET/PATCH/DELETE) with dedupe + fractional ranks
3. Share API + /s/{token} noindex page
4. URL normalize prompt versioning + OG fetch + audit logs
