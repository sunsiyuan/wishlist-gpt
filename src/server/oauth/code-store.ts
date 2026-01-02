import { supabaseAdminFetch } from "../supabase/admin";

export type OauthCodeRecord = {
  code: string;
  user_id: string;
  client_id: string;
  redirect_uri: string;
  expires_at: string;
  used_at: string | null;
};

export async function insertOauthCode(record: OauthCodeRecord): Promise<OauthCodeRecord> {
  const response = await supabaseAdminFetch("/rest/v1/oauth_codes", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify(record),
  });
  if (!response.ok) {
    throw new Error(`Failed to insert oauth code: ${response.status}`);
  }
  const data = (await response.json()) as OauthCodeRecord[];
  if (!data[0]) {
    throw new Error("No oauth code returned");
  }
  return data[0];
}

export async function consumeOauthCode(params: {
  code: string;
  clientId: string;
  redirectUri: string;
  now: string;
}): Promise<OauthCodeRecord | null> {
  const search = new URLSearchParams({
    code: `eq.${params.code}`,
    client_id: `eq.${params.clientId}`,
    redirect_uri: `eq.${params.redirectUri}`,
    used_at: "is.null",
    expires_at: `gt.${params.now}`,
  });
  const response = await supabaseAdminFetch(`/rest/v1/oauth_codes?${search.toString()}`, {
    method: "PATCH",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify({ used_at: params.now }),
  });
  if (!response.ok) {
    throw new Error(`Failed to consume oauth code: ${response.status}`);
  }
  const data = (await response.json()) as OauthCodeRecord[];
  return data[0] ?? null;
}
