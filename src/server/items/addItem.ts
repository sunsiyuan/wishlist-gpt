import "server-only";

import type { DisplayFieldUpdate, ItemRecord } from "./store";
import {
  createOrTouchItem,
  updateItemDisplayFields,
  updateItemCanonicalUrl,
} from "./store";
import { deriveDisplayDefaults, extractDisplayHints } from "./displayFields";
import { sanitizeSourceUrl, TRACKING_PARAM_CONFIG } from "./sanitizeUrl";
import { fetchOgImageUrl, rehostItemImage } from "./imageIngest";

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

  // Determine the cover image: prefer the agent-provided URL; if it didn't supply one, fall back
  // to the product page's Open Graph image so covers still show. Then re-host it synchronously so
  // the returned item carries the stable, CSP-safe storage URL (the widget renders from a snapshot
  // and won't auto-refresh on a later update).
  let imageSource: string | null | undefined = updates.image_url;
  if (!imageSource) {
    imageSource = await fetchOgImageUrl(current.canonical_url ?? trimmedUrl);
  }
  if (imageSource) {
    const hosted = await rehostItemImage({
      userId,
      itemId: current.id,
      imageUrl: imageSource,
    });
    if (hosted) {
      updates.image_url = hosted;
    }
  }

  const finalItem =
    Object.keys(updates).length > 0
      ? (await updateItemDisplayFields({ userId, itemId: current.id, updates })) ?? current
      : current;

  return finalItem;
}
