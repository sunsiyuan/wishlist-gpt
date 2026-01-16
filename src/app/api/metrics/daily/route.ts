import { NextRequest, NextResponse } from "next/server";
import { supabaseAdminFetch } from "../../../../server/supabase/admin";

const TELEGRAM_API_URL = "https://api.telegram.org/bot";

async function sendTelegramMessage(text: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    throw new Error("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required");
  }

  const url = `${TELEGRAM_API_URL}${botToken}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${response.status} ${error}`);
  }
}

async function queryEventsMetrics(): Promise<{
  newUsers: number;
  newUsersGoogle: number;
  newUsersEmail: number;
  dau: number;
  onboardingComplete: number;
  itemCreates: number;
  itemDeletes: number;
  itemNoteUpdates: number;
  itemViewDetails: number;
  shareCreates: number;
  sharePageViews: number;
  shareActions: { total: number; copy: number; native: number };
  aiWaitlistJoins: { total: number; byIntent: { buy: number; gift: number }; bySurface: { card: number; sheet: number } };
  followCreates: number;
  followDeletes: number;
}> {
  const today = new Date().toISOString().split("T")[0];
  const todayStart = `${today}T00:00:00Z`;

  // 新用户数（总数）
  const newUsersRes = await supabaseAdminFetch(
    `/rest/v1/events?event_name=eq.web.auth.login_success&occurred_at=gte.${todayStart}&meta->>is_new_user=eq.true&select=id`,
    { method: "GET" },
  );
  const newUsers = newUsersRes.ok ? (await newUsersRes.json()).length : 0;

  // Google 新用户数
  const newUsersGoogleRes = await supabaseAdminFetch(
    `/rest/v1/events?event_name=eq.web.auth.login_success&occurred_at=gte.${todayStart}&meta->>is_new_user=eq.true&meta->>auth_method=eq.google&select=id`,
    { method: "GET" },
  );
  const newUsersGoogle = newUsersGoogleRes.ok ? (await newUsersGoogleRes.json()).length : 0;

  // Email 新用户数
  const newUsersEmailRes = await supabaseAdminFetch(
    `/rest/v1/events?event_name=eq.web.auth.login_success&occurred_at=gte.${todayStart}&meta->>is_new_user=eq.true&meta->>auth_method=eq.email_otp&select=id`,
    { method: "GET" },
  );
  const newUsersEmail = newUsersEmailRes.ok ? (await newUsersEmailRes.json()).length : 0;

  // DAU
  const dauRes = await supabaseAdminFetch(
    `/rest/v1/events?occurred_at=gte.${todayStart}&user_id=not.is.null&select=user_id`,
    { method: "GET" },
  );
  const dauData = dauRes.ok ? await dauRes.json() : [];
  const dau = new Set(dauData.map((e: { user_id: string }) => e.user_id)).size;

  // 完成 onboarding (v0.9: profile onboarding)
  const onboardingRes = await supabaseAdminFetch(
    `/rest/v1/events?event_name=eq.web.profile.onboarding_complete&occurred_at=gte.${todayStart}&select=id`,
    { method: "GET" },
  );
  const onboardingComplete = onboardingRes.ok
    ? (await onboardingRes.json()).length
    : 0;

  // Item 创建数
  const itemCreatesRes = await supabaseAdminFetch(
    `/rest/v1/events?event_name=eq.actions.item.create&occurred_at=gte.${todayStart}&select=id`,
    { method: "GET" },
  );
  const itemCreates = itemCreatesRes.ok ? (await itemCreatesRes.json()).length : 0;

  // Item 删除数
  const itemDeletesRes = await supabaseAdminFetch(
    `/rest/v1/events?event_name=eq.web.item.delete&occurred_at=gte.${todayStart}&select=id`,
    { method: "GET" },
  );
  const itemDeletes = itemDeletesRes.ok ? (await itemDeletesRes.json()).length : 0;

  // Item Note 更新数
  const itemNoteUpdatesRes = await supabaseAdminFetch(
    `/rest/v1/events?event_name=eq.web.item.note_update&occurred_at=gte.${todayStart}&select=id`,
    { method: "GET" },
  );
  const itemNoteUpdates = itemNoteUpdatesRes.ok
    ? (await itemNoteUpdatesRes.json()).length
    : 0;

  // Item 详情查看数
  const itemViewDetailsRes = await supabaseAdminFetch(
    `/rest/v1/events?event_name=eq.web.item.view_detail&occurred_at=gte.${todayStart}&select=id`,
    { method: "GET" },
  );
  const itemViewDetails = itemViewDetailsRes.ok
    ? (await itemViewDetailsRes.json()).length
    : 0;

  // Share 创建数
  const shareCreatesRes = await supabaseAdminFetch(
    `/rest/v1/events?event_name=eq.web.share.create&occurred_at=gte.${todayStart}&select=id`,
    { method: "GET" },
  );
  const shareCreates = shareCreatesRes.ok ? (await shareCreatesRes.json()).length : 0;

  // Share 页面查看数
  const sharePageViewsRes = await supabaseAdminFetch(
    `/rest/v1/events?event_name=eq.web.share.page_view&occurred_at=gte.${todayStart}&select=id`,
    { method: "GET" },
  );
  const sharePageViews = sharePageViewsRes.ok
    ? (await sharePageViewsRes.json()).length
    : 0;

  // Share 操作数（复制/原生）
  const shareActionsRes = await supabaseAdminFetch(
    `/rest/v1/events?event_name=eq.web.share.share_action&occurred_at=gte.${todayStart}&select=meta`,
    { method: "GET" },
  );
  const shareActionsData = shareActionsRes.ok ? await shareActionsRes.json() : [];
  const shareActions = {
    total: shareActionsData.length,
    copy: shareActionsData.filter((e: { meta: { action_type?: string } }) => e.meta?.action_type === "copy").length,
    native: shareActionsData.filter((e: { meta: { action_type?: string } }) => e.meta?.action_type === "native").length,
  };

  // AI Waitlist Joins
  const aiWaitlistJoinsRes = await supabaseAdminFetch(
    `/rest/v1/events?event_name=eq.web.ai.waitlist_join&occurred_at=gte.${todayStart}&select=meta`,
    { method: "GET" },
  );
  const aiWaitlistJoinsData = aiWaitlistJoinsRes.ok ? await aiWaitlistJoinsRes.json() : [];
  const aiWaitlistJoins = {
    total: aiWaitlistJoinsData.length,
    byIntent: {
      buy: aiWaitlistJoinsData.filter((e: { meta: { intent?: string } }) => e.meta?.intent === "buy").length,
      gift: aiWaitlistJoinsData.filter((e: { meta: { intent?: string } }) => e.meta?.intent === "gift").length,
    },
    bySurface: {
      card: aiWaitlistJoinsData.filter((e: { meta: { surface?: string } }) => e.meta?.surface === "card").length,
      sheet: aiWaitlistJoinsData.filter((e: { meta: { surface?: string } }) => e.meta?.surface === "sheet").length,
    },
  };

  // Follow 创建数 (v0.9)
  const followCreatesRes = await supabaseAdminFetch(
    `/rest/v1/events?event_name=eq.web.follow.create&occurred_at=gte.${todayStart}&select=id`,
    { method: "GET" },
  );
  const followCreates = followCreatesRes.ok ? (await followCreatesRes.json()).length : 0;

  // Follow 取消数 (v0.9)
  const followDeletesRes = await supabaseAdminFetch(
    `/rest/v1/events?event_name=eq.web.follow.delete&occurred_at=gte.${todayStart}&select=id`,
    { method: "GET" },
  );
  const followDeletes = followDeletesRes.ok ? (await followDeletesRes.json()).length : 0;

  return {
    newUsers,
    newUsersGoogle,
    newUsersEmail,
    dau,
    onboardingComplete,
    itemCreates,
    itemDeletes,
    itemNoteUpdates,
    itemViewDetails,
    shareCreates,
    sharePageViews,
    shareActions,
    aiWaitlistJoins,
    followCreates,
    followDeletes,
  };
}

async function querySystemHealthMetrics(): Promise<{
  totalItems: number;
  todayCreated: number;
  missingCanonicalUrl: number;
  missingTitle: number;
  missingImage: number;
  missingPrice: number;
  healthyRatio: number;
}> {
  const today = new Date().toISOString().split("T")[0];
  const todayStart = `${today}T00:00:00Z`;

  // Total items
  const totalItemsRes = await supabaseAdminFetch(
    `/rest/v1/items?deleted_at=is.null&select=id`,
    { method: "GET" },
  );
  const totalItems = totalItemsRes.ok ? (await totalItemsRes.json()).length : 0;

  // Items created today
  const todayCreatedRes = await supabaseAdminFetch(
    `/rest/v1/items?deleted_at=is.null&created_at=gte.${todayStart}&select=id`,
    { method: "GET" },
  );
  const todayCreated = todayCreatedRes.ok ? (await todayCreatedRes.json()).length : 0;

  // Missing canonical_url (system issue)
  const missingCanonicalUrlRes = await supabaseAdminFetch(
    `/rest/v1/items?deleted_at=is.null&or=(canonical_url.is.null,canonical_url.eq.)&select=id`,
    { method: "GET" },
  );
  const missingCanonicalUrl = missingCanonicalUrlRes.ok
    ? (await missingCanonicalUrlRes.json()).length
    : 0;

  // Missing display_product_title
  const missingTitleRes = await supabaseAdminFetch(
    `/rest/v1/items?deleted_at=is.null&or=(display_product_title.is.null,display_product_title.eq.)&select=id`,
    { method: "GET" },
  );
  const missingTitle = missingTitleRes.ok ? (await missingTitleRes.json()).length : 0;

  // Missing display_cover_image_url
  const missingImageRes = await supabaseAdminFetch(
    `/rest/v1/items?deleted_at=is.null&or=(display_cover_image_url.is.null,display_cover_image_url.eq.)&select=id`,
    { method: "GET" },
  );
  const missingImage = missingImageRes.ok ? (await missingImageRes.json()).length : 0;

  // Missing display_price_text
  const missingPriceRes = await supabaseAdminFetch(
    `/rest/v1/items?deleted_at=is.null&or=(display_price_text.is.null,display_price_text.eq.)&select=id`,
    { method: "GET" },
  );
  const missingPrice = missingPriceRes.ok ? (await missingPriceRes.json()).length : 0;

  // Healthy ratio: items with title+image+price all present
  // Note: We need to query all items and filter in application layer
  // (Supabase REST API doesn't support complex AND/OR conditions easily)
  const allItemsRes = await supabaseAdminFetch(
    `/rest/v1/items?deleted_at=is.null&select=display_product_title,display_cover_image_url,display_price_text`,
    { method: "GET" },
  );
  const allItems = allItemsRes.ok ? await allItemsRes.json() : [];
  const healthyItems = allItems.filter(
    (item: {
      display_product_title: string | null;
      display_cover_image_url: string | null;
      display_price_text: string | null;
    }) => {
      const hasTitle = Boolean(item.display_product_title?.trim());
      const hasImage = Boolean(item.display_cover_image_url?.trim());
      const hasPrice = Boolean(item.display_price_text?.trim());
      return hasTitle && hasImage && hasPrice;
    },
  ).length;
  const healthyRatio = totalItems > 0 ? ((healthyItems / totalItems) * 100).toFixed(1) : "0";

  return {
    totalItems,
    todayCreated,
    missingCanonicalUrl,
    missingTitle,
    missingImage,
    missingPrice,
    healthyRatio: parseFloat(healthyRatio),
  };
}

function formatMetricsMessage(
  eventsMetrics: Awaited<ReturnType<typeof queryEventsMetrics>>,
  systemHealthMetrics: Awaited<ReturnType<typeof querySystemHealthMetrics>>,
): string {
  const today = new Date().toISOString().split("T")[0];

  return `📊 *WishlistGPT 日报 - ${today}*

*【用户增长】*
• 新用户: ${eventsMetrics.newUsers} (Google: ${eventsMetrics.newUsersGoogle}, Email: ${eventsMetrics.newUsersEmail})
• 活跃用户: ${eventsMetrics.dau}
• 完成 onboarding: ${eventsMetrics.onboardingComplete}

*【AI 功能】*
• Waitlist 加入: ${eventsMetrics.aiWaitlistJoins.total} (Buy: ${eventsMetrics.aiWaitlistJoins.byIntent.buy}, Gift: ${eventsMetrics.aiWaitlistJoins.byIntent.gift})
• 来源: Card ${eventsMetrics.aiWaitlistJoins.bySurface.card}, Sheet ${eventsMetrics.aiWaitlistJoins.bySurface.sheet}

*【核心功能】*
• Item 创建: ${eventsMetrics.itemCreates}
• Item 删除: ${eventsMetrics.itemDeletes}
• Item Note 更新: ${eventsMetrics.itemNoteUpdates}
• Item 详情查看: ${eventsMetrics.itemViewDetails}
• Share 创建: ${eventsMetrics.shareCreates}
• Share 查看: ${eventsMetrics.sharePageViews}
• Share 操作: ${eventsMetrics.shareActions.total} (复制: ${eventsMetrics.shareActions.copy}, 原生: ${eventsMetrics.shareActions.native})

*【系统健康度】*
• 总 Item 数: ${systemHealthMetrics.totalItems}
• 今日新增: ${systemHealthMetrics.todayCreated}
• 缺失 canonical_url: ${systemHealthMetrics.missingCanonicalUrl}
• 缺失标题: ${systemHealthMetrics.missingTitle}
• 缺失封面图: ${systemHealthMetrics.missingImage}
• 缺失价格: ${systemHealthMetrics.missingPrice}
• 健康比例: ${systemHealthMetrics.healthyRatio}%`;
}

export async function GET(request: NextRequest) {
  // 验证 Cron Secret（Vercel 会自动添加 Authorization header）
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  // 如果设置了 CRON_SECRET，则验证；否则允许通过（Vercel Cron 会自动添加 header）
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const eventsMetrics = await queryEventsMetrics();
    const systemHealthMetrics = await querySystemHealthMetrics();
    const message = formatMetricsMessage(eventsMetrics, systemHealthMetrics);

    await sendTelegramMessage(message);

    return NextResponse.json({
      ok: true,
      sent_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Daily metrics error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
