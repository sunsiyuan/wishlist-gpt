import { supabaseAdminFetch } from "../supabase/admin";

export type ItemRecord = {
  id: string;
  user_id: string;
  url_original: string;
  created_at: string;
  updated_at: string;
  personal_note: string | null;
  deleted_at: string | null;
  display_cover_image_url: string | null;
  display_product_title: string | null;
  display_merchant_logo_url: string | null;
  display_merchant_domain: string | null;
  display_price_amount_minor: number | null;
  display_currency: string | null;
  display_price_text: string | null;
  display_price_updated_at: string | null;
};

export type ItemSort = "created_at.asc" | "created_at.desc";

const ITEM_SELECT = [
  "id",
  "user_id",
  "url_original",
  "created_at",
  "updated_at",
  "personal_note",
  "deleted_at",
  "display_cover_image_url",
  "display_product_title",
  "display_merchant_logo_url",
  "display_merchant_domain",
  "display_price_amount_minor",
  "display_currency",
  "display_price_text",
  "display_price_updated_at",
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
