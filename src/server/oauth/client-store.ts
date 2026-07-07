import { supabaseAdminFetch } from "../supabase/admin";

export type RegisteredClient = {
  client_id: string;
  client_name: string | null;
  redirect_uris: string[];
  grant_types: string[];
  token_endpoint_auth_method: string;
  scope: string | null;
  created_at: string;
};

/**
 * Look up a dynamically-registered (RFC 7591) OAuth client by id.
 * Returns null if not found. Static allowlist clients are handled separately in clients.ts.
 */
export async function getRegisteredClient(clientId: string): Promise<RegisteredClient | null> {
  const search = new URLSearchParams({
    client_id: `eq.${clientId}`,
    limit: "1",
    select: "*",
  });
  const response = await supabaseAdminFetch(`/rest/v1/oauth_clients?${search.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch oauth client: ${response.status}`);
  }
  const data = (await response.json()) as RegisteredClient[];
  return data[0] ?? null;
}

export async function insertRegisteredClient(client: {
  client_id: string;
  client_name: string | null;
  redirect_uris: string[];
  grant_types: string[];
  token_endpoint_auth_method: string;
  scope: string | null;
}): Promise<RegisteredClient> {
  const response = await supabaseAdminFetch("/rest/v1/oauth_clients", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify(client),
  });
  if (!response.ok) {
    throw new Error(`Failed to insert oauth client: ${response.status}`);
  }
  const data = (await response.json()) as RegisteredClient[];
  if (!data[0]) {
    throw new Error("No oauth client returned");
  }
  return data[0];
}
