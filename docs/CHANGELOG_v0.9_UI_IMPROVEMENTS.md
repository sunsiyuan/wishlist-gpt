# v0.9 UI Improvements Summary

## 改动概述 / Overview

本次改动主要对齐 Share 页面与 List 页面的 UI，优化用户体验，并修复按钮文本逻辑。

This update primarily aligns the Share page UI with the List page, improves UX, and fixes button text logic.

## 主要改动 / Key Changes

### 1. Share 页面 UI 对齐 / Share Page UI Alignment

#### 1.1 Header 选择器 UI
- **登录后**：显示与 `/app` 对齐的选择器 UI（头像+昵称+下拉箭头）
- **未登录**：显示简单 header（头像+昵称，无下拉）
- 选择器下拉包含：
  - `Me` 部分：用户自己的 profile
  - `Following` 部分：已 follow 的列表（不包含当前 share，除非已 follow）
- Header 右侧：登录后显示 Settings 按钮；已 follow 时显示 "Following ✓" 状态

#### 1.2 移除 read-only 副标题
- 移除了 "This list is read-only." 副标题，简化 UI

#### 1.3 底部悬浮 CTA 按钮
- **未登录**：显示 "Sign In" 按钮（居中，横向，类似落地页 CTA）
- **已登录但未 follow**：显示 "Follow" 按钮（带 UserPlusIcon）
- **已 follow 或 isOwner**：不显示
- 样式：居中固定在底部，横向按钮，适当宽度，包含阴影和 hover 效果

### 2. 按钮文本逻辑修复 / Button Text Logic Fix

#### 2.1 AppClient (`/app`)
- 查看自己的 list：显示 "Buy with AI"
- 查看 followed list：显示 "Gift with AI"
- EarlyAccessModal intent：根据 `isFollowingView` 设置为 "buy" 或 "gift"

#### 2.2 SharePageClient (`/s/:share_id`)
- 查看自己的 share（isOwner=true）：显示 "Buy with AI"
- 查看别人的 share（isOwner=false）：显示 "Gift with AI"
- EarlyAccessModal intent：根据 `isOwner` 设置为 "buy" 或 "gift"

### 3. UI 细节优化 / UI Detail Improvements

#### 3.1 按钮宽度对齐
- 所有页面的按钮容器统一使用 `flex gap-2`（之前 Share 页面使用 `flex gap-0`）
- 确保按钮间距一致

#### 3.2 移除价格问号图标
- 移除了所有价格旁边的问号图标（QuestionMarkCircleIcon）
- 简化 UI，减少视觉噪音
- 涉及页面：
  - `/app` Item Card 和 Item Sheet
  - `/s/:share_id` Item Card 和 Item Sheet

### 4. 技术实现细节 / Technical Implementation

#### 4.1 Share 页面数据传递
- `page.tsx` 新增：
  - `isOwner` 判断（`currentUserId === share.user_id`）
  - `userProfile` 和 `follows` 列表获取
  - `currentListRef` 传递

#### 4.2 SharePageClient 组件
- 新增选择器 UI（复用 AppClient 的逻辑）
- 新增底部悬浮 CTA 按钮
- 根据 `isOwner` 动态显示按钮文本
- 过滤选择器列表（排除当前 share）

#### 4.3 ShareItemSheet 组件
- 接收 `isOwner` 参数
- 根据 `isOwner` 显示正确的按钮文本

## 文件变更 / Files Changed

1. `src/app/s/[share_id]/page.tsx` - 添加 isOwner 判断和数据获取
2. `src/app/s/[share_id]/SharePageClient.tsx` - 添加选择器 UI、底部 CTA、按钮文本逻辑
3. `src/app/s/[share_id]/ShareItemSheet.tsx` - 添加 isOwner 参数和按钮文本逻辑
4. `src/app/app/AppClient.tsx` - 修复按钮文本逻辑，移除价格问号图标

## 文档更新 / Documentation Updates

- 更新 `docs/MVP_SPEC.md`：
  - v0.8_SPEC：添加按钮文本逻辑说明（§5）
  - v0.9_SPEC：更新 Share 页面 UX 契约（§5.4），添加选择器 UI 和底部 CTA 说明
  - v0.3_SPEC：更新价格显示规则，移除问号图标说明

## 验收标准 / Acceptance Criteria

1. ✅ Share 页面登录后显示选择器 UI，与 App 页面对齐
2. ✅ Share 页面未登录显示简单 header
3. ✅ 选择器列表不包含当前 share（除非已 follow）
4. ✅ 底部悬浮 CTA 根据登录状态和 follow 状态正确显示
5. ✅ 按钮文本根据上下文正确显示（Buy with AI vs Gift with AI）
6. ✅ 所有页面按钮宽度对齐（flex gap-2）
7. ✅ 价格问号图标已移除
8. ✅ Share 页面 read-only 副标题已移除
