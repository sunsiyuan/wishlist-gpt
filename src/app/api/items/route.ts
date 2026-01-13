import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getBearerToken, verifyAccessToken } from "../../../server/auth/bearer";
import { getSupabaseUserId } from "../../../server/auth/supabase";
import type { DisplayFieldUpdate } from "../../../server/items/store";
import {
  createOrTouchItem,
  listItemsForUser,
  updateItemDisplayFields,
  insertItemEnrichAttempt,
} from "../../../server/items/store";
import { enrichItemBestEffort, type EnrichAttempt } from "../../../server/items/enrich";
import {
  deriveDisplayDefaults,
  extractDisplayHints,
} from "../../../server/items/displayFields";

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

async function authenticate(request: NextRequest) {
  const supabaseUserId = await getSupabaseUserId(request);
  if (supabaseUserId) {
    return { userId: supabaseUserId };
  }

  const token = getBearerToken(request);
  if (!token) {
    return { error: jsonError(401, "missing_auth", "Missing Supabase session or bearer token") };
  }
  const claims = verifyAccessToken(token);
  if (!claims) {
    return { error: jsonError(401, "invalid_token", "Invalid or expired token") };
  }
  return { userId: claims.userId };
}

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (auth.error) {
    return auth.error;
  }

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope");
  const listRef = searchParams.get("list_ref");

  // Handle followed list scope
  if (scope === "followed" && listRef) {
    try {
      const { listItemsForFollowedList, checkSharingEnabled } = await import(
        "../../../server/follows/items"
      );
      const items = await listItemsForFollowedList({
        followerUserId: auth.userId,
        listRef,
      });

      // Check if sharing is enabled
      const sharingEnabled = await checkSharingEnabled(listRef);
      if (!sharingEnabled) {
        // Return sharing disabled status
        const { parseListRef } = await import("../../../server/follows/store");
        const parsed = parseListRef(listRef);
        if (parsed) {
          const { getProfileForUserAdmin } = await import("../../../server/profiles/store");
          const ownerProfile = await getProfileForUserAdmin(parsed.ownerUserId);
          if (ownerProfile) {
            return NextResponse.json({
              sharing_disabled: true,
              owner: {
                nickname: ownerProfile.nickname,
                avatar_name: ownerProfile.avatar_name,
              },
            });
          }
        }
        return jsonError(403, "sharing_disabled", "This list is no longer shared");
      }

      // Return items (same format as share page - non-PII, read-only)
      return NextResponse.json({
        items: items.map((item) => ({
          id: item.id,
          url_original: item.url_original,
          source_url: item.url_original, // For share page compatibility
          personal_note: item.personal_note,
          created_at: item.created_at,
          updated_at: item.updated_at,
          display_cover_image_url: item.display_cover_image_url,
          display_product_title: item.display_product_title,
          display_merchant_logo_url: item.display_merchant_logo_url,
          display_merchant_domain: item.display_merchant_domain,
          display_price_amount_minor: item.display_price_amount_minor,
          display_currency: item.display_currency,
          display_price_text: item.display_price_text,
          display_price_updated_at: item.display_price_updated_at,
        })),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "unknown_error";
      if (errorMessage === "not_following" || errorMessage.includes("follow")) {
        return jsonError(403, "not_following", "You are not following this list");
      }
      console.error("[items] followed list failed", { error: errorMessage });
      return jsonError(500, "items_list_failed", "Failed to list items");
    }
  }

  // Default: return user's own items
  try {
    const items = await listItemsForUser({ userId: auth.userId });
    return NextResponse.json({
      items: items.map((item) => ({
        id: item.id,
        url_original: item.url_original,
        created_at: item.created_at,
        updated_at: item.updated_at,
        display_cover_image_url: item.display_cover_image_url,
        display_product_title: item.display_product_title,
        display_merchant_logo_url: item.display_merchant_logo_url,
        display_merchant_domain: item.display_merchant_domain,
        display_price_amount_minor: item.display_price_amount_minor,
        display_currency: item.display_currency,
        display_price_text: item.display_price_text,
        display_price_updated_at: item.display_price_updated_at,
      })),
    });
  } catch (error) {
    return jsonError(500, "items_list_failed", "Failed to list items");
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (auth.error) {
    return auth.error;
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return jsonError(400, "invalid_json", "Invalid JSON body");
  }
  if (!body || typeof body !== "object") {
    return jsonError(400, "invalid_body", "Request body must be a JSON object");
  }
  const urlValue = (body as { url?: unknown }).url;
  if (typeof urlValue !== "string" || !urlValue.trim()) {
    return jsonError(400, "invalid_url", "url is required and must be a string");
  }
  try {
    const item = await createOrTouchItem({
      userId: auth.userId,
      url: urlValue,
    });
    const displayHints = extractDisplayHints(body as Record<string, unknown>);
    const derivedDefaults = deriveDisplayDefaults({ url: urlValue, existing: displayHints });
    const updates: DisplayFieldUpdate = { ...displayHints, ...derivedDefaults };
    const hasPriceUpdate =
      updates.display_price_amount_minor !== undefined ||
      updates.display_currency !== undefined ||
      updates.display_price_text !== undefined;
    if (hasPriceUpdate) {
      updates.display_price_updated_at = new Date().toISOString();
    }
    const updatedItem =
      Object.keys(updates).length > 0
        ? await updateItemDisplayFields({
            userId: auth.userId,
            itemId: item.id,
            updates,
          })
        : item;

    // Log GPTs input as first attempt (best effort, non-blocking)
    after(async () => {
      try {
        const bodyRecord = body as Record<string, unknown>;
        const providedFields: string[] = [];
        const inputDetails: Record<string, unknown> = {};

        // Whitelisted fields from request body
        const whitelistedFields = [
          "url",
          "display_product_title",
          "display_cover_image_url",
          "display_price_text",
          "display_price_amount_minor",
          "display_currency",
          "display_merchant_domain",
          "display_merchant_logo_url",
        ];

        for (const field of whitelistedFields) {
          if (field in bodyRecord && bodyRecord[field] !== undefined) {
            inputDetails[field] = bodyRecord[field];
            providedFields.push(field);
          }
        }

        const attempt: EnrichAttempt = {
          strategy: "gpts_input",
          started_at: new Date().toISOString(),
          duration_ms: 0,
          request: {
            source: "actions",
            path: "/items",
          },
          details: {
            input: inputDetails,
            provided_fields: providedFields,
          },
        };

        await insertItemEnrichAttempt({
          userId: auth.userId,
          itemId: item.id,
          sourceUrl: urlValue.trim(),
          runGroupId: crypto.randomUUID(),
          strategy: attempt.strategy,
          attempt,
        });
      } catch (error) {
        // Silently fail - best effort
        console.warn("[items] Failed to log GPTs input attempt", {
          item_id: item.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    enrichItemBestEffort({ userId: auth.userId, itemId: item.id, url: item.url_original });
    return NextResponse.json({
      item: {
        id: (updatedItem ?? item).id,
        url_original: (updatedItem ?? item).url_original,
        created_at: (updatedItem ?? item).created_at,
        updated_at: (updatedItem ?? item).updated_at,
        display_cover_image_url: (updatedItem ?? item).display_cover_image_url,
        display_product_title: (updatedItem ?? item).display_product_title,
        display_merchant_logo_url: (updatedItem ?? item).display_merchant_logo_url,
        display_merchant_domain: (updatedItem ?? item).display_merchant_domain,
        display_price_amount_minor: (updatedItem ?? item).display_price_amount_minor,
        display_currency: (updatedItem ?? item).display_currency,
        display_price_text: (updatedItem ?? item).display_price_text,
        display_price_updated_at: (updatedItem ?? item).display_price_updated_at,
      },
    });
  } catch (error) {
    return jsonError(500, "items_upsert_failed", "Failed to save item");
  }
}
