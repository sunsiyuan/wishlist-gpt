import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getBearerToken, verifyAccessToken } from "../../../server/auth/bearer";
import { getSupabaseUserId } from "../../../server/auth/supabase";
import type { DisplayFieldUpdate } from "../../../server/items/store";
import {
  createOrTouchItem,
  listItemsForUser,
  updateItemDisplayFields,
  updateItemCanonicalUrl,
  insertItemEnrichAttempt,
} from "../../../server/items/store";
import { enrichItemBestEffort, type EnrichAttempt } from "../../../server/items/enrich";
import {
  deriveDisplayDefaults,
  extractDisplayHints,
} from "../../../server/items/displayFields";
import { sanitizeSourceUrl, TRACKING_PARAM_CONFIG } from "../../../server/items/sanitizeUrl";

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
          canonical_url: item.canonical_url ?? item.url_original, // Fallback to url_original for compatibility
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
          canonical_url: item.canonical_url,
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

    // Fill canonical_url if missing (fill-only)
    let itemWithCanonicalUrl = item;
    if (!item.canonical_url) {
      const sanitized = sanitizeSourceUrl(urlValue.trim(), TRACKING_PARAM_CONFIG);
      if (sanitized) {
        const updated = await updateItemCanonicalUrl({
          userId: auth.userId,
          itemId: item.id,
          canonicalUrl: sanitized,
        });
        if (updated) {
          itemWithCanonicalUrl = updated;
        }
      }
    }

    // Deeplink convenience: if canonical_url scheme is not http/https and missing title/image,
    // set enrich_attempts=3 to enter Ops queue immediately
    const canonicalUrl = itemWithCanonicalUrl.canonical_url;
    if (canonicalUrl) {
      try {
        const url = new URL(canonicalUrl);
        const scheme = url.protocol.toLowerCase();
        const isHttp = scheme === "http:" || scheme === "https:";
        if (!isHttp) {
          // Non-http(s) deeplink: check if missing title or image
          const missingTitle = !item.display_product_title?.trim();
          const missingImage = !item.display_cover_image_url?.trim();
          if (missingTitle || missingImage) {
            // Set enrich_attempts=3 and enrich_last_attempt_at=now() to enter Ops queue
            await updateItemDisplayFields({
              userId: auth.userId,
              itemId: item.id,
              updates: {
                enrich_attempts: 3,
                enrich_last_attempt_at: new Date().toISOString(),
              },
            });
          }
        }
      } catch {
        // URL parse failed, skip deeplink convenience logic
      }
    }

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
            itemId: itemWithCanonicalUrl.id,
            updates,
          })
        : itemWithCanonicalUrl;

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
          sourceUrl: itemWithCanonicalUrl.canonical_url ?? urlValue.trim(),
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

    // Enrichment: only run if canonical_url is http/https
    const finalItem = updatedItem ?? itemWithCanonicalUrl;
    if (finalItem.canonical_url) {
      try {
        const url = new URL(finalItem.canonical_url);
        const scheme = url.protocol.toLowerCase();
        if (scheme === "http:" || scheme === "https:") {
          enrichItemBestEffort({
            userId: auth.userId,
            itemId: finalItem.id,
            url: finalItem.canonical_url,
          });
        }
      } catch {
        // URL parse failed, skip enrichment
      }
    }

    return NextResponse.json({
      item: {
        id: finalItem.id,
        url_original: finalItem.url_original,
        canonical_url: finalItem.canonical_url,
        created_at: finalItem.created_at,
        updated_at: finalItem.updated_at,
        display_cover_image_url: finalItem.display_cover_image_url,
        display_product_title: finalItem.display_product_title,
        display_merchant_logo_url: finalItem.display_merchant_logo_url,
        display_merchant_domain: finalItem.display_merchant_domain,
        display_price_amount_minor: finalItem.display_price_amount_minor,
        display_currency: finalItem.display_currency,
        display_price_text: finalItem.display_price_text,
        display_price_updated_at: finalItem.display_price_updated_at,
      },
    });
  } catch (error) {
    return jsonError(500, "items_upsert_failed", "Failed to save item");
  }
}
