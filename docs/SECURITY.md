# Security / 安全（MVP Guardrails）

This doc lists the minimum guardrails required for an MVP that:
- stores user wishlists
- exposes share links
- supports OAuth tokens for GPT Actions

---

## 1) Threat Model / 威胁模型（简版）

- Token leakage → unauthorized access to items API
- Share token guessing → privacy leak
- OAuth redirect manipulation → account takeover
- Prompt injection via OG metadata / URL content (LLM normalize)

---

## 2) MVP Guardrails / MVP 护栏

- OAuth:
  - strict state validation
  - redirect_uri allowlist
  - one-time code + TTL
  - short access token TTL
- Supabase header-login bypass:
  - gated by `OAUTH_ALLOW_AUTH_HEADER_LOGIN`
  - **dev/preview only**, default off in production
  - never applies to OAuth access-token bearer auth
- Share:
  - high entropy token
  - noindex enforced at header + meta + robots.txt
- DB:
  - RLS for items
  - server-only service role key
- Normalize:
  - do not follow arbitrary redirects blindly
  - sanitize inputs/outputs logged
