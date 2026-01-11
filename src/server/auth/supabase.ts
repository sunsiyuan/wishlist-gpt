import { NextRequest } from "next/server";
import { createSupabaseRequestClient } from "../../lib/supabase/server";

const LEGACY_ACCESS_TOKEN_COOKIE = "sb-access-token";

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

function getLegacyAccessTokenFromCookie(request: NextRequest): string | null {
  return request.cookies.get(LEGACY_ACCESS_TOKEN_COOKIE)?.value ?? null;
}

function getSupabaseAccessTokenFromHeaderBypass(request: NextRequest): string | null {
  if (!allowSupabaseAuthHeaderBypass()) {
    return null;
  }
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  return authHeader.slice(7).trim();
}

export async function getSupabaseUserId(request: NextRequest): Promise<string | null> {
  const supabase = createSupabaseRequestClient(request);
  const { data: claimsData } = await supabase.auth.getClaims();
  const claimUserId = claimsData?.claims?.sub;
  if (claimUserId) {
    return claimUserId;
  }

  const accessToken =
    getLegacyAccessTokenFromCookie(request) ?? getSupabaseAccessTokenFromHeaderBypass(request);
  if (!accessToken) {
    return null;
  }

  const { data } = await supabase.auth.getUser(accessToken);
  return data.user?.id ?? null;
}
