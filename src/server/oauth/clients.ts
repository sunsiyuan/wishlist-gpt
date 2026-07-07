import { getAllowedClientsJson } from "./config";

type AllowedClient = {
  redirect_uris: string[];
  enabled?: boolean;
};

type AllowedClientsMap = Record<string, AllowedClient | string[]>;

let cachedClients: AllowedClientsMap | null = null;

function loadClients(): AllowedClientsMap {
  if (cachedClients) {
    return cachedClients;
  }
  const raw = getAllowedClientsJson();
  cachedClients = JSON.parse(raw) as AllowedClientsMap;
  return cachedClients;
}

export function getAllowedRedirectUris(clientId: string): string[] | null {
  const clients = loadClients();
  const entry = clients[clientId];
  if (!entry) {
    return null;
  }
  if (Array.isArray(entry)) {
    return entry;
  }
  if (entry.enabled === false) {
    return null;
  }
  return entry.redirect_uris ?? null;
}

export function isRedirectUriAllowed(clientId: string, redirectUri: string): boolean {
  const allowed = getAllowedRedirectUris(clientId);
  if (!allowed) {
    return false;
  }
  return allowed.includes(redirectUri);
}

/**
 * Resolve a client's allowed redirect URIs, checking the static env allowlist first and then
 * dynamically-registered (RFC 7591 / DCR) clients. Used by the MCP OAuth flow where ChatGPT
 * registers itself at runtime instead of being pre-provisioned.
 */
export async function resolveClientRedirectUris(clientId: string): Promise<string[] | null> {
  const staticUris = getAllowedRedirectUris(clientId);
  if (staticUris) {
    return staticUris;
  }
  const { getRegisteredClient } = await import("./client-store");
  const registered = await getRegisteredClient(clientId);
  return registered?.redirect_uris ?? null;
}

export async function isRedirectUriAllowedAsync(
  clientId: string,
  redirectUri: string,
): Promise<boolean> {
  const allowed = await resolveClientRedirectUris(clientId);
  if (!allowed) {
    return false;
  }
  return allowed.includes(redirectUri);
}
