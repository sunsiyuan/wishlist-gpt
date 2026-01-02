export const OAUTH_STATE_COOKIE = "oauth_state";

export const CODE_TTL_SECONDS = 5 * 60;
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

export function getSigningSecret(): string {
  const secret = process.env.OAUTH_SIGNING_SECRET;
  if (!secret) {
    throw new Error("OAUTH_SIGNING_SECRET is required");
  }
  return secret;
}

export function getAllowedClientsJson(): string {
  const raw = process.env.OAUTH_ALLOWED_CLIENTS_JSON;
  if (!raw) {
    throw new Error("OAUTH_ALLOWED_CLIENTS_JSON is required");
  }
  return raw;
}
