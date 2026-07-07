import { NextRequest, NextResponse } from "next/server";
import { mcpResourceUrl, resolveOrigin } from "../../../server/oauth/resource";
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
 * OAuth 2.0 Protected Resource Metadata (RFC 9728). MCP clients (ChatGPT) fetch this to learn
 * which authorization server issues tokens for this MCP resource. The `withMcpAuth` 401 challenge
 * points here via its WWW-Authenticate header.
 */
export function GET(request: NextRequest) {
  const origin = resolveOrigin(request);
  return NextResponse.json(
    {
      resource: mcpResourceUrl(request),
      authorization_servers: [origin],
      scopes_supported: OAUTH_SCOPES,
      bearer_methods_supported: ["header"],
    },
    { headers: CORS_HEADERS },
  );
}
