# URL Normalize (LLM-first) / URL 归一化（MVP 先靠 LLM）

> Spec reference: `docs/MVP_SPEC.md` → “URL Normalize（MVP 先靠 LLM）”.

---

## 1) Why LLM-first / 为什么先用 LLM

**中文**
- MVP 不维护复杂的规则引擎，先用 LLM 统一 URL 到一个“稳定可去重”的形式。
- 未来再把高频站点沉淀成 deterministic rules。

**English**
- MVP uses LLM to normalize URLs into a stable dedupe key, deferring a full deterministic rule engine.

---

## 2) Prompt Versioning / Prompt 版本化

Directory:
- `prompts/url_normalize/v1.md`
- `prompts/url_normalize/CHANGELOG.md`

Rules:
- Every normalize call must record `prompt_version` (e.g., `v1`).
- Any prompt change must update changelog.

---

## 3) Output Contract / 输出契约（建议）

Normalize function returns:
- `normalized_url`
- `confidence` (0..1)
- `notes` (optional)

If confidence is low:
- still store original URL
- dedupe_key falls back to best-effort normalized result
