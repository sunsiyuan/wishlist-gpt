import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRequestClient } from "../../../../lib/supabase/server";
import { supabaseAdminFetch } from "../../../../server/supabase/admin";
import { sanitizeSourceUrl, TRACKING_PARAM_CONFIG } from "../../../../server/items/sanitizeUrl";
import { updateItemCanonicalUrl } from "../../../../server/items/store";

/**
 * GET /api/ops/queue
 * Returns items that need manual ops intervention.
 * 
 * Eligibility:
 * - deleted_at IS NULL
 * - canonical_url IS NOT NULL AND canonical_url <> '' (after lazy refresh)
 * - enrich_attempts >= 0 (any item, including never attempted)
 * - missing display_product_title OR missing display_cover_image_url
 * 
 * Note: 
 * - Changed from enrich_attempts >= 3 to >= 0 to allow ops intervention at any time,
 *   since Vercel Hobby Plan only allows one cron execution per day.
 * - Lazy refresh: Query all items first (including null canonical_url), then backfill items
 *   with url_original but null canonical_url. After backfill, only items with non-empty
 *   canonical_url are shown (null/empty canonical_url items are system issues, handled by system-health alert).
 * 
 * Auth: Cookie session + OPS_EMAIL_ALLOWLIST check
 * Data access: Service role (bypass RLS)
 */
function parseOpsEmailAllowlist(): string[] {
  const allowlistStr = process.env.OPS_EMAIL_ALLOWLIST;
  if (!allowlistStr) {
    return [];
  }
  try {
    const parsed = JSON.parse(allowlistStr);
    if (Array.isArray(parsed)) {
      return parsed.filter((email): email is string => typeof email === "string" && email.includes("@"));
    }
    return [];
  } catch {
    return [];
  }
}

async function checkOpsAccess(request: NextRequest): Promise<{ allowed: boolean; email?: string }> {
  const supabase = createSupabaseRequestClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return { allowed: false };
  }

  const allowlist = parseOpsEmailAllowlist();
  if (allowlist.length === 0) {
    // No allowlist configured, deny access
    return { allowed: false };
  }

  const email = user.email.toLowerCase().trim();
  const allowed = allowlist.some((allowedEmail) => allowedEmail.toLowerCase().trim() === email);

  return { allowed, email };
}

export async function GET(request: NextRequest) {
  const access = await checkOpsAccess(request);
  if (!access.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Step 1: Query all items (including those with null canonical_url) for lazy refresh
    // Note: enrich_attempts >= 0 means all items (including never attempted)
    const searchParams = new URLSearchParams({
      deleted_at: "is.null",
      enrich_attempts: "gte.0",
      select: "id,user_id,canonical_url,url_original,display_product_title,display_cover_image_url,display_price_text,enrich_last_attempt_at",
      order: "enrich_last_attempt_at.desc.nullslast",
      limit: "500", // Increased limit to account for filtering
    });

    const response = await supabaseAdminFetch(`/rest/v1/items?${searchParams.toString()}`);
    if (!response.ok) {
      throw new Error(`Failed to query ops queue: ${response.status}`);
    }

    const allItems = (await response.json()) as Array<{
      id: string;
      user_id: string;
      canonical_url: string | null;
      url_original: string | null;
      display_product_title: string | null;
      display_cover_image_url: string | null;
      display_price_text: string | null;
      enrich_last_attempt_at: string | null;
    }>;

    // Step 2: Lazy refresh - Backfill canonical_url for items that have url_original but null/empty canonical_url
    // This can happen if items were created before canonical_url backfill was implemented
    const itemsNeedingBackfill = allItems.filter(
      (item) => (!item.canonical_url || !item.canonical_url.trim()) && item.url_original,
    );

    // Batch backfill (best-effort, non-blocking, parallel processing)
    if (itemsNeedingBackfill.length > 0) {
      const backfillPromises = itemsNeedingBackfill.map(async (item) => {
        try {
          const sanitized = sanitizeSourceUrl(item.url_original!, TRACKING_PARAM_CONFIG);
          if (sanitized) {
            await updateItemCanonicalUrl({
              userId: item.user_id,
              itemId: item.id,
              canonicalUrl: sanitized,
            });
            // Update the item in allItems array with the new canonical_url
            // This way we don't need to re-query after backfill
            const itemIndex = allItems.findIndex((i) => i.id === item.id);
            if (itemIndex !== -1) {
              allItems[itemIndex].canonical_url = sanitized;
            }
          }
        } catch (error) {
          // Best-effort: log but continue
          console.warn("[ops/queue] Failed to backfill canonical_url", {
            item_id: item.id,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      });

      // Wait for all backfills to complete (but don't fail if some fail)
      await Promise.allSettled(backfillPromises);
    }

    // Step 3: Filter items - only show items with non-empty canonical_url and missing title/image
    // Items with null/empty canonical_url (after backfill attempt) are system issues, handled by system-health alert
    const queueItems = allItems.filter((item) => {
      // Skip items with null or empty canonical_url
      if (!item.canonical_url || !item.canonical_url.trim()) {
        return false;
      }
      const missingTitle = !item.display_product_title?.trim();
      const missingImage = !item.display_cover_image_url?.trim();
      return missingTitle || missingImage;
    }).slice(0, 200); // Limit to 200 after filtering

    return NextResponse.json({
      items: queueItems.map((item) => ({
        id: item.id,
        canonical_url: item.canonical_url,
        missing_title: !item.display_product_title?.trim(),
        missing_image: !item.display_cover_image_url?.trim(),
        display_price_text: item.display_price_text,
        enrich_last_attempt_at: item.enrich_last_attempt_at,
      })),
    });
  } catch (error) {
    console.error("[ops/queue] Error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
