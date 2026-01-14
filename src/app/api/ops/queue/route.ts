import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRequestClient } from "../../../../lib/supabase/server";
import { supabaseAdminFetch } from "../../../../server/supabase/admin";

/**
 * GET /api/ops/queue
 * Returns items that need manual ops intervention.
 * 
 * Eligibility:
 * - deleted_at IS NULL
 * - enrich_attempts >= 0 (any item, including never attempted)
 * - missing display_product_title OR missing display_cover_image_url
 * 
 * Note: 
 * - Changed from enrich_attempts >= 3 to >= 0 to allow ops intervention at any time,
 *   since Vercel Hobby Plan only allows one cron execution per day.
 * - Items with null canonical_url are included (system issue, need ops attention).
 *   These items will be backfilled by enrich cron, but ops can manually fix display fields.
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
    // Query ops queue using service role (bypass RLS)
    // Note: enrich_attempts >= 0 means all items (including never attempted)
    // We don't filter by canonical_url here - items with null canonical_url are system issues that need ops attention
    const searchParams = new URLSearchParams({
      deleted_at: "is.null",
      enrich_attempts: "gte.0",
      select: "id,canonical_url,display_product_title,display_cover_image_url,display_price_text,enrich_last_attempt_at",
      order: "enrich_last_attempt_at.desc.nullslast",
      limit: "500", // Increased limit to account for filtering
    });

    const response = await supabaseAdminFetch(`/rest/v1/items?${searchParams.toString()}`);
    if (!response.ok) {
      throw new Error(`Failed to query ops queue: ${response.status}`);
    }

    const allItems = (await response.json()) as Array<{
      id: string;
      canonical_url: string | null;
      display_product_title: string | null;
      display_cover_image_url: string | null;
      display_price_text: string | null;
      enrich_last_attempt_at: string | null;
    }>;

    // Filter items missing title or image
    // Items with null canonical_url are also included (system issue, need ops attention)
    const queueItems = allItems.filter((item) => {
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
