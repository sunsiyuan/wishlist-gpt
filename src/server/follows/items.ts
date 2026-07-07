import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdminFetch } from "../supabase/admin";
import { checkFollow, parseListRef } from "./store";
import { getActiveShare } from "../shares";
import type { ItemRecord } from "../items/store";

const ITEM_SELECT = [
  "id",
  "user_id",
  "url_original",
  "created_at",
  "updated_at",
  "personal_note",
  "deleted_at",
  "image_url",
  "title",
  "merchant_domain",
  "price_amount_minor",
  "currency",
  "price_text",
  "price_updated_at",
].join(",");

/**
 * List items for a followed list
 * Returns items in the same format as share page (non-PII, read-only)
 */
export async function listItemsForFollowedList(params: {
  followerUserId: string;
  listRef: string;
}): Promise<ItemRecord[]> {
  // Verify user is following this list
  const supabase = await import("../../lib/supabase/server").then((m) =>
    m.createSupabaseServerClient(),
  );
  const isFollowing = await checkFollow(supabase, params.followerUserId, params.listRef);
  if (!isFollowing) {
    throw new Error("not_following");
  }

  // Parse list_ref to get owner_user_id
  const parsed = parseListRef(params.listRef);
  if (!parsed) {
    throw new Error("invalid_list_ref");
  }

  // Query items for the owner (same as share page - non-PII fields only)
  const search = new URLSearchParams({
    user_id: `eq.${parsed.ownerUserId}`,
    deleted_at: "is.null",
    order: "created_at.desc,id.desc",
    select: ITEM_SELECT,
  });

  const response = await supabaseAdminFetch(`/rest/v1/items?${search.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch items: ${response.status}`);
  }

  const data = (await response.json()) as ItemRecord[];
  return data;
}

/**
 * Check if sharing is enabled for a list_ref
 * Returns true if owner has an active share
 */
export async function checkSharingEnabled(listRef: string): Promise<boolean> {
  const parsed = parseListRef(listRef);
  if (!parsed) {
    return false;
  }

  const activeShare = await getActiveShare(parsed.ownerUserId);
  return activeShare !== null;
}
