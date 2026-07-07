import { ACCESS_TOKEN_TTL_SECONDS, getSigningSecret } from "./config";
import { signJwt } from "./jwt";

/**
 * Mint an access token. For MCP/Apps SDK the token audience (`aud`) is the MCP resource URL the
 * token was requested for (RFC 8707 resource indicator); `client_id` and `scope` are carried as
 * separate claims. When no `resource` is supplied the audience falls back to the client id to
 * preserve legacy behavior.
 */
export function createAccessToken(params: {
  userId: string;
  clientId: string;
  resource?: string;
  scope?: string;
}): { token: string; expiresIn: number } {
  const token = signJwt(
    {
      sub: params.userId,
      aud: params.resource ?? params.clientId,
      client_id: params.clientId,
      scope: params.scope,
    },
    getSigningSecret(),
    ACCESS_TOKEN_TTL_SECONDS,
  );
  return {
    token,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  };
}
