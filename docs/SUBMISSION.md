# WishlistGPT — ChatGPT App 上架清单 / Submission Checklist

> 提交入口:platform.openai.com → **ChatGPT Apps** → WishlistGPT → App Info。
> 相关:demo 录制见 [DEMO_SCRIPT.md](./DEMO_SCRIPT.md)。

---

## 0. 组织与验证(先定这个)
- **用 justog 的 Organization** 统一管(你是 UBO),走 **Business 验证**(公司法定名 + 地址 + 关联证明;实体政府证件,不收电子证件)。
- **Developer 字段 = 已验证的公司名**(逐字一致,否则被拒)。
- 手机号认证:是**每个 org 首个 API key** 时一次性短信认证;一个号能认证的 org 数**有上限**、用过的号不能再开新账号。
  - 若 justog 是**新 org** → 首个 API key 补一次手机认证(注意号上限)。
  - 若能把现有 org 改成公司账(改名 + 绑公司账单 + Business 验证)最省事,手机认证不用重来。
- 提交权限:需要该 org 的 **Owner / `api.apps.write`**。

---

## 1. 表单字段(可直接粘)

| 字段 | 值 |
|---|---|
| **Logo Icon** | `public/app-icon-openai.png`(1024²,满版方形,无边框/圆角) |
| **App Name** | `WishlistGPT` |
| **Subtitle**(≤30) | `Save & share a wishlist` |
| **Category** | `Shopping`(无则 `Lifestyle`) |
| **Developer** | 已验证的公司名(= Business 验证名) |
| **Website URL** | `https://wishlistgpt.com` |
| **Customer Support** | `support@wishlistgpt.com` |
| **Privacy Policy** | `https://wishlistgpt.com/privacy` |
| **Terms** | `https://wishlistgpt.com/terms` |
| **MCP Server** | `https://wishlistgpt.com/api/mcp` |

**Description:**
> WishlistGPT turns the products you come across in ChatGPT into a wishlist you can keep. As ChatGPT recommends items — or when you paste a product link — save the ones you like, and the title, image, and price come along. Open your list on the web to add notes, then share a public link so friends know exactly what you want.

---

## 2. Test prompts + 期望响应
> 审核用这些提示词验证工具真在跑。四个工具都覆盖到。

**1) Save from a recommendation** — `add_to_wishlist`
- Prompt: `I'm looking for a minimalist gift under $150 — suggest a few and save your top two to my wishlist.`
- Expected: 助手推荐几件商品,调用 `add_to_wishlist` 存入 2 件;内嵌 **widget** 渲染出这两件(封面/标题/价格);文字确认「Saved 2 items to your wishlist.」

**2) Save from a pasted link** — `add_to_wishlist`
- Prompt: `Save this to my wishlist: https://www.nike.com/t/air-force-1-shadow`
- Expected: 调用 `add_to_wishlist`;widget 新增该商品(标题/图片/价格由助手随写入提供);确认已保存。

**3) View the list** — `list_wishlist`
- Prompt: `Show my wishlist.`
- Expected: 调用 `list_wishlist`;widget 以网格展示全部已保存商品;文字「You have N items on your wishlist.」

**4) Create a share link** — `share_wishlist`
- Prompt: `Share my wishlist.`
- Expected: 调用 `share_wishlist`;返回公开链接 `https://wishlistgpt.com/s/<id>`;widget 的分享卡出现,可 Copy;打开链接是只读分享页。

**5) Send feedback** — `send_feedback`
- Prompt: `Send feedback to WishlistGPT: love it, super handy.`
- Expected: 调用 `send_feedback`;确认「Thanks — received.」(限流 1/min)。

---

## 3. 给审核员的 Demo 账号
- 提供一个**免 MFA、无需新注册**、可直接登录的 demo 账号凭据。
- 该账号已通过 Developer Mode 连接器 `https://wishlistgpt.com/api/mcp`。
- 里面预置 1–2 条示例商品即可(别太空也别太乱)。

---

## 4. Demo 视频
- 用 **Developer Mode**,覆盖**全部主要用例 + 4 工具**,across web / iOS / Android。
- 逐镜脚本见 [DEMO_SCRIPT.md](./DEMO_SCRIPT.md);录完各段用 ffmpeg 归一化 + 拼接为 `demo.mp4`。

---

## 5. 状态一览
- [x] 域名 / BASE_URL / 连接器 / 支持邮箱(wishlistgpt.com)
- [x] Privacy / Terms / metadata / OG(已上线)
- [x] App 图标(满版方形)
- [x] 表单文案 + test prompts(本文件)
- [x] Demo 剧本(DEMO_SCRIPT.md)
- [ ] **Business 实名验证(justog org)**
- [ ] **Demo 账号(免 MFA)+ 录制 demo.mp4**
- [ ] 截图(widget 实拍)
- [ ] 提交 → 收到 Case ID → 等审核邮件

---

## 6. 常见被拒点(自查)
- 审核连不上 MCP / demo 账号需要额外步骤(新注册、2FA)→ **给可直接登录的 demo 账号**。
- app 未完成 / 标注 trial / 缺核心功能 → 核心(存/看/分享)已完整;别让 "Buy/Gift with AI" 的 waitlist 读起来像坏掉的核心功能。
- 过度索取数据 → 工具只收必要字段(商品信息由调用方 Agent 写入)。
- Developer 名与验证名义不一致 → 逐字对齐公司名。
