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

export type DisplayFieldUpdate = Partial<
  Pick<
    ItemRecord,
    | "display_cover_image_url"
    | "display_product_title"
    | "display_merchant_logo_url"
    | "display_merchant_domain"
    | "display_price_amount_minor"
    | "display_currency"
    | "display_price_text"
    | "display_price_updated_at"
  >
>;

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

/**
 * Safely serialize JSON for database storage, truncating if too large.
 * @param value Value to serialize
 * @param options Options including maxBytes (default 65536 = 64KB)
 * @returns Serialized object safe for DB storage
 */
export function safeJsonForDb(
  value: unknown,
  options: { maxBytes?: number } = {},
): unknown {
  const maxBytes = options.maxBytes ?? 65536;
  try {
    const serialized = JSON.stringify(value);
    const sizeBytes = Buffer.byteLength(serialized, "utf8");
    if (sizeBytes <= maxBytes) {
      return value;
    }
    // Truncate: store preview of first ~1000 chars
    const preview = serialized.substring(0, 1000);
    return {
      truncated: true,
      approx_bytes: sizeBytes,
      preview,
      note: "too_large",
    };
  } catch (error) {
    return {
      error: "json_serialize_failed",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sanitizeAttemptHeaders(headers: unknown): Record<string, string> | undefined {
  if (!isRecord(headers)) {
    return undefined;
  }
  const allowed = new Set(["accept", "user-agent", "accept-language", "referer"]);
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value !== "string") {
      continue;
    }
    if (allowed.has(key.toLowerCase())) {
      sanitized[key] = value;
    }
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function sanitizeAttemptForDb(attempt: unknown): unknown {
  if (!isRecord(attempt)) {
    return attempt;
  }
  const sanitized: Record<string, unknown> = { ...attempt };
  if (isRecord(attempt.request)) {
    const request: Record<string, unknown> = { ...attempt.request };
    if ("headers" in request) {
      const sanitizedHeaders = sanitizeAttemptHeaders(request.headers);
      if (sanitizedHeaders) {
        request.headers = sanitizedHeaders;
      } else {
        delete request.headers;
      }
    }
    sanitized.request = request;
  }
  if (typeof sanitized.raw === "string") {
    sanitized.raw = {
      truncated: true,
      note: "raw_payload_omitted",
    };
  }
  const maxBytes = 32768;
  const serialized = JSON.stringify(sanitized);
  if (Buffer.byteLength(serialized, "utf8") <= maxBytes) {
    return sanitized;
  }
  const trimmed: Record<string, unknown> = { ...sanitized };
  if ("raw" in trimmed) {
    trimmed.raw = {
      truncated: true,
      note: "raw_payload_omitted",
    };
  }
  if ("details" in trimmed) {
    trimmed.details = {
      truncated: true,
      note: "details_omitted",
    };
  }
  if ("computed_updates" in trimmed) {
    trimmed.computed_updates = {
      truncated: true,
      note: "computed_updates_omitted",
    };
  }
  return safeJsonForDb(trimmed, { maxBytes });
}

/**
 * Insert an item enrich run log (best effort, errors are swallowed).
 */
export async function insertItemEnrichAttempt(params: {
  userId: string;
  itemId: string;
  sourceUrl: string;
  runGroupId: string;
  strategy: string;
  attempt: unknown;
}): Promise<void> {
  try {
    const attemptsSafe = safeJsonForDb([sanitizeAttemptForDb(params.attempt)], {
      maxBytes: 32768,
    });

    const response = await supabaseAdminFetch("/rest/v1/item_enrich_runs", {
      method: "POST",
      headers: {
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        user_id: params.userId,
        item_id: params.itemId,
        source_url: params.sourceUrl,
        run_group_id: params.runGroupId,
        strategy: params.strategy,
        final_applied: false,
        final_updates: {},
        attempts: attemptsSafe,
      }),
    });
    if (!response.ok) {
      // Silently fail - this is best effort
      console.warn("[enrich] Failed to log enrich run", {
        item_id: params.itemId,
        status: response.status,
      });
    }
  } catch (error) {
    // Silently fail - this is best effort
    console.warn("[enrich] Error logging enrich run", {
      item_id: params.itemId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function insertItemEnrichFinal(params: {
  userId: string;
  itemId: string;
  sourceUrl: string;
  runGroupId: string;
  finalApplied: boolean;
  finalUpdates: unknown;
}): Promise<void> {
  try {
    const finalUpdatesSafe = safeJsonForDb(params.finalUpdates);

    const response = await supabaseAdminFetch("/rest/v1/item_enrich_runs", {
      method: "POST",
      headers: {
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        user_id: params.userId,
        item_id: params.itemId,
        source_url: params.sourceUrl,
        run_group_id: params.runGroupId,
        strategy: "final",
        final_applied: params.finalApplied,
        final_updates: finalUpdatesSafe,
        attempts: [],
      }),
    });
    if (!response.ok) {
      // Silently fail - this is best effort
      console.warn("[enrich] Failed to log enrich final", {
        item_id: params.itemId,
        status: response.status,
      });
    }
  } catch (error) {
    // Silently fail - this is best effort
    console.warn("[enrich] Error logging enrich final", {
      item_id: params.itemId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
