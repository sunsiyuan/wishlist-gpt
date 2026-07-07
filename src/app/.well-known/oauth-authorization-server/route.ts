import { NextRequest, NextResponse } from "next/server";
import { resolveOrigin } from "../../../server/oauth/resource";
import { OAUTH_SCOPES } from "../../../server/oauth/scopes";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414). Advertises the authorize/token/registration
 * endpoints and PKCE support so MCP clients can complete the OAuth 2.1 flow without manual config.
 */
export function GET(request: NextRequest) {
  const origin = resolveOrigin(request);
  return NextResponse.json(
    {
      issuer: origin,
      authorization_endpoint: `${origin}/oauth/authorize`,
      token_endpoint: `${origin}/oauth/token`,
      registration_endpoint: `${origin}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: OAUTH_SCOPES,
    },
    { headers: CORS_HEADERS },
  );
}
