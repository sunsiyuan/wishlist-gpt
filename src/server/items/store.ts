import { supabaseAdminFetch } from "../supabase/admin";

export type ItemRecord = {
  id: string;
  user_id: string;
  url_original: string;
  created_at: string;
  updated_at: string;
};

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

export async function listItems(params: { userId: string }): Promise<ItemRecord[]> {
  const search = new URLSearchParams({
    user_id: `eq.${params.userId}`,
    order: "updated_at.desc,id.desc",
    select: "id,url_original,created_at,updated_at",
  });
  const response = await supabaseAdminFetch(`/rest/v1/items?${search.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to list items: ${response.status}`);
  }
  return (await response.json()) as ItemRecord[];
}
