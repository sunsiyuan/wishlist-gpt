# CR PROMPT Template (WishlistGPT)

> Use this template for every change request.  
> Goal: keep **code + docs + intended/current project map** always consistent.

---

## 0) Context / 背景（必填）
- Repo: `WISHLIST-GPT`
- Source of truth (Spec): `docs/MVP_SPEC.md`
- Intended vs Current map: `docs/PROJECT_MAP.md`
- Current milestone: (e.g., OAuth bridge MVP)

**What I want to change (one sentence):**
- CN:
- EN:

---

## 1) Scope / 范围（必填）
### In-scope
- [ ] Feature / Bugfix / Refactor / Docs-only / Infra
- Details:

### Out-of-scope (explicitly NOT doing)
- (List things you will not touch to avoid scope creep)

---

## 2) Acceptance Criteria / 验收标准（必填）
Write concrete, testable outcomes.

Example (OAuth):
- [ ] `GET /oauth/authorize` works end-to-end (login → redirect with code)
- [ ] `POST /oauth/token` exchanges code for access_token (and refresh_token if enabled)
- [ ] Code is one-time + TTL enforced
- [ ] Token maps to Supabase `user.id`
- [ ] Docs updated (see section 6)

---

## 3) Files to Change / 需要修改的文件（必填）
> IMPORTANT: Only modify files listed here.  
> If new files are necessary, add them here first and explain why.

### Add / New
- `path/to/new_file` — purpose

### Modify
- `path/to/file` — why

### No Touch / 不要改
- (List sensitive files/areas to avoid accidental changes)

---

## 4) Implementation Plan / 实现方案（必填）
> Keep this short and deterministic. No “maybe” steps.

1. ...
2. ...
3. ...

### Key decisions / 关键决策
- (e.g., token TTL = 15 min; code TTL = 5 min; allowlist redirect_uri)

### Edge cases / 边界情况
- (e.g., code reuse, expired code, invalid redirect_uri, missing state)

---

## 5) Safety & Constraints / 安全与约束（必填）
- [ ] No business logic inside `route.ts` (route handlers stay thin)
- [ ] Server-only logic must live in `src/server/*`
- [ ] Do not leak secrets; only use env vars
- [ ] Follow existing naming conventions and folder boundaries
- [ ] Do not add new dependencies unless necessary (if yes, explain)

---

## 6) **Docs Update Checklist (MANDATORY)** / **文档更新清单（强制）**
> This section must be completed in every CR.  
> If a doc is “not applicable”, explicitly mark N/A and explain briefly.

### 6.1 Project Map updates (always required)
- [ ] Update `docs/PROJECT_MAP.md` → **Current Project Map** to reflect real repo after this change
  - Add new paths
  - Update descriptions
  - Remove outdated statements
  - (Optional) Add “Evidence” links to real file paths/functions once they exist

### 6.2 Spec & module docs (as needed)
- [ ] If OAuth changes: update `docs/OAUTH_BRIDGE.md`
- [ ] If API endpoints / request/response change: update `docs/API_SURFACE.md` AND `actions/openapi.yaml`
- [ ] If DB schema/RLS changes: update `docs/DATA_MODEL.md` AND add new migration under `supabase/migrations/`
- [ ] If Share page changes: update `docs/SHARE_PAGE.md`
- [ ] If normalize/prompt changes: update `docs/URL_NORMALIZE.md` AND `prompts/url_normalize/CHANGELOG.md` (bump version if needed)
- [ ] If env vars change: update `.env.example` AND `docs/DEPLOYMENT.md`
- [ ] If security posture changes: update `docs/SECURITY.md`

**Docs summary (must write):**
- CN: (what docs were updated and why)
- EN: (same)

---

## 7) Testing & Verification / 测试与验证（必填）
> Provide commands and what to look for.

### Local checks
- [ ] `npm test` / `pnpm test` (if exists)
- [ ] `npm run lint`
- [ ] Minimal manual test steps:
  1) ...
  2) ...

### Smoke scenarios (OAuth example)
- [ ] Happy path
- [ ] Expired code
- [ ] Reused code
- [ ] Invalid redirect_uri
- [ ] Missing/invalid state

---

## 8) Output Requirements for the Assistant / 对助手输出的要求（必填）
When you finish, output:

1) **Changed files list** (added/modified)  
2) **Short diff summary per file** (what changed)  
3) **How to test** (copy-paste commands)  
4) **Docs updated checklist** (confirm section 6 done; list exact doc edits)  
5) No TODOs left unless explicitly marked and justified.

---

## 9) Notes / 备注（可选）
- Anything else that impacts reviewers
