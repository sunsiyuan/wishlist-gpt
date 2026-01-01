# Wishlist GPT App — MVP 规格说明 / MVP Spec

> **目的 / Purpose**：把“要做什么、MVP 包含什么、怎么运作”写清楚，作为后续开发与讨论的唯一 Context。  
> Make the MVP unambiguous: what we build, what we don’t, and how it works.

---

## TL;DR / 速览

### 你要做的 / What we are building
- **一个 GPT Store 自定义 GPT**，用户在 ChatGPT 内完成账号连接后，可把**商品 URL（必填）**保存进**个人唯一的 Wishlist**（后端持久化），并能排序/删除。  
- 用户可生成一个 **unlisted 分享链接**（谁拿到谁能看），用于传播与引流；分享页必须 **noindex**（不被搜索引擎收录）。  
- 展示层面：尽力抓取 **title + cover image**（ACP 优先，否则 OG；缺失可为空）。  
- 登录方式：**先做 Google/Apple**，后续再补 magic link。

A Custom GPT (GPT Store). After connecting an account inside ChatGPT, a user can save **product URLs (required)** into **one personal wishlist** (backend persisted), reorder and delete items, and generate an **unlisted** share link (**noindex**). Display uses **title + cover image** best-effort (ACP > OG > NULL). Login: **Google/Apple first**, magic link later.

### MVP 不做的 / Out of scope (MVP)
- 不做地址管理、不做送礼购买流程、不做 Agent 购买、不做全网分析/比价、不做多清单、不做公开主页、不做分享链接重置。  
No address management, no gifting/purchase flow, no agent purchase, no analysis/price tracking, no multiple wishlists, no public profile, no share reset.

---

## 1) MVP 用户体验（从用户视角）/ MVP UX (User journeys)

### 1.1 连接账号 / Connect account
**中文**
1. 用户在 GPT 中触发“保存”意图（例如“把这个存进我的 wishlist”）。
2. GPT 触发 Actions OAuth 连接流程。
3. 用户在我们的登录页使用 **Google/Apple** 登录。
4. 连接成功后，GPT 能代表用户调用我们的私有 API（读写 wishlist）。

**English**
1. User triggers a save intent in GPT.
2. GPT starts Actions OAuth connect.
3. User signs in via **Google/Apple** on our login page.
4. After connect, GPT can call our private APIs as that user.

### 1.2 保存商品 / Save item (URL required)
**中文**
1. 用户粘贴商品 URL（必填）。
2. GPT 调用 `POST /items`。
3. 后端：ACP 识别 →（非 ACP）URL normalize → OG 抓取 → 去重 upsert → 置顶排序。
4. GPT 返回“已保存”，并展示列表顶部若干条。

**English**
1. User provides a URL (required).
2. GPT calls `POST /items`.
3. Backend: ACP detect → (if non-ACP) normalize URL → fetch OG tags → dedupe upsert → move-to-top.
4. GPT confirms and shows the updated top items.

### 1.3 管理清单 / Manage list
**中文**
- 查看：在 GPT 内用“列出我的 wishlist”。（同时提供最小 Web UI 降低阻力）
- 排序：GPT 指令（“把 A 放到 B 前面”）或 Web 端拖拽排序。
- 删除：在 GPT 内删除条目（对用户是删除；DB 软删除）。

**English**
- View via GPT (and minimal web UI).
- Reorder via GPT commands or drag-and-drop UI.
- Delete in GPT; stored as soft delete in DB.

### 1.4 分享 / Share
**中文**
1. 用户说“分享我的 wishlist”。
2. GPT 调 `POST /share` 返回 share_url。
3. 分享页只读展示，必须 `noindex,nofollow`。

**English**
1. User asks to share.
2. GPT calls `POST /share` to get share_url.
3. Share page is read-only and must be noindex/nofollow.

---

## 2) MVP 产品规则（决定行为的“硬规则”）/ Product rules (Hard rules)

### 2.1 单清单 + URL 必填 / Single wishlist + URL required
- 每用户只有一个 wishlist（隐式）。  
- 每条 item 必须有 URL（不支持“无 URL 愿望”）。

One implicit wishlist per user. Every item must have a URL.

### 2.2 删除策略 / Deletion policy
- 用户只有“删除”操作。  
- 数据库软删除：`deleted_at`。  
- MVP 不存在“隐藏/归档”。

User-facing: delete only. DB: soft delete (`deleted_at`). No hidden/archive.

### 2.3 去重键 / De-duplication key
- `dedupe_key = acp_url`（若 ACP 存在）  
- 否则：`dedupe_key = normalized_url`  
- 若 `dedupe_key` 已存在：更新已有 item（并默认置顶）。

Use ACP URL if available; else normalized URL. Existing key updates the item and moves it to top.

### 2.4 URL Normalize（MVP 先靠 LLM）/ URL normalization (LLM first)
- MVP 不维护硬编码规则；用 LLM prompt 清洗 URL（去 tracking 参数、尽量 canonical）。  
- prompt 视为“代码”：需要版本化、可追溯。  
- 归一化输出必须可复现（同输入尽量同输出）。

No hard-coded rules in MVP; use LLM prompt. Treat prompt as code: version it. Strive for deterministic output.

### 2.5 排序：fractional rank / Ordering: fractional ranks
- rank 越小越靠前。  
- 新增/去重更新默认置顶：`rank = min_rank - 1`（空列表则 0）。  
- 插到两条之间：`rank = (rankA + rankB)/2`。  
- rank 过密时才 reindex（极少）。

Smaller rank is earlier. Insert/top uses min_rank-1. Between uses average. Rare reindex.

### 2.6 展示字段：title + cover image / Display fields: title + cover
- ACP：使用 ACP 的 title/image。  
- 非 ACP：优先 `og:title`/`og:image`；拿不到则 `title` 用 LLM fallback，`image_url` 为空。  
- MVP 不开放用户手动改图。

ACP uses ACP fields; otherwise OG, else fallback title and null image. No manual image override.

### 2.7 分享：unlisted + noindex / Share: unlisted + noindex
- “谁拿到链接谁能看”。  
- 必须禁止索引：
  - HTML `<meta name="robots" content="noindex,nofollow">`
  - Header `X-Robots-Tag: noindex, nofollow`
  - `robots.txt` 禁止 `/s/`

Unlisted link with strict noindex measures.

---

## 3) MVP 交互面（GPT 与 Web）/ Surfaces (GPT & Web)

### 3.1 GPT 侧指令设计 / GPT command patterns
（示例，不是最终文案）
- 保存：`保存这个链接` / `把这个存进wishlist`  
- 列表：`列出我的wishlist`  
- 排序：`把第2个放到第1个前面` / `把X放到Y前面`  
- 删除：`删除第3个`

### 3.2 最小 Web UI（降低阻力）/ Minimal web UI (to reduce friction)
- `/list`（需登录）：列表展示、拖拽排序、删除。  
- `/s/{token}`（无需登录）：只读分享页（noindex）。

`/list` authenticated manage page; `/s/{token}` unlisted share page.

---

## 4) 系统设计（怎么实现）/ System design (How it works)

### 4.1 组件 / Components
- Custom GPT（GPT Store）+ Actions
- Backend API（Next.js）
- Supabase（Postgres + Auth）
- OG Fetcher（简单抓取，无 headless）
- LLM Normalize（可选内部调用）

### 4.2 域名规划 / Domain plan
- `api.example.com`：业务 API + OAuth bridge  
- `app.example.com`：登录与管理 UI（/login, /list）  
- `example.com/s/{token}`：分享页  
同 root domain：`example.com`（满足 Actions OAuth 的域名一致性要求）。

---

## 5) 认证与授权（关键实现）/ Auth & Authorization (Key implementation)

### 5.1 结论 / Key point
- 用户登录由 **Supabase Auth（Google/Apple）**完成。  
- Actions OAuth 需要我们提供 **OAuth bridge**：`/oauth/authorize` + `/oauth/token`。  
- Actions 调业务 API 时带 `Authorization: Bearer <access_token>`。

Users sign in via Supabase Auth. Actions uses our OAuth bridge to obtain tokens and call our APIs.

### 5.2 OAuth bridge 最小要求 / Minimal OAuth bridge requirements
- 校验 `state`（CSRF）。  
- `code` 一次性 + 短 TTL（5 分钟）。  
- `access_token` 短 TTL（15 分钟）。  
- `refresh_token`（建议）长 TTL（30 天）。  
- token → 唯一映射到 Supabase `user.id`。

Validate state; one-time code; access token + refresh token recommended.

---

## 6) 数据模型（最少表）/ Data model (Minimal)

> 目标：足够支撑 MVP，不为未来过度设计。  
> Enough for MVP, no over-design.

### 6.1 `items`
- `id` (uuid, pk)
- `user_id` (indexed)
- `url` (required)
- `dedupe_key` (required)
- `source_type` (`acp` | `url`)
- `title` (required)
- `image_url` (nullable)
- `rank` (numeric/decimal, indexed)
- `created_at`, `updated_at`
- `deleted_at` (nullable)

Constraint:
- 唯一活跃：`(user_id, dedupe_key)` where `deleted_at is null`

### 6.2 `shares`
- `id`, `user_id`, `token` (unique), `created_at`
MVP：无需 revoke/reset。

### 6.3 `oauth_codes`
- `code` (pk), `user_id`, `client_id`, `redirect_uri`, `expires_at`, `used_at`

### 6.4 `oauth_tokens`（可选 / optional）
- `refresh_token_hash`, `user_id`, `client_id`, `expires_at`, `revoked_at`

---

## 7) API（Actions 调用面）/ API (Actions surface)

### OAuth bridge
- `GET /oauth/authorize`
- `POST /oauth/token`

### Items
- `POST /items`（保存/去重更新/置顶）
- `GET /items`（默认只取未删除，按 `rank asc`）
- `PATCH /items/{id}`（更新 rank）
- `DELETE /items/{id}`（软删除）

### Share
- `POST /share` → `{ share_url }`
- `GET /s/{token}` → HTML (read-only, noindex)

---

## 8) 运行与可观测性 / Ops & Observability

- 记录每次写操作（user_id、action、dedupe_key、source_type）。  
- 记录 normalize 输入/输出与 prompt 版本。  
- 记录 OG 抓取成功/失败与耗时。

Log writes, normalization decisions (with prompt version), OG fetch results.

---

## 9) 安全与合规 / Security & Compliance

- MVP 不存地址（降低合规成本）。  
- 分享页严格 noindex。  
- 写接口限流（按用户）。  
- 发布到 GPT Store：准备隐私政策 URL + 域名验证（使用外部 API 时要求）。

No address storage. noindex share pages. Rate limiting. Privacy policy + domain verification for GPT Store.

---

## 10) 后续扩展（不影响 MVP 的前提下）/ Future extensions

- 地址管理（加密存储；仅给 Agent，不给买单者）。  
- 送礼工作流（reserve/purchased、防捣乱、确认）。  
- Agent 自动购买。  
- Magic link 邮箱登录。  
- ACP 更完整字段、分析、通知。  
- 分享链接 revoke/reset。  
- 公共主页/SEO（如有需要）。

---

## 11) MVP 发布检查清单 / MVP ship checklist

- [ ] Actions OAuth 端到端：桌面 + 移动端 ChatGPT 测通  
- [ ] Google 登录 OK；Apple 登录 OK  
- [ ] 保存 URL：ACP/OG/LLM 兜底 title 生效  
- [ ] 去重：同 dedupe_key 只更新不新增  
- [ ] 排序：fractional rank 可拖拽/可指令  
- [ ] 删除：软删除  
- [ ] 分享页：unlisted 可访问 + noindex 生效  
- [ ] GPT Store 提交材料：隐私政策 URL + 域名验证完成

