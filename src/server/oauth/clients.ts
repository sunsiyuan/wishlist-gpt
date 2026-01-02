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
