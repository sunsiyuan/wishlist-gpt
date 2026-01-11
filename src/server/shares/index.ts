import { supabaseAdminFetch } from "../supabase/admin";

export type ShareRecord = {
  id: string;
  user_id: string;
  created_at: string;
  revoked_at: string | null;
};

export type ShareResponse = {
  share_id: string;
  share_url: string;
};

const SHARE_SELECT = "id,user_id,created_at,revoked_at";

class ShareCreateError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ShareCreateError";
    this.status = status;
  }
}

function isShareCreateConflict(error: unknown): boolean {
  return error instanceof ShareCreateError && error.status === 409;
}

export function buildShareUrl(origin: string, shareId: string): string {
  return `${origin}/s/${shareId}`;
}

export async function getActiveShare(userId: string): Promise<ShareRecord | null> {
  const search = new URLSearchParams({
    user_id: `eq.${userId}`,
    revoked_at: "is.null",
    order: "created_at.desc,id.desc",
    limit: "1",
    select: SHARE_SELECT,
  });
  const response = await supabaseAdminFetch(`/rest/v1/shares?${search.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch active share: ${response.status}`);
  }
  const data = (await response.json()) as ShareRecord[];
  return data[0] ?? null;
}

export async function getActiveShareById(shareId: string): Promise<ShareRecord | null> {
  const search = new URLSearchParams({
    id: `eq.${shareId}`,
    revoked_at: "is.null",
    limit: "1",
    select: SHARE_SELECT,
  });
  const response = await supabaseAdminFetch(`/rest/v1/shares?${search.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch share by id: ${response.status}`);
  }
  const data = (await response.json()) as ShareRecord[];
  return data[0] ?? null;
}

async function createShareRecord(userId: string): Promise<ShareRecord> {
  const response = await supabaseAdminFetch(`/rest/v1/shares?select=${encodeURIComponent(SHARE_SELECT)}`, {
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

  throw new ShareCreateError(response.status, `Failed to create share: ${response.status}`);
}

async function revokeActiveShare(userId: string): Promise<void> {
  const search = new URLSearchParams({
    user_id: `eq.${userId}`,
    revoked_at: "is.null",
  });
  const response = await supabaseAdminFetch(`/rest/v1/shares?${search.toString()}`, {
    method: "PATCH",
    body: JSON.stringify({
      revoked_at: new Date().toISOString(),
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to revoke active share: ${response.status}`);
  }
}

export async function createOrReuseShare(userId: string): Promise<ShareRecord> {
  const existing = await getActiveShare(userId);
  if (existing) {
    return existing;
  }

  try {
    return await createShareRecord(userId);
  } catch (error) {
    if (!isShareCreateConflict(error)) {
      throw error;
    }
    const fallback = await getActiveShare(userId);
    if (fallback) {
      return fallback;
    }
    throw new Error("Share conflict without active share");
  }
}

export async function rotateShareForUser(userId: string, origin: string): Promise<ShareResponse> {
  const share = await rotateShareRecord(userId);
  return {
    share_id: share.id,
    share_url: buildShareUrl(origin, share.id),
  };
}

async function rotateShareRecord(userId: string): Promise<ShareRecord> {
  const firstAttempt = await tryRotateShareRecord(userId);
  if (firstAttempt) {
    return firstAttempt;
  }

  const secondAttempt = await tryRotateShareRecord(userId);
  if (secondAttempt) {
    return secondAttempt;
  }

  const fallback = await getActiveShare(userId);
  if (fallback) {
    return fallback;
  }
  throw new Error("Failed to rotate share");
}

async function tryRotateShareRecord(userId: string): Promise<ShareRecord | null> {
  await revokeActiveShare(userId);
  try {
    return await createShareRecord(userId);
  } catch (error) {
    if (isShareCreateConflict(error)) {
      return null;
    }
    throw error;
  }
}

export async function revokeShareForUser(shareId: string, userId: string): Promise<boolean> {
  const search = new URLSearchParams({
    id: `eq.${shareId}`,
    user_id: `eq.${userId}`,
  });
  const response = await supabaseAdminFetch(
    `/rest/v1/shares?${search.toString()}&select=${encodeURIComponent(SHARE_SELECT)}`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        revoked_at: new Date().toISOString(),
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to revoke share: ${response.status}`);
  }
  const data = (await response.json()) as ShareRecord[];
  return data.length > 0;
}

export { getPublicShareItems, isValidShareId, type PublicShareItem } from "./public";
