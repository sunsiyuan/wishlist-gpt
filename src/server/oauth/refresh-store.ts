import { supabaseAdminFetch } from "../supabase/admin";

export type RefreshTokenRecord = {
  refresh_token_hash: string;
  user_id: string;
  client_id: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
};

export async function insertRefreshToken(record: Omit<RefreshTokenRecord, "created_at" | "revoked_at">): Promise<void> {
  const response = await supabaseAdminFetch("/rest/v1/oauth_tokens", {
    method: "POST",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify(record),
  });
  if (!response.ok) {
    throw new Error(`Failed to insert refresh token: ${response.status}`);
  }
}

export async function findValidRefreshToken(params: {
  refreshTokenHash: string;
  clientId: string;
  now: string;
}): Promise<RefreshTokenRecord | null> {
  const search = new URLSearchParams({
    refresh_token_hash: `eq.${params.refreshTokenHash}`,
    client_id: `eq.${params.clientId}`,
    revoked_at: "is.null",
    expires_at: `gt.${params.now}`,
    select: "refresh_token_hash,user_id,client_id,expires_at,revoked_at,created_at",
  });
  const response = await supabaseAdminFetch(`/rest/v1/oauth_tokens?${search.toString()}`, {
    method: "GET",
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch refresh token: ${response.status}`);
  }
  const data = (await response.json()) as RefreshTokenRecord[];
  return data[0] ?? null;
}
