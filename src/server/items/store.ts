import { supabaseAdminFetch } from "../supabase/admin";

export type ItemRecord = {
  id: string;
  user_id: string;
  url_original: string;
  canonical_url: string | null;
  created_at: string;
  updated_at: string;
  personal_note: string | null;
  deleted_at: string | null;
  image_url: string | null;
  title: string | null;
  merchant_domain: string | null;
  category: string | null;
  options: Record<string, string>;
  variant_url: string | null;
  price_amount_minor: number | null;
  currency: string | null;
  price_text: string | null;
  price_updated_at: string | null;
};

export type DisplayFieldUpdate = Partial<
  Pick<
    ItemRecord,
    | "image_url"
    | "title"
    | "merchant_domain"
    | "category"
    | "options"
    | "variant_url"
    | "price_amount_minor"
    | "currency"
    | "price_text"
    | "price_updated_at"
  >
>;

export type ItemSort = "created_at.asc" | "created_at.desc";

const ITEM_SELECT = [
  "id",
  "user_id",
  "url_original",
  "canonical_url",
  "created_at",
  "updated_at",
  "personal_note",
  "deleted_at",
  "image_url",
  "title",
  "merchant_domain",
  "category",
  "options",
  "variant_url",
  "price_amount_minor",
  "currency",
  "price_text",
  "price_updated_at",
].join(",");

function resolveOrder(sort: ItemSort): string {
  return sort === "created_at.asc" ? "created_at.asc,id.asc" : "created_at.desc,id.desc";
}

export async function createOrTouchItem(params: {
  userId: string;
  url: string;
}): Promise<ItemRecord> {
  const url = params.url.trim();
  if (!url) {
    throw new Error("url is required");
  }
  const now = new Date().toISOString();
  const response = await supabaseAdminFetch("/rest/v1/items?on_conflict=user_id,url_original", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      user_id: params.userId,
      url_original: url,
      updated_at: now,
      deleted_at: null,
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to upsert item: ${response.status}`);
  }
  const data = (await response.json()) as ItemRecord[];
  if (!data[0]) {
    throw new Error("No item returned");
  }
  return data[0];
}

export async function listItemsForUser(params: {
  userId: string;
  sort?: ItemSort;
}): Promise<ItemRecord[]> {
  const search = new URLSearchParams({
    user_id: `eq.${params.userId}`,
    deleted_at: "is.null",
    order: resolveOrder(params.sort ?? "created_at.desc"),
    select: ITEM_SELECT,
  });
  const response = await supabaseAdminFetch(`/rest/v1/items?${search.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to list items: ${response.status}`);
  }
  return (await response.json()) as ItemRecord[];
}

export async function getItemForUser(params: {
  userId: string;
  itemId: string;
}): Promise<ItemRecord | null> {
  const search = new URLSearchParams({
    id: `eq.${params.itemId}`,
    user_id: `eq.${params.userId}`,
    select: ITEM_SELECT,
  });
  const response = await supabaseAdminFetch(`/rest/v1/items?${search.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch item: ${response.status}`);
  }
  const data = (await response.json()) as ItemRecord[];
  return data[0] ?? null;
}

export async function updateItemDisplayFields(params: {
  userId: string;
  itemId: string;
  updates: DisplayFieldUpdate;
}): Promise<ItemRecord | null> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params.updates)) {
    if (value !== undefined) {
      payload[key] = value;
    }
  }
  if (Object.keys(payload).length === 0) {
    return await getItemForUser({ userId: params.userId, itemId: params.itemId });
  }
  payload.updated_at = new Date().toISOString();
  const search = new URLSearchParams({
    id: `eq.${params.itemId}`,
    user_id: `eq.${params.userId}`,
    select: ITEM_SELECT,
  });
  const response = await supabaseAdminFetch(`/rest/v1/items?${search.toString()}`, {
    method: "PATCH",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Failed to update item display fields: ${response.status}`);
  }
  const data = (await response.json()) as ItemRecord[];
  return data[0] ?? null;
}

/**
 * Update canonical_url (fill-only: only sets if currently null/empty).
 */
export async function updateItemCanonicalUrl(params: {
  userId: string;
  itemId: string;
  canonicalUrl: string;
}): Promise<ItemRecord | null> {
  const now = new Date().toISOString();
  const search = new URLSearchParams({
    id: `eq.${params.itemId}`,
    user_id: `eq.${params.userId}`,
    canonical_url: "is.null",
    select: ITEM_SELECT,
  });
  // Only update if canonical_url is null (fill-only)
  const response = await supabaseAdminFetch(`/rest/v1/items?${search.toString()}`, {
    method: "PATCH",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      canonical_url: params.canonicalUrl,
      updated_at: now,
    }),
  });
  if (!response.ok) {
    // If update failed (e.g., canonical_url already set), return current item
    return await getItemForUser({ userId: params.userId, itemId: params.itemId });
  }
  const data = (await response.json()) as ItemRecord[];
  return data[0] ?? null;
}

export async function updatePersonalNote(params: {
  userId: string;
  itemId: string;
  note: string | null;
}): Promise<Pick<ItemRecord, "id" | "personal_note" | "updated_at"> | null> {
  const now = new Date().toISOString();
  const search = new URLSearchParams({
    id: `eq.${params.itemId}`,
    user_id: `eq.${params.userId}`,
    select: "id,personal_note,updated_at",
  });
  const response = await supabaseAdminFetch(`/rest/v1/items?${search.toString()}`, {
    method: "PATCH",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      personal_note: params.note,
      updated_at: now,
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to update personal note: ${response.status}`);
  }
  const data = (await response.json()) as Pick<ItemRecord, "id" | "personal_note" | "updated_at">[];
  return data[0] ?? null;
}

async function getItemStatus(params: {
  userId: string;
  itemId: string;
}): Promise<Pick<ItemRecord, "id" | "deleted_at"> | null> {
  const search = new URLSearchParams({
    id: `eq.${params.itemId}`,
    user_id: `eq.${params.userId}`,
    select: "id,deleted_at",
  });
  const response = await supabaseAdminFetch(`/rest/v1/items?${search.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch item status: ${response.status}`);
  }
  const data = (await response.json()) as Pick<ItemRecord, "id" | "deleted_at">[];
  return data[0] ?? null;
}

export async function softDeleteItem(params: {
  userId: string;
  itemId: string;
}): Promise<Pick<ItemRecord, "id" | "deleted_at"> | null> {
  const now = new Date().toISOString();
  const search = new URLSearchParams({
    id: `eq.${params.itemId}`,
    user_id: `eq.${params.userId}`,
    deleted_at: "is.null",
    select: "id,deleted_at",
  });
  const response = await supabaseAdminFetch(`/rest/v1/items?${search.toString()}`, {
    method: "PATCH",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      deleted_at: now,
      updated_at: now,
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to delete item: ${response.status}`);
  }
  const data = (await response.json()) as Pick<ItemRecord, "id" | "deleted_at">[];
  if (data[0]) {
    return data[0];
  }
  return await getItemStatus({ userId: params.userId, itemId: params.itemId });
}

export async function restoreItem(params: {
  userId: string;
  itemId: string;
}): Promise<Pick<ItemRecord, "id" | "deleted_at"> | null> {
  const now = new Date().toISOString();
  const search = new URLSearchParams({
    id: `eq.${params.itemId}`,
    user_id: `eq.${params.userId}`,
    deleted_at: "not.is.null",
    select: "id,deleted_at",
  });
  const response = await supabaseAdminFetch(`/rest/v1/items?${search.toString()}`, {
    method: "PATCH",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      deleted_at: null,
      updated_at: now,
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to restore item: ${response.status}`);
  }
  const data = (await response.json()) as Pick<ItemRecord, "id" | "deleted_at">[];
  if (data[0]) {
    return data[0];
  }
  return await getItemStatus({ userId: params.userId, itemId: params.itemId });
}
