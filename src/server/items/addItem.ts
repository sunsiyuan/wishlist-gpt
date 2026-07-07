import "server-only";

import type { DisplayFieldUpdate, ItemRecord } from "./store";
import {
  createOrTouchItem,
  updateItemDisplayFields,
  updateItemCanonicalUrl,
} from "./store";
import { deriveDisplayDefaults, extractDisplayHints } from "./displayFields";
import { sanitizeSourceUrl, TRACKING_PARAM_CONFIG } from "./sanitizeUrl";
import { rehostItemImageBestEffort } from "./imageIngest";

/**
 * Create (or touch) a wishlist item and apply caller-provided display fields.
 *
 * Under the Apps SDK / MCP model the calling agent (ChatGPT) extracts the product's title,
 * image, price and merchant and passes them in `hints` — so there is no server-side scraping
 * or enrichment here. We only: upsert the item, fill a tracking-stripped canonical URL, and
 * persist the sanitized display fields (deriving merchant domain + favicon from the URL host).
 *
 * Shared by the web `/api/items` route and the MCP `add_to_wishlist` tool.
 */
export async function addItemForUser(params: {
  userId: string;
  url: string;
  hints?: Record<string, unknown>;
}): Promise<ItemRecord> {
  const { userId } = params;
  const trimmedUrl = params.url.trim();
  const hints = params.hints ?? {};

  const item = await createOrTouchItem({ userId, url: params.url });

  // Fill canonical_url if missing (fill-only, tracking params stripped).
  let current = item;
  if (!item.canonical_url) {
    const sanitized = sanitizeSourceUrl(trimmedUrl, TRACKING_PARAM_CONFIG);
    if (sanitized) {
      const updated = await updateItemCanonicalUrl({
        userId,
        itemId: item.id,
        canonicalUrl: sanitized,
      });
      if (updated) {
        current = updated;
      }
    }
  }

  const displayHints = extractDisplayHints(hints);
  const derivedDefaults = deriveDisplayDefaults({ url: trimmedUrl, existing: displayHints });
  const updates: DisplayFieldUpdate = { ...displayHints, ...derivedDefaults };
  const hasPriceUpdate =
    updates.display_price_amount_minor !== undefined ||
    updates.display_currency !== undefined ||
    updates.display_price_text !== undefined;
  if (hasPriceUpdate) {
    updates.display_price_updated_at = new Date().toISOString();
  }

  const finalItem =
    Object.keys(updates).length > 0
      ? (await updateItemDisplayFields({ userId, itemId: current.id, updates })) ?? current
      : current;

  // Re-host the cover image to durable storage so the link doesn't expire (best-effort, async).
  if (finalItem.display_cover_image_url) {
    rehostItemImageBestEffort({
      userId,
      itemId: finalItem.id,
      imageUrl: finalItem.display_cover_image_url,
    });
  }

  return finalItem;
}
