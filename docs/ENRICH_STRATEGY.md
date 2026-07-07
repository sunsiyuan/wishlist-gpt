# ENRICH_STRATEGY.md

> ⚠️ **DEPRECATED (Apps SDK / MCP migration).** 服务端商品富化（enrichment）与标注台（`/ops`）已移除。
> 现在商品的标题/图片/价格/商家由调用方 Agent（ChatGPT）在 `add_to_wishlist` 时提供，服务端只做
> URL canonical 化与字段落库（见 `src/server/items/addItem.ts`）。本文件仅作历史参考。
>
> **DEPRECATED.** Server-side enrichment and the `/ops` annotation console were removed. Product
> title/image/price/merchant are now supplied by the calling agent (ChatGPT) via `add_to_wishlist`.
> Kept for historical reference only.

> **Scope / Why this doc exists**
>
> ChatGPT is increasingly recommending products from a small set of commerce ecosystems (in order): **Etsy → Shopify → Walmart → Target**.
> Wishlist items will therefore be heavily skewed to these sources (including merchants hosted on these platforms).
>
> **Goal:** make wishlist display reliable (especially **title + cover image**) for these high-frequency ecosystems, with safe/fast best-effort enrichment and a clear path to iterate per-platform without destabilizing the system.

---

## 0) Pointers (code & data)

### Entry points
- Sync trigger: `src/app/api/items/route.ts` (POST) → `enrichItemBestEffort()` via Next.js `after()`
- Cron trigger: `src/app/api/cron/enrich/route.ts` (GET) → Vercel Cron daily

### Core implementation (enrich)
- Enrich runner / strategy logic: (current impl location; update if moved) `src/server/items/enrich.ts` *(or equivalent module containing `enrichItem`, `isProbablyShopifyProductUrl`, HTML parsing, etc.)*

### Tables
- `items`
- `item_enrich_runs`

---

## 1) Success criteria (what “good” means)

**Primary (must):**
- High success rate for **display title** + **cover image** on partner-heavy commerce URLs.

**Secondary (nice-to-have / best-effort):**
- Price fields, merchant logo, merchant domain.

**Operational constraints (must):**
- Non-blocking for core flows
- Safe against SSRF
- Bounded latency / bandwidth
- Observable and debuggable per attempt

**Recommended metrics (by platform & by strategy):**
- `title_hit_rate`, `image_hit_rate`
- `p50_latency_ms`, `p95_latency_ms`
- `blocked_rate` (403/429/503 + keyword-based)
- `retry_success_distribution` (attempt=1/2/3 success share)

> Note: metrics collection can be derived from `item_enrich_runs` without changing the core schema (platform can be inferred from URL domain).

---

## 2) Definitions (URLs & fields)

### URL fields
- `url_original`: user-provided/raw URL (may include tracking params, shorteners, redirects).
- `canonical_url`: the URL used for enrichment fetches. In cron it may be backfilled from `url_original`.
- *(Future optional)* `source_url`: a stable, normalized URL key for dedupe & enrich routing (not required by current impl; document here to avoid term confusion).

**Current rule:** enrichment runs only when `canonical_url` exists and is **http/https**.

### Display fields enriched (current)
- `display_product_title` (<= 300 chars)
- `display_cover_image_url` (<= 2048 chars)
- `display_merchant_domain`
- `display_merchant_logo_url`
- `display_price_amount_minor` (int, minor units)
- `display_currency` (ISO 4217, 3 letters)
- `display_price_text` (<= 120 chars)
- `display_price_updated_at` (timestamp)

---

## 3) Invariants (non-negotiable)

1) **Best-effort / non-blocking**
- Enrichment must never block `POST /items` success response.

2) **Fill-only by default**
- Do not overwrite existing non-null `display_*` values, except explicitly allowed upgrades (see §7).

3) **Safety first**
- Only fetch http/https URLs
- Block private IP / localhost targets
- Enforce redirect limit, timeout, response-size cap

4) **Observable attempts**
- Each attempt must be recorded to `item_enrich_runs` with enough info to debug.

---

## 4) Platform routing model (decoupling point)

Enrich strategy is organized as **platform bundles** + a **generic fallback**.  
Routing is based on URL detection (domain/pattern/redirect result if available).

### Platforms (target ecosystems)
| Platform | Detect (minimum) | Notes |
|---|---|---|
| `shopify` | Shopify product URL pattern (see §6.1) | Implemented (JSON/JS endpoints) |
| `etsy` | `etsy.com` domain (and common listing patterns) | Bundle planned (currently falls back to Generic) |
| `walmart` | `walmart.com` domain | Bundle planned (currently falls back to Generic) |
| `target` | `target.com` domain | Bundle planned (currently falls back to Generic) |
| `generic` | everything else | Implemented (HTML + optional OG.io) |

> **Current implementation reality:** only Shopify is explicitly specialized today; other platforms will be handled by HTML/OG fallback until platform-specific steps are added.

---

## 5) Triggers & scheduling

### 5.1 Sync trigger (create item)
- Location: `src/app/api/items/route.ts` (POST)
- Mechanism: `after()` → `enrichItemBestEffort()` after response returns
- Eligibility:
  - `canonical_url` exists
  - `canonical_url` scheme is http/https
- Behavior:
  - best-effort; errors do not affect API response

### 5.2 Cron trigger (retry/backfill)
- Location: `src/app/api/cron/enrich/route.ts` (GET)
- Schedule: daily (Vercel Cron)
- Batch size: 50
- Concurrency: 5
- Max attempts: `< 3`

Eligibility (effective conditions):
- `deleted_at IS NULL`
- `canonical_url IS NOT NULL` and non-empty
- `canonical_url` is http/https
- `enrich_attempts < 3`
- Missing ANY of:
  - `display_product_title`
  - `display_cover_image_url`
  - `display_price_text`

Cron flow:
1) Backfill missing `canonical_url` from `url_original`
2) Query eligible items
3) Claim items with optimistic lock:
   - increment `enrich_attempts`
   - set `enrich_last_attempt_at = now()`
4) Run enrichment concurrently (max 5)

---

## 6) Strategy bundles (what we do per platform)

### 6.1 Shopify bundle (implemented)

**Detect**
- Function: `isProbablyShopifyProductUrl()`
- Patterns:
  - `/{locale}/products/{handle}`
  - `/products/{handle}`

**Step A — Shopify Product JSON (priority)**
- Endpoint:
  - `{origin}/{locale}/products/{handle}.json`
  - `{origin}/products/{handle}.json`
- Timeout: `FETCH_TIMEOUT_MS` (default 4000ms)
- Extract:
  - `display_product_title` ← `product.title`
  - `display_cover_image_url` ← `product.images[0]`
  - `display_price_amount_minor` ← `product.variants[0].price`
  - `display_currency` ← `product.variants[0].price_currency`
  - `display_merchant_domain` ← from URL host

**Step B — Shopify Product JS (fallback)**
- Endpoint:
  - `{origin}/{locale}/products/{handle}.js`
  - `{origin}/products/{handle}.js`
- Parsing:
  - tolerate content-types (`application/json`, `text/javascript`, etc.)
  - defensive JSON parsing even if content-type is unexpected
- Extract: same as JSON step

**Step C — Generic HTML step (always attempted)**
- See §6.5 / §7

**Step D — OpenGraph.io (last resort, optional)**
- See §6.6

---

### 6.2 Etsy bundle (planned; currently uses Generic)
**Detect**
- Domain match: `etsy.com` (listing URLs & app redirects)
**Planned steps**
- Etsy-specific extraction (TBD) → HTML → OpenGraph.io(optional)
**Current behavior**
- Uses Generic bundle (HTML + OG.io if configured)

---

### 6.3 Walmart bundle (planned; currently uses Generic)
**Detect**
- Domain match: `walmart.com`
**Planned steps**
- Walmart-specific extraction (TBD) → HTML → OpenGraph.io(optional)
**Current behavior**
- Uses Generic bundle

---

### 6.4 Target bundle (planned; currently uses Generic)
**Detect**
- Domain match: `target.com`
**Planned steps**
- Target-specific extraction (TBD) → HTML → OpenGraph.io(optional)
**Current behavior**
- Uses Generic bundle

---

### 6.5 Generic bundle (implemented)

**Step A — HTML fetch + parse**
- Fetch: original `canonical_url`
- Timeout: `FETCH_TIMEOUT_MS` (default 4000ms)
- Redirect limit: `REDIRECT_LIMIT` (default 3)
- Retry: on 429/503, honor `Retry-After` header (delay then retry)

**Parse sources**
1) Meta tags:
   - OpenGraph `og:*`
   - Twitter `twitter:*`
   - standard meta
2) JSON-LD:
   - `<script type="application/ld+json">` find Product schema
3) Icon links:
   - `<link rel="icon">`, `<link rel="apple-touch-icon">`

**Field priority rules**
- Title:
  - `og:title` > `twitter:title` > JSON-LD `name` > `<title>`
- Image:
  - `og:image:secure_url` > `og:image` > `twitter:image` > JSON-LD `image`
- Price:
  - JSON-LD `offers.price` + `offers.priceCurrency`
- Logo:
  - prefer `apple-touch-icon`, then other icons; prefer https; sort by declared size desc

---

### 6.6 OpenGraph.io bundle (implemented, optional last resort)

**Enabled only if**
- `OPENGRAPH_IO_APP_ID` is set
- AND both (Shopify steps if applicable) + HTML step failed to fetch or extracted nothing useful

**API**
- `https://opengraph.io/api/1.1/site/{url}?app_id={APP_ID}&auto_proxy=true`

**Timeout**
- `OPENGRAPH_IO_TIMEOUT_MS` (default 2000ms)

**Extract**
- Title: `hybridGraph.title` or `openGraph.title`
- Image: `hybridGraph.imageSecureUrl` or `openGraph.image`
- Logo: `hybridGraph.favicon` (https only)

---

## 7) Update policy (fill-only + allowed upgrades)

### 7.1 Fill-only default
- Only write fields that are currently null / missing.
- Do not overwrite existing non-null values.

Implementation: `buildFillOnlyUpdates()` (or equivalent helper)

### 7.2 Allowed special upgrades
1) **Merchant logo upgrade**
- If current `display_merchant_logo_url` is a fallback favicon AND a better https logo is found → allow overwrite (upgrade only).

2) **Price timestamp coupling**
- If any of these are written/updated:
  - `display_price_amount_minor`, `display_currency`, `display_price_text`
- Then also set/update:
  - `display_price_updated_at`

### 7.3 Deterministic backfills (no-network)
- `display_merchant_domain`:
  - derive from URL host; normalize: lowercase, strip `www.`
- `display_merchant_logo_url` fallback:
  - if missing, generate via Google Favicon API (deterministic fallback)

### 7.4 Validation & cleanup
- URL validation:
  - length cap, scheme check, hostname check
- Title:
  - trim whitespace, enforce max length
- Price:
  - validate integer minor units, validate currency format
- Domain:
  - lowercase, strip `www.`

---

## 8) Safety & anti-bot handling

### 8.1 SSRF protections
- Allowed schemes: http/https only
- Reject:
  - localhost / `.localhost`
  - private IPv4/IPv6 ranges
- Redirect re-check:
  - apply safety checks to every redirect hop and final URL

### 8.2 Resource bounds
- Timeout:
  - `FETCH_TIMEOUT_MS` default 4000ms
  - `OPENGRAPH_IO_TIMEOUT_MS` default 2000ms
- Response size:
  - `MAX_RESPONSE_BYTES` default 1,000,000 bytes
- Redirect limit:
  - `REDIRECT_LIMIT` default 3

### 8.3 Block detection (skip deep parsing)
Treat as blocked if:
- Status in {403, 429, 503}
- OR body contains (case-insensitive):
  - "captcha"
  - "verify you are human"
  - "access denied"
  - "bot detection"
  - "unusual traffic"
  - "challenge"

On blocked:
- record `blocked=true`, `blocked_reason`, `blocked_keyword`
- skip deep parsing; proceed to next fallback if applicable

### 8.4 Request identity
- Use a browser-like User-Agent
- Do not send user cookies / credentials

---

## 9) Observability (item_enrich_runs)

### 9.1 Table semantics
- `run_group_id`: all attempts in a single enrich run share the same group id
- `strategy`: one of:
  - `shopify_product_json`, `shopify_js`, `html`, `opengraph_io`
- `attempt` (jsonb): attempt record (see below)
- `final_applied`: whether DB updates were applied
- `final_updates`: the exact applied update fields

### 9.2 Attempt record (minimum fields)
- Request:
  - `url`, `headers` (sanitized), `source` (sync|cron)
- Fetch:
  - `status`, `redirects`, `timed_out`, `final_url`, `content_type`, `latency_ms`
- Block:
  - `blocked`, `blocked_reason`, `blocked_keyword`
- Extraction:
  - `details` (parsed fields), `raw` (size-capped)
- Computation:
  - `computed_updates`
- Error:
  - `error.type`, `error.message`

### 9.3 Debug mode
- `ENRICH_DEBUG=1`:
  - verbose console logging for step-by-step tracing

---

## 10) Config reference (must stay in sync)

| Key / Constant | Default | Used for |
|---|---:|---|
| `ENRICH_FETCH_TIMEOUT_MS` / `FETCH_TIMEOUT_MS` | 4000ms | HTML + Shopify fetch timeout |
| `OPENGRAPH_IO_APP_ID` | (unset) | enables OpenGraph.io last resort |
| `OPENGRAPH_IO_TIMEOUT_MS` | 2000ms | OpenGraph.io fetch timeout |
| `ENRICH_DEBUG` | (unset) | verbose logs when `=1` |
| `REDIRECT_LIMIT` | 3 | max redirects for HTML fetch |
| `MAX_RESPONSE_BYTES` | 1,000,000 | response cap for HTML/raw |
| `BATCH_SIZE` (cron) | 50 | cron selection size |
| `CONCURRENCY` (cron) | 5 | cron parallelism |
| `MAX_ENRICH_ATTEMPTS` | 3 | retry ceiling |

---

## 11) Regression checklist (keep it simple)

When changing any platform strategy:
1) Provide a small regression set of representative URLs (3–10) for that platform:
   - **must** cover: title + image extraction
   - **should** cover: redirects, bot-block case, missing OG case
2) Verify:
   - fill-only semantics unchanged
   - SSRF protections unaffected
   - latency within bounds (no unbounded retries)
3) Confirm `item_enrich_runs` contains enough info to diagnose failures.

> Store regression URLs in a separate internal file or test fixture if you don’t want them in public docs.

---

## 12) Roadmap (platform decoupling work)

- Add explicit platform detection & write `platform` into attempt details (derived from URL domain).
- Add platform bundles for:
  - Etsy (listing patterns + structured extraction)
  - Walmart
  - Target
- Consider introducing `source_url` normalization as the stable key for routing/dedupe (keep `canonical_url` for fetch).
