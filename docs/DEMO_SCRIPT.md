# WishlistGPT — Demo Video 录制剧本 / Recording Script

> 目标:一条视频演示 app **全部主要用例 + 4 个工具**,用 **Developer Mode**,覆盖 web(+尽量 iOS/Android)。
> OpenAI 要求原文:*"Record a video demonstrating your app's functionality using Developer Mode. Include all main use cases and tools across all platforms (web, iOS, Android)."*

四个工具要全部出镜:`add_to_wishlist` · `list_wishlist` · `share_wishlist` · `send_feedback`。

---

## 0. 录制前 checklist
- [ ] chatgpt.com → Settings → **Apps & Connectors → Developer mode** → 已加 `https://wishlistgpt.com/api/mcp` 并授权
- [ ] 登录**给审核员的 demo 账号**(免 MFA);三端都登同一个
- [ ] demo 账号 wishlist 清到**空或 1–2 条**(演示"保存"才有对比)
- [ ] 剪贴板里先复制好**一个真实商品页链接**(演示"粘贴保存")
- [ ] 浏览器窗口整理干净、关无关标签、缩放正常
- [ ] 每句话提前想好,别现场犹豫;全程英文操作(app 是英文界面)

---

## 1. 主 take(web,约 60–75 秒)—— 逐句照做

**镜头 1 · 连接可见(~3s)**
Settings → Apps & Connectors 里露一下 **WishlistGPT 已连接(Developer mode)**,证明是 dev-mode 在跑。

**镜头 2 · 推荐 → 保存(~15s)** — `add_to_wishlist` + widget
输入:
> I'm looking for a minimalist gift under $150 — any ideas?

等它推荐几个真实商品。再输入:
> Save the watch and the camera to my wishlist.

等 **widget 渲染**出这两件(带图/价)。**停 2 秒**让 widget 清晰入镜。

**镜头 3 · 粘贴链接保存(~12s)** — 用例:自己贴链接
输入(把剪贴板链接贴进去):
> Save this one too: <在此粘贴商品链接>

等 widget 更新到 3 件。

**镜头 4 · 查看清单(~8s)** — `list_wishlist`
输入:
> Show my wishlist.

widget 展示完整清单。

**镜头 5 · 分享(~14s)** — `share_wishlist`
点 widget 里的 **Share list** 按钮 → 出现 share-link 卡片 → 点 **Copy**。

**镜头 6 · 分享页(~13s)** — 展示成果
新标签打开刚复制的 `wishlistgpt.com/s/...` → 展示公开分享页(hero + 竖版卡片),轻轻滚动一下。

**镜头 7 · 反馈(可选,~7s)** — `send_feedback`(凑齐 4 工具)
回 ChatGPT 输入:
> Send feedback: love it, super handy.

看到发送成功提示即可。

---

## 2. 其它平台(重复镜头 2–6)
- **iOS**:同一 demo 账号登录 ChatGPT iOS app,重复镜头 2–6(手机端 widget 内嵌渲染;分享页在手机浏览器打开)。**控制中心 → 屏幕录制**。
- **Android**:同上。无真机 → 用 **Android Studio 模拟器**跑 ChatGPT app 录;或(自行决定)只录 web+iOS,提交备注写明「web-first,widget 三端同源渲染、行为一致」。

> 每端约 45–60s,合起来 ~2–3 分钟。

---

## 3. 合成一个 demo.mp4(横屏+竖屏混排)
把各段归一化到 1920×1080 画布(竖屏自动居中留边),再顺序拼接:

```bash
# 每段归一化
for f in web ios android; do
  ffmpeg -i $f.mov -vf "scale=1920:1080:force_original_aspect_ratio=decrease,\
pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30" \
  -c:v libx264 -crf 20 -pix_fmt yuv420p -an ${f}_1080.mp4
done
# 顺序拼接
printf "file 'web_1080.mp4'\nfile 'ios_1080.mp4'\nfile 'android_1080.mp4'\n" > list.txt
ffmpeg -f concat -safe 0 -i list.txt -c copy demo.mp4
```
> 想给竖屏段加模糊背景(替代黑边)或 "Web / iOS / Android" 标题卡,找我要带这些的版本。

---

## 4. Tips
- **真实、连续、无报错**;别出现半成品/waitlist 报错态。
- 每次工具触发后**停 1–2 秒**,让 widget/结果看清(widget 是审核最想看的)。
- 别有找鼠标、犹豫、打错字的死时间;不确定就重录该段。
- 录完把文件路径丢给我,我负责归一化、拼接、压到合适大小,并逐条对照"全平台+全工具"查漏。
