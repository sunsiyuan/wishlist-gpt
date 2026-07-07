/**
 * Canonical origin + MCP resource identifier helpers.
 *
 * The MCP server acts as an OAuth 2.1 protected resource. Its resource identifier (used as the
 * access-token audience per RFC 8707) is the fully-qualified MCP endpoint URL. We derive the
 * origin from forwarded headers so it stays correct behind Vercel's proxy and on preview URLs.
 */

export const MCP_ENDPOINT_PATH = "/api/mcp";

export function resolveOrigin(request: Request): string {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

export function mcpResourceUrl(request: Request): string {
  return `${resolveOrigin(request)}${MCP_ENDPOINT_PATH}`;
}

/**
 * Whether a client-supplied `resource` indicator is acceptable for this deployment.
 * Accepts the exact MCP endpoint URL (with or without a trailing slash) on our own origin.
 */
export function isResourceAllowed(request: Request, resource: string): boolean {
  const origin = resolveOrigin(request);
  const normalized = resource.replace(/\/+$/, "");
  return normalized === `${origin}${MCP_ENDPOINT_PATH}` || normalized === origin;
}
