import { supabaseAdminFetch } from "../supabase/admin";

const SUPABASE_ACCESS_TOKEN_COOKIE = "sb-access-token";

/**
 * Scheme A:
 * - Keep Authorization: Bearer <supabase_user_access_token> login path,
 *   but gate it behind env var to avoid unintentionally enabling it in prod.
 *
 * Env:
 * - OAUTH_ALLOW_AUTH_HEADER_LOGIN=true|false
 *   - local/dev/CI: true
 *   - prod: false (default)
 */
function allowAuthHeaderLogin(): boolean {
  const v = (process.env.OAUTH_ALLOW_AUTH_HEADER_LOGIN ?? "").toLowerCase().trim();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;

  // Safe default: production => disallow; otherwise => allow (to keep dev ergonomics)
  return process.env.NODE_ENV !== "production";
}

export function getSupabaseAccessTokenFromRequest(request: Request): string | null {
  // 1) Authorization header (optional, gated)
  if (allowAuthHeaderLogin()) {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.toLowerCase().startsWith("bearer ")) {
      return authHeader.slice(7).trim();
    }
  }

  // 2) Cookie fallback
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

export async function getSupabaseUserId(request: Request): Promise<string | null> {
  const accessToken = getSupabaseAccessTokenFromRequest(request);
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
