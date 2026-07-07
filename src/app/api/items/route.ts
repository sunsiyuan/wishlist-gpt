import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUserId } from "../../../server/auth/supabase";
import { listItemsForUser } from "../../../server/items/store";
import { addItemForUser } from "../../../server/items/addItem";

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Web-only route: authenticated by the Supabase session cookie. The MCP tools write items via
// addItemForUser directly, so no OAuth-bearer path is needed here anymore.
async function authenticate(request: NextRequest) {
  const supabaseUserId = await getSupabaseUserId(request);
  if (!supabaseUserId) {
    return { error: jsonError(401, "missing_auth", "Missing Supabase session") };
  }
  return { userId: supabaseUserId };
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
          image_url: item.image_url,
          title: item.title,
          merchant_domain: item.merchant_domain,
          price_amount_minor: item.price_amount_minor,
          currency: item.currency,
          price_text: item.price_text,
          price_updated_at: item.price_updated_at,
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
          image_url: item.image_url,
          title: item.title,
          merchant_domain: item.merchant_domain,
          price_amount_minor: item.price_amount_minor,
          currency: item.currency,
          price_text: item.price_text,
          price_updated_at: item.price_updated_at,
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
    const finalItem = await addItemForUser({
      userId: auth.userId,
      url: urlValue,
      hints: body as Record<string, unknown>,
    });

    return NextResponse.json({
      item: {
        id: finalItem.id,
        url_original: finalItem.url_original,
        canonical_url: finalItem.canonical_url,
        created_at: finalItem.created_at,
        updated_at: finalItem.updated_at,
        image_url: finalItem.image_url,
        title: finalItem.title,
        merchant_domain: finalItem.merchant_domain,
        price_amount_minor: finalItem.price_amount_minor,
        currency: finalItem.currency,
        price_text: finalItem.price_text,
        price_updated_at: finalItem.price_updated_at,
      },
    });
  } catch (error) {
    return jsonError(500, "items_upsert_failed", "Failed to save item");
  }
}
