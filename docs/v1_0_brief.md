# WishlistGPT v1.0 — Data Quality Upgrade (Non‑normative brief)

> This document is a practical “what to build” brief for v1.0.  
> **Source of truth remains**: `docs/MVP_SPEC.md` (normative contract).

---

## What v1.0 solves

1) **Canonical URL becomes usable and stable**
- Keep `url_original` immutable (idempotency unchanged).
- Derive `canonical_url` (fill-only) and strip tracking noise.
- Support deeplinks (non-http/https) while keeping network enrichment safe.

2) **Enrichment becomes self-healing**
- Scheduled cron reruns the existing enrichment pipeline.
- Each item retries **up to 3 times** (claim + attempt tracking).
- Only http/https `canonical_url` participates in fetch/enrich.

3) **Ops backfill for hard cases**
- A minimal allowlisted `/ops` page surfaces items that still miss title/image after retries.
- Ops edits update `display_*` fields and leave a small audit event.

4) **System health replaces “table stats”**
- Focuses on quality signals: missing canonical_url, missing display_* fields, healthy ratio.
- Broadcast **6x/day**.

---

## Source URL cleaning rules (practical)

### Scope
- Applies to **all schemes** (http/https + deeplink): remove tracking query params where present.

### Fragment
- http/https: drop `#...`
- non-http(s): keep fragment (safer for app routing)
- `intent://`: keep fragment (explicit)

### Tracking param config (default)
- prefixes: `utm_`, `mkt_`, `ga_`, `icid`
- exact: `gclid`, `dclid`, `wbraid`, `gbraid`, `gclsrc`, `gad_source`, `srsltid`, `fbclid`, `msclkid`, `ttclid`, `twclid`, `li_fat_id`, `scclid`, `epik`, `tblci`, `ob_click_id`, `obclickid`, `yclid`, `igshid`, `mc_cid`, `mc_eid`
- keep: `[]`
- maxParams: `64` (tail params beyond cap are dropped deterministically)

> Important: affiliate/ref/coupon params are **not** removed.

---

## Scheduled jobs (Vercel Cron)

Target: **6 runs/day** (every 4 hours), UTC-based schedules.

Example `vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/enrich", "schedule": "0 0,4,8,12,16,20 * * *" },
    { "path": "/api/cron/system-health", "schedule": "5 0,4,8,12,16,20 * * *" }
  ]
}
```

Auth: `Authorization: Bearer ${CRON_SECRET}`.

---

## Deeplink convenience behavior

If `canonical_url` scheme is not http/https:
- Do not run enrichment.
- If missing display title or cover image, set:
  - `enrich_attempts = 3`
  - `enrich_last_attempt_at = now()`
So it appears in Ops queue immediately.

---

## Ops queue (minimal)

- Access gate: cookie session + `OPS_EMAIL_ALLOWLIST`
- Data access: server uses `SUPABASE_SERVICE_ROLE_KEY` (bypass RLS)
- Row UI: canonical_url + missing icons (title/image) + Edit
- Edit modal updates:
  - `display_product_title`
  - `display_cover_image_url`
  - (optional) `display_price_text`
- Audit: write event `web.ops.item_edit` with `{ item_id, fields: [...] }` (no PII, no raw values)

---

## System health metrics (broadcast)

- Total items
- Items created today
- Missing canonical_url (system issue)
- Missing display_product_title
- Missing display_cover_image_url
- Missing display_price_text
- Healthy ratio (title+image+price present)

---

## Quick validation checklist

- Add an item with heavy UTM/click IDs → `canonical_url` is stripped; `url_original` preserved.
- Add a deeplink with utm params → utm stripped; fragment preserved; attempts set to 3 if missing title/image.
- Enrich cron run → increments attempts; uses source_url; doesn’t reorder items.
- Ops edits → visible immediately; event `web.ops.item_edit` written.
- System health message → shows correct counts; runs 6x/day.
