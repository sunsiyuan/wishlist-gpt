# WishlistGPT

## 简介 / Overview

WishlistGPT 是一个智能愿望清单服务，通过 ChatGPT Actions 让用户能够自然语言对话的方式管理购物清单。用户可以直接在 ChatGPT 中发送产品链接，AI 助手会自动保存到愿望清单，并支持分享、查看和管理。

WishlistGPT is an intelligent wishlist service that enables users to manage shopping lists through natural language conversations with ChatGPT. Users can send product links directly in ChatGPT, and the AI assistant automatically saves them to the wishlist, with support for sharing, viewing, and management.

### 核心功能 / Core Features

- **ChatGPT 集成 / ChatGPT Integration**: 通过 Actions/OpenAPI 与 ChatGPT 无缝集成，支持自然语言交互
- **智能保存 / Smart Saving**: 自动提取产品信息（标题、图片、价格等）并保存到愿望清单
- **分享功能 / Sharing**: 生成公开分享链接，方便与他人分享愿望清单
- **Web 界面 / Web Interface**: 提供完整的 Web 应用，支持查看、编辑、管理愿望清单
- **自动丰富 / Auto Enrichment**: 后台自动抓取和丰富产品信息，提升展示效果

---

## 与 ChatGPT 的交互 / ChatGPT Integration

WishlistGPT 通过 **ChatGPT Actions** 与 ChatGPT 集成。用户可以在 ChatGPT 对话中：

- 发送产品链接，AI 自动保存到愿望清单
- 查看愿望清单内容
- 分享愿望清单给他人
- 使用自然语言管理清单（添加、查看、分享等）

### 配置与策略 / Configuration & Strategy

所有与 ChatGPT 交互的策略和配置都在 `actions/` 目录中：

- **`actions/CONFIG.md`**: ChatGPT GPT 的配置信息（描述、对话启动器等）
- **`actions/GPTS_INSTRUCTIONS.md`**: 详细的 GPT 指令，定义 AI 助手的行为规范、交互流程、错误处理等
- **`actions/openapi.template.yaml`**: OpenAPI 规范模板，定义 API 接口契约

### OpenAPI 生成 / OpenAPI Generation

- **模板**: `actions/openapi.template.yaml`（包含 `__BASE_URL__` 占位符）
- **生成命令**: `npm run gen:openapi`（`npm run build` 的 `prebuild` 也会自动执行）
- **产物**: `public/openapi.yaml`

Base URL 由 `scripts/gen-openapi.mjs` 根据 `BASE_URL` 或 Vercel 环境变量自动推导。

---

## 快速开始 / Quickstart

### 环境变量 / Environment Variables

**必需 / Required:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`（或 `NEXT_PUBLIC_SUPABASE_ANON_KEY`）
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OAUTH_ALLOWED_CLIENTS_JSON`
- `OAUTH_SIGNING_SECRET`

**可选但常用 / Optional but common:**
- `OAUTH_ALLOW_AUTH_HEADER_LOGIN`
- `BASE_URL`
- `OPENGRAPH_IO_APP_ID`（opengraph.io 兜底抓取）
- `CRON_SECRET`（Vercel Cron Jobs 安全密钥）
- `CHATGPT_GPT_URL` 或 `NEXT_PUBLIC_CHATGPT_GPT_URL`（ChatGPT GPT 链接）

> **重要 / Important**: 修改 `.env*` 后，务必**重启终端**并重启 `npm run dev`，避免旧进程导致"改了但没生效"。  
> After changing `.env*`, **restart your terminal** and restart `npm run dev` to avoid stale-process confusion.

### 安装与启动 / Install & Run

```bash
npm install
npm run dev
```

访问 `/login` 进行登录，或访问 `/app` 查看愿望清单界面。

---

## 文档 / Documentation

本项目采用严格的文档规范，只有以下文档是"规范来源"：

- **`README.md`**（本文件）- 项目简介和快速开始
- **`docs/MVP_SPEC.md`** - API 契约和验收标准
- **`docs/PROJECT_MAP.md`** - 代码组织和文件位置索引
- **`docs/CHEATSHEET.md`** - 速查手册和排障指南
- **`docs/SECURITY.md`** - 安全策略和生产默认值
- **`docs/ENRICH_STRATEGY.md`** - 产品信息丰富策略文档

**ChatGPT 相关策略**：
- **`actions/CONFIG.md`** - ChatGPT GPT 配置
- **`actions/GPTS_INSTRUCTIONS.md`** - GPT 指令和行为规范

---

## 技术栈 / Tech Stack

- **框架 / Framework**: Next.js (App Router)
- **数据库 / Database**: Supabase (PostgreSQL)
- **认证 / Auth**: Supabase Auth + OAuth 2.0 (Authorization Code Flow)
- **部署 / Deployment**: Vercel
- **集成 / Integration**: ChatGPT Actions (OpenAPI)

---

## 维护规则 / Maintenance Rules

如果改动了 API 路由、OpenAPI 生成路径、关键环境变量或 ChatGPT 交互策略，必须同步更新：

- `docs/MVP_SPEC.md`（API 契约）
- `docs/CHEATSHEET.md`（使用指南）
- `docs/PROJECT_MAP.md`（文件位置）
- `actions/GPTS_INSTRUCTIONS.md`（GPT 指令，如涉及交互逻辑）

If you change API routes, OpenAPI generation paths, key env vars, or ChatGPT interaction strategies, update:

- `docs/MVP_SPEC.md` (API contract)
- `docs/CHEATSHEET.md` (usage guide)
- `docs/PROJECT_MAP.md` (file locations)
- `actions/GPTS_INSTRUCTIONS.md` (GPT instructions, if interaction logic is involved)
