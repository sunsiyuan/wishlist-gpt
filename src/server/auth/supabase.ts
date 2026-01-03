import { supabaseAdminFetch } from "../supabase/admin";

const SUPABASE_ACCESS_TOKEN_COOKIE = "sb-access-token";

/**
 * Supabase session lookup only.
 * - Cookie-based Supabase session is always allowed.
 * - Authorization header bypass is gated for local/dev convenience only.
 *
 * IMPORTANT: OAuth access-token bearer auth is handled in src/server/auth/bearer.ts
 * and must never be gated by OAUTH_ALLOW_AUTH_HEADER_LOGIN.
 */
function allowSupabaseAuthHeaderBypass(): boolean {
  const v = (process.env.OAUTH_ALLOW_AUTH_HEADER_LOGIN ?? "").toLowerCase().trim();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;

  // Safe default: production => disallow; otherwise => allow (to keep dev ergonomics)
  return process.env.NODE_ENV !== "production";
}

function getSupabaseAccessTokenFromCookie(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }
  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  const tokenCookie = cookies.find((cookie) => cookie.startsWith(`${SUPABASE_ACCESS_TOKEN_COOKIE}=`));
  if (!tokenCookie) {
    return null;
  }
  return decodeURIComponent(tokenCookie.split("=")[1] ?? "");
}

function getSupabaseAccessTokenFromHeaderBypass(request: Request): string | null {
  if (!allowSupabaseAuthHeaderBypass()) {
    return null;
  }
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  return authHeader.slice(7).trim();
}

export async function getSupabaseUserId(request: Request): Promise<string | null> {
  const accessToken =
    getSupabaseAccessTokenFromCookie(request) ?? getSupabaseAccessTokenFromHeaderBypass(request);
  if (!accessToken) {
    return null;
  }

  const response = await supabaseAdminFetch("/auth/v1/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as { id?: string };
  return data?.id ?? null;
}
