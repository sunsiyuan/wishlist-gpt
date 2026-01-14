import { NextRequest, NextResponse } from "next/server";
import { supabaseAdminFetch } from "../../../../server/supabase/admin";
import { enrichItem } from "../../../../server/items/enrich";
import pLimit from "p-limit";

const BATCH_SIZE = 50;
const CONCURRENCY = 5;

/**
 * GET /api/cron/enrich
 * Vercel Cron endpoint for scheduled enrichment retries.
 * 
 * Eligibility criteria:
 * - deleted_at IS NULL
 * - canonical_url IS NOT NULL AND canonical_url <> ''
 * - canonical_url scheme is http/https
 * - enrich_attempts < 3
 * - missing display_product_title OR missing display_cover_image_url OR missing display_price_text
 * 
 * Note: Since Vercel Hobby Plan only allows one cron execution per day,
 * we removed the 4-hour cooldown check. Items are processed once per day until attempts >= 3.
 * 
 * Process:
 * 1. Query eligible items (limit BATCH_SIZE)
 * 2. For each item, try to update enrich_attempts and enrich_last_attempt_at (fill-only claim)
 * 3. Run enrichment concurrently (CONCURRENCY limit)
 * 4. Return statistics
 */
export async function GET(request: NextRequest) {
  // Verify Cron Secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Build eligibility query
    // Note: We use application-layer logic instead of RPC for simplicity
    const searchParams = new URLSearchParams({
      deleted_at: "is.null",
      canonical_url: "not.is.null",
      select: "id,user_id,canonical_url,enrich_attempts,enrich_last_attempt_at,display_product_title,display_cover_image_url,display_price_text",
      limit: String(BATCH_SIZE * 2), // Fetch more to account for filtering
    });

    const response = await supabaseAdminFetch(`/rest/v1/items?${searchParams.toString()}`);
    if (!response.ok) {
      throw new Error(`Failed to query items: ${response.status}`);
    }

    const allItems = (await response.json()) as Array<{
      id: string;
      user_id: string;
      canonical_url: string | null;
      enrich_attempts: number | null;
      enrich_last_attempt_at: string | null;
      display_product_title: string | null;
      display_cover_image_url: string | null;
      display_price_text: string | null;
    }>;

    // Filter eligible items (application-layer filtering)
    const eligibleItems = allItems.filter((item) => {
      // canonical_url must be non-empty
      if (!item.canonical_url || !item.canonical_url.trim()) {
        return false;
      }

      // canonical_url must be http/https
      try {
        const url = new URL(item.canonical_url);
        const scheme = url.protocol.toLowerCase();
        if (scheme !== "http:" && scheme !== "https:") {
          return false;
        }
      } catch {
        return false;
      }

      // enrich_attempts < 3
      const attempts = item.enrich_attempts ?? 0;
      if (attempts >= 3) {
        return false;
      }

      // Missing display fields
      const missingTitle = !item.display_product_title?.trim();
      const missingImage = !item.display_cover_image_url?.trim();
      const missingPrice = !item.display_price_text?.trim();

      if (!missingTitle && !missingImage && !missingPrice) {
        return false; // All fields present, not eligible
      }

      return true;
    });

    // Sort by enrich_last_attempt_at (ascending, nulls first)
    eligibleItems.sort((a, b) => {
      const aTime = a.enrich_last_attempt_at ? new Date(a.enrich_last_attempt_at).getTime() : 0;
      const bTime = b.enrich_last_attempt_at ? new Date(b.enrich_last_attempt_at).getTime() : 0;
      return aTime - bTime;
    });

    // Limit to BATCH_SIZE
    const candidates = eligibleItems.slice(0, BATCH_SIZE);

    // Claim items: try to update enrich_attempts and enrich_last_attempt_at
    const claimedItems: Array<{
      id: string;
      user_id: string;
      canonical_url: string;
    }> = [];

    for (const item of candidates) {
      try {
        const currentAttempts = item.enrich_attempts ?? 0;
        const now = new Date().toISOString();

        // Try to update (application-layer claim)
        const updateResponse = await supabaseAdminFetch(
          `/rest/v1/items?id=eq.${item.id}&enrich_attempts=eq.${currentAttempts}`,
          {
            method: "PATCH",
            headers: {
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              enrich_attempts: currentAttempts + 1,
              enrich_last_attempt_at: now,
            }),
          },
        );

        // If update succeeded (status 204 or 200), item was claimed
        if (updateResponse.ok) {
          claimedItems.push({
            id: item.id,
            user_id: item.user_id,
            canonical_url: item.canonical_url!,
          });
        }
        // If update failed (e.g., enrich_attempts changed), skip this item
      } catch (error) {
        // Skip on error
        console.warn("[cron/enrich] Failed to claim item", {
          item_id: item.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Run enrichment concurrently
    const limit = pLimit(CONCURRENCY);
    let succeeded = 0;
    let failed = 0;

    const promises = claimedItems.map((item) =>
      limit(async () => {
        try {
          await enrichItem({
            userId: item.user_id,
            itemId: item.id,
            url: item.canonical_url,
          });
          succeeded++;
        } catch (error) {
          failed++;
          console.warn("[cron/enrich] Enrichment failed", {
            item_id: item.id,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }),
    );

    await Promise.all(promises);

    return NextResponse.json({
      ok: true,
      processed: claimedItems.length,
      succeeded,
      failed,
    });
  } catch (error) {
    console.error("[cron/enrich] Error", {
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
