# WishlistGPT

## 简介 / Overview

WishlistGPT 是一个智能愿望清单服务，作为一个 **ChatGPT App**（基于 OpenAI Apps SDK / MCP）运行。用户可以在 ChatGPT 里直接发送产品链接，助手会把商品保存到愿望清单，并在对话中用一个**内嵌交互组件（widget）**展示清单，支持一键分享。

WishlistGPT is an intelligent wishlist service that runs as a **ChatGPT App** built on the OpenAI **Apps SDK (MCP)**. Users share product links inside ChatGPT; the assistant saves them to a wishlist and renders an **interactive inline widget** of the list, with one-click sharing.

> **架构变更 / Architecture change**: 本项目已从旧的 **ChatGPT Actions（OpenAPI）** 生态迁移到 **Apps SDK（MCP server + widget + OAuth 2.1）**。Actions 相关的 `actions/`、OpenAPI 生成、根级 `/items` `/me` `/shares` `/feedback` 路由均已移除。
>
> Migrated from the legacy **ChatGPT Actions (OpenAPI)** ecosystem to the **Apps SDK (MCP server + widget + OAuth 2.1)**. The Actions surface (`actions/`, OpenAPI generation, root `/items` `/me` `/shares` `/feedback` routes) has been removed.

### 核心功能 / Core Features

- **ChatGPT App 集成**: 通过 MCP server 暴露工具（tools），ChatGPT 用自然语言调用
- **模型侧解析 / Agent-provided data**: 商品的标题、图片、价格、商家由**调用方 Agent（ChatGPT）在写入时提供**，服务端不再做抓取/富化（enrichment）
- **内嵌 Widget**: 在 ChatGPT 对话内直接渲染愿望清单网格，含分享按钮
- **分享功能**: 生成公开分享链接（`/s/<id>`）
- **Web 界面**: 完整的 Web 应用，用于查看、编辑、管理愿望清单

---

## 与 ChatGPT 的集成 / ChatGPT Integration

WishlistGPT 通过 **MCP（Model Context Protocol）** 与 ChatGPT 集成。MCP endpoint：

```
POST <BASE_URL>/api/mcp        # Streamable HTTP (JSON-RPC 2.0)
```

### 工具 / Tools

| Tool | 说明 |
|------|------|
| `list_wishlist` | 列出用户已保存的商品（附带 widget） |
| `add_to_wishlist` | 保存一个或多个商品。Agent 传入 `url` 以及能确定的 `title` / `image_url` / `price_text` / `price_amount_minor` / `currency` / `merchant_domain`（不确定则省略，不要编造） |
| `share_wishlist` | 创建/复用公开分享链接 |
| `send_feedback` | 提交反馈 |

### Widget

内嵌组件是一个自包含的 HTML 文档（`src/server/mcp/widget.ts`），注册为 MCP resource `ui://widget/wishlist.html`（mimetype `text/html+skybridge`）。它从 `window.openai.toolOutput` 读取商品数据渲染，并通过 `window.openai.callTool` 触发分享等操作——无需外部资源加载或 CORS。

### 在 ChatGPT 里连接（开发者模式）/ Connect in ChatGPT (developer mode)

1. 本地起服务并用隧道暴露（如 `ngrok http 3000`）
2. ChatGPT → Settings → Connectors → 开启 developer mode → 添加 `<tunnel>/api/mcp`
3. 首次调用会走 OAuth：ChatGPT 通过 DCR 自注册客户端并引导登录授权

---

## 认证 / Authentication (OAuth 2.1)

MCP server 作为 OAuth 2.1 受保护资源（protected resource），access token 的受众（`aud`）绑定到 MCP resource URL（RFC 8707）。

- **发现 / Discovery**:
  - `GET /.well-known/oauth-protected-resource` (RFC 9728)
  - `GET /.well-known/oauth-authorization-server` (RFC 8414)
- **PKCE**: 授权码流强制 `S256`
- **DCR**: `POST /oauth/register`（RFC 7591），ChatGPT 自注册客户端
- **端点**: `/oauth/authorize`、`/oauth/token`、`/oauth/register`

---

## 快速开始 / Quickstart

### 环境变量 / Environment Variables

见 `.env.example`。必需：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`（或 `_ANON_KEY`）、`SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`OAUTH_ALLOWED_CLIENTS_JSON`、`OAUTH_SIGNING_SECRET`。

> **重要**: 修改 `.env*` 后请重启 `npm run dev`，避免旧进程缓存。

### 数据库 / Database

应用迁移，特别是 MCP 所需的 `014_oauth_mcp.sql`（PKCE 列 + `oauth_clients` DCR 表）。

### 安装与启动 / Install & Run

```bash
npm install
npm run dev
```

访问 `/login` 登录，或 `/app` 查看愿望清单。MCP endpoint 在 `/api/mcp`。

### 冒烟测试 / Smoke tests

```bash
BASE_URL=http://localhost:3000 npm run smoke:mcp     # 发现文档 + /api/mcp 401 挑战
npm run smoke:all                                    # preflight + oauth + mcp
```

用 MCP Inspector 做完整握手：`npx @modelcontextprotocol/inspector` → Streamable HTTP → `http://localhost:3000/api/mcp`。

---

## OpenAI 电商协议 / Agentic Commerce (note)

OpenAI 的 **Agentic Commerce Protocol (ACP) / Instant Checkout**（与 Stripe 共建）仍在推进，但自 2026 年 3 月起，OpenAI 把 Instant Checkout **收敛到 Apps** 里由零售商 app 完成结算，而非直接在商品结果里下单。对本项目而言，未来若要支持"从愿望清单直接购买"，可通过 Apps SDK 的 `window.openai.requestCheckout()` 接入 ACP。目前不在范围内。

---

## 技术栈 / Tech Stack

- **框架 / Framework**: Next.js (App Router)
- **数据库 / Database**: Supabase (PostgreSQL)
- **认证 / Auth**: Supabase Auth + OAuth 2.1 (Authorization Code + PKCE, DCR)
- **集成 / Integration**: OpenAI Apps SDK / MCP（`mcp-handler` + `@modelcontextprotocol/sdk`）
- **部署 / Deployment**: Vercel (Fluid Compute)

---

## 文档 / Documentation

- **`README.md`**（本文件）- 项目简介和快速开始
- **`docs/MVP_SPEC.md`** - API/工具契约
- **`docs/PROJECT_MAP.md`** - 代码组织和文件位置索引
- **`docs/CHEATSHEET.md`** - 速查手册和排障
- **`docs/SECURITY.md`** - 安全策略

---

## 维护规则 / Maintenance Rules

如果改动了 MCP 工具、OAuth 流程、关键环境变量或 widget，请同步更新：

- `docs/MVP_SPEC.md`（工具/API 契约）
- `docs/CHEATSHEET.md`（使用指南）
- `docs/PROJECT_MAP.md`（文件位置）

If you change MCP tools, the OAuth flow, key env vars, or the widget, update the docs above.
