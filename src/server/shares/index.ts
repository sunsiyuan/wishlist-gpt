import { supabaseAdminFetch } from "../supabase/admin";

export type ShareRecord = {
  id: string;
  user_id: string;
  created_at: string;
  revoked_at: string | null;
};

export async function getActiveShare(userId: string): Promise<ShareRecord | null> {
  const search = new URLSearchParams({
    user_id: `eq.${userId}`,
    revoked_at: "is.null",
    order: "created_at.desc,id.desc",
    limit: "1",
    select: "id,user_id,created_at,revoked_at",
  });
  const response = await supabaseAdminFetch(`/rest/v1/shares?${search.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch active share: ${response.status}`);
  }
  const data = (await response.json()) as ShareRecord[];
  return data[0] ?? null;
}

export async function createOrReuseShare(userId: string): Promise<ShareRecord> {
  const existing = await getActiveShare(userId);
  if (existing) {
    return existing;
  }

  const response = await supabaseAdminFetch("/rest/v1/shares?select=id,user_id,created_at,revoked_at", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      user_id: userId,
    }),
  });

  if (response.ok) {
    const data = (await response.json()) as ShareRecord[];
    if (!data[0]) {
      throw new Error("No share returned");
    }
    return data[0];
  }

  if (response.status === 409) {
    const fallback = await getActiveShare(userId);
    if (fallback) {
      return fallback;
    }
    throw new Error("Share conflict without active share");
  }

  throw new Error(`Failed to create share: ${response.status}`);
}
