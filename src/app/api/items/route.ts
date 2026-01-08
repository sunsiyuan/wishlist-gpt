import { NextRequest, NextResponse } from "next/server";
import { getBearerToken, verifyAccessToken } from "../../../server/auth/bearer";
import { getSupabaseUserId } from "../../../server/auth/supabase";
import type { DisplayFieldUpdate } from "../../../server/items/store";
import { createOrTouchItem, listItemsForUser, updateItemDisplayFields } from "../../../server/items/store";
import { enrichItemBestEffort } from "../../../server/items/enrich";
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
