import { NextRequest, NextResponse } from "next/server";
import { insertRegisteredClient } from "../../../../server/oauth/client-store";
import { generateClientId } from "../../../../server/oauth/tokens";

// CORS: the registration endpoint is called by MCP clients (e.g. ChatGPT) from another origin.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonError(error: string, description: string, status = 400) {
  return NextResponse.json(
    { error, error_description: description },
    { status, headers: CORS_HEADERS },
  );
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * OAuth 2.0 Dynamic Client Registration (RFC 7591). Lets ChatGPT self-register a public
 * (PKCE) client when connecting to the MCP server, instead of requiring a pre-provisioned
 * client in OAUTH_ALLOWED_CLIENTS_JSON.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("invalid_client_metadata", "Request body must be JSON");
  }
  if (!body || typeof body !== "object") {
    return jsonError("invalid_client_metadata", "Request body must be a JSON object");
  }

  const meta = body as Record<string, unknown>;
  const redirectUris = meta.redirect_uris;
  if (
    !Array.isArray(redirectUris) ||
    redirectUris.length === 0 ||
    !redirectUris.every((u) => typeof u === "string" && /^https?:\/\//.test(u))
  ) {
    return jsonError("invalid_redirect_uri", "redirect_uris must be a non-empty array of URLs");
  }

  const grantTypes =
    Array.isArray(meta.grant_types) && meta.grant_types.every((g) => typeof g === "string")
      ? (meta.grant_types as string[])
      : ["authorization_code", "refresh_token"];
  const tokenEndpointAuthMethod =
    typeof meta.token_endpoint_auth_method === "string"
      ? meta.token_endpoint_auth_method
      : "none";
  const clientName = typeof meta.client_name === "string" ? meta.client_name : null;
  const scope = typeof meta.scope === "string" ? meta.scope : null;

  const clientId = generateClientId();

  try {
    const client = await insertRegisteredClient({
      client_id: clientId,
      client_name: clientName,
      redirect_uris: redirectUris as string[],
      grant_types: grantTypes,
      token_endpoint_auth_method: tokenEndpointAuthMethod,
      scope,
    });

    return NextResponse.json(
      {
        client_id: client.client_id,
        client_name: client.client_name ?? undefined,
        redirect_uris: client.redirect_uris,
        grant_types: client.grant_types,
        token_endpoint_auth_method: client.token_endpoint_auth_method,
        scope: client.scope ?? undefined,
        client_id_issued_at: Math.floor(new Date(client.created_at).getTime() / 1000),
      },
      { status: 201, headers: CORS_HEADERS },
    );
  } catch {
    return jsonError("server_error", "Failed to register client", 500);
  }
}
