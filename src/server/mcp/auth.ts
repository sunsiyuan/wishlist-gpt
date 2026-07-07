import "server-only";

import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { getSigningSecret } from "../oauth/config";
import { verifyJwt } from "../oauth/jwt";
import { isResourceAllowed } from "../oauth/resource";
import { OAUTH_SCOPES } from "../oauth/scopes";

/**
 * Token verifier for the MCP server (used with mcp-handler's `withMcpAuth`).
 *
 * Validates the bearer JWT signature + expiry, then confirms the token audience (`aud`) was
 * minted for this MCP resource (RFC 8707), so a token issued for a different resource can't be
 * replayed here. Returns the MCP `AuthInfo` carrying the resolved Supabase user id in `extra`.
 */
export async function verifyMcpToken(
  req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!bearerToken) {
    return undefined;
  }

  const payload = verifyJwt(bearerToken, getSigningSecret());
  if (!payload) {
    return undefined;
  }

  // Audience binding: the token must have been issued for this MCP resource.
  if (!payload.aud || !isResourceAllowed(req, payload.aud)) {
    return undefined;
  }

  const scopes = payload.scope ? payload.scope.split(" ").filter(Boolean) : [...OAUTH_SCOPES];

  return {
    token: bearerToken,
    clientId: payload.client_id ?? payload.aud,
    scopes,
    extra: {
      userId: payload.sub,
    },
  };
}
