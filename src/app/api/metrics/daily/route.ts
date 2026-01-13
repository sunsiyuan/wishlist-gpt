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

async function queryTableMetrics(): Promise<{
  totalItems: number;
  todayNewItems: number;
  itemsWithNote: number;
  itemsWithPrice: number;
  avgItemsPerUser: number;
  activeShares: number;
  todayNewShares: number;
  usersWithShare: number;
  enrichmentSuccessRate: number;
  profilesComplete: number;
  todayFeedback: number;
}> {
  const today = new Date().toISOString().split("T")[0];
  const todayStart = `${today}T00:00:00Z`;
  const yesterdayStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0] + "T00:00:00Z";

  // 总 Item 数
  const totalItemsRes = await supabaseAdminFetch(
    `/rest/v1/items?deleted_at=is.null&select=id`,
    { method: "GET" },
  );
  const totalItems = totalItemsRes.ok ? (await totalItemsRes.json()).length : 0;

  // 今日新增 Item 数
  const todayNewItemsRes = await supabaseAdminFetch(
    `/rest/v1/items?deleted_at=is.null&created_at=gte.${todayStart}&select=id`,
    { method: "GET" },
  );
  const todayNewItems = todayNewItemsRes.ok
    ? (await todayNewItemsRes.json()).length
    : 0;

  // 有 Note 的 Item 数
  const itemsWithNoteRes = await supabaseAdminFetch(
    `/rest/v1/items?deleted_at=is.null&personal_note=not.is.null&select=id`,
    { method: "GET" },
  );
  const itemsWithNote = itemsWithNoteRes.ok
    ? (await itemsWithNoteRes.json()).length
    : 0;

  // 有价格信息的 Item 数
  const itemsWithPriceRes = await supabaseAdminFetch(
    `/rest/v1/items?deleted_at=is.null&display_price_amount_minor=not.is.null&select=id`,
    { method: "GET" },
  );
  const itemsWithPrice = itemsWithPriceRes.ok
    ? (await itemsWithPriceRes.json()).length
    : 0;

  // 平均每用户 Item 数
  const avgItemsRes = await supabaseAdminFetch(
    `/rest/v1/items?deleted_at=is.null&select=user_id`,
    { method: "GET" },
  );
  const avgItemsData = avgItemsRes.ok ? await avgItemsRes.json() : [];
  const uniqueUsers = new Set(avgItemsData.map((i: { user_id: string }) => i.user_id)).size;
  const avgItemsPerUser = uniqueUsers > 0 ? (avgItemsData.length / uniqueUsers).toFixed(2) : "0";

  // 活跃 Share 数
  const activeSharesRes = await supabaseAdminFetch(
    `/rest/v1/shares?revoked_at=is.null&select=id`,
    { method: "GET" },
  );
  const activeShares = activeSharesRes.ok ? (await activeSharesRes.json()).length : 0;

  // 今日创建的 Share 数
  const todayNewSharesRes = await supabaseAdminFetch(
    `/rest/v1/shares?created_at=gte.${todayStart}&select=id`,
    { method: "GET" },
  );
  const todayNewShares = todayNewSharesRes.ok
    ? (await todayNewSharesRes.json()).length
    : 0;

  // 有 Share 的用户数
  const usersWithShareRes = await supabaseAdminFetch(
    `/rest/v1/shares?revoked_at=is.null&select=user_id`,
    { method: "GET" },
  );
  const usersWithShareData = usersWithShareRes.ok ? await usersWithShareRes.json() : [];
  const usersWithShare = new Set(usersWithShareData.map((s: { user_id: string }) => s.user_id)).size;

  // Enrichment 成功率（最近24小时）
  const enrichmentRes = await supabaseAdminFetch(
    `/rest/v1/item_enrich_runs?created_at=gte.${yesterdayStart}&select=final_applied`,
    { method: "GET" },
  );
  const enrichmentData = enrichmentRes.ok ? await enrichmentRes.json() : [];
  const enrichmentSuccess = enrichmentData.filter((r: { final_applied: boolean }) => r.final_applied).length;
  const enrichmentSuccessRate =
    enrichmentData.length > 0
      ? ((enrichmentSuccess / enrichmentData.length) * 100).toFixed(1)
      : "0";

  // 完成 Profile 设置的用户数
  const profilesRes = await supabaseAdminFetch(
    `/rest/v1/profiles?or=(country_code.not.is.null,preferred_language.not.is.null)&select=id`,
    { method: "GET" },
  );
  const profilesComplete = profilesRes.ok ? (await profilesRes.json()).length : 0;

  // 今日反馈数
  const todayFeedbackRes = await supabaseAdminFetch(
    `/rest/v1/feedback?created_at=gte.${todayStart}&select=id`,
    { method: "GET" },
  );
  const todayFeedback = todayFeedbackRes.ok
    ? (await todayFeedbackRes.json()).length
    : 0;

  return {
    totalItems,
    todayNewItems,
    itemsWithNote,
    itemsWithPrice,
    avgItemsPerUser: parseFloat(avgItemsPerUser),
    activeShares,
    todayNewShares,
    usersWithShare,
    enrichmentSuccessRate: parseFloat(enrichmentSuccessRate),
    profilesComplete,
    todayFeedback,
  };
}

function formatMetricsMessage(
  eventsMetrics: Awaited<ReturnType<typeof queryEventsMetrics>>,
  tableMetrics: Awaited<ReturnType<typeof queryTableMetrics>>,
): string {
  const today = new Date().toISOString().split("T")[0];

  return `📊 *WishlistGPT 日报 - ${today}*

*【用户增长】*
• 新用户: ${eventsMetrics.newUsers} (Google: ${eventsMetrics.newUsersGoogle}, Email: ${eventsMetrics.newUsersEmail})
• 活跃用户: ${eventsMetrics.dau}
• 完成 onboarding: ${eventsMetrics.onboardingComplete}

*【核心功能】*
• Item 创建: ${eventsMetrics.itemCreates}
• Item 删除: ${eventsMetrics.itemDeletes}
• Item Note 更新: ${eventsMetrics.itemNoteUpdates}
• Item 详情查看: ${eventsMetrics.itemViewDetails}
• Share 创建: ${eventsMetrics.shareCreates}
• Share 查看: ${eventsMetrics.sharePageViews}
• Share 操作: ${eventsMetrics.shareActions.total} (复制: ${eventsMetrics.shareActions.copy}, 原生: ${eventsMetrics.shareActions.native})

*【AI 功能】*
• Waitlist 加入: ${eventsMetrics.aiWaitlistJoins.total} (Buy: ${eventsMetrics.aiWaitlistJoins.byIntent.buy}, Gift: ${eventsMetrics.aiWaitlistJoins.byIntent.gift})
• 来源: Card ${eventsMetrics.aiWaitlistJoins.bySurface.card}, Sheet ${eventsMetrics.aiWaitlistJoins.bySurface.sheet}

*【数据表统计】*
• 总 Item 数: ${tableMetrics.totalItems}
• 今日新增 Item: ${tableMetrics.todayNewItems}
• 有 Note 的 Item: ${tableMetrics.itemsWithNote}
• 有价格的 Item: ${tableMetrics.itemsWithPrice}
• 平均每用户 Item 数: ${tableMetrics.avgItemsPerUser}
• 活跃 Share 数: ${tableMetrics.activeShares}
• 今日新增 Share: ${tableMetrics.todayNewShares}
• 有 Share 的用户数: ${tableMetrics.usersWithShare}
• Enrichment 成功率: ${tableMetrics.enrichmentSuccessRate}%
• 完成 Profile 设置: ${tableMetrics.profilesComplete}
• 今日反馈: ${tableMetrics.todayFeedback}`;
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
    const tableMetrics = await queryTableMetrics();
    const message = formatMetricsMessage(eventsMetrics, tableMetrics);

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
