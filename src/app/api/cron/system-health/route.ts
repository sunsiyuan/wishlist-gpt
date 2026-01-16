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

function formatSystemHealthMessage(
  metrics: Awaited<ReturnType<typeof querySystemHealthMetrics>>,
): string {
  const now = new Date().toISOString();
  const timestamp = now.split("T")[1].split(".")[0] + " UTC";

  return `📊 *【系统健康度】* - ${timestamp}

• 总 Item 数: ${metrics.totalItems}
• 今日新增: ${metrics.todayCreated}
• ⚠️ 缺失 canonical_url: ${metrics.missingCanonicalUrl}
• 缺失标题: ${metrics.missingTitle}
• 缺失封面图: ${metrics.missingImage}
• 缺失价格: ${metrics.missingPrice}
• 健康比例: ${metrics.healthyRatio}%`;
}

export async function GET(request: NextRequest) {
  // Verify Cron Secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const metrics = await querySystemHealthMetrics();
    const message = formatSystemHealthMessage(metrics);

    await sendTelegramMessage(message);

    return NextResponse.json({
      ok: true,
      sent_at: new Date().toISOString(),
      metrics,
    });
  } catch (error) {
    console.error("[cron/system-health] Error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
